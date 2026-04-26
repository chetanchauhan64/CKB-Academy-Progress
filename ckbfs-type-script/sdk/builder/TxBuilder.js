/**
 * builder/TxBuilder.js — Raw CKB Transaction Assembler
 *
 * Builds raw CKB transaction objects (NOT Lumos TransactionSkeleton) for the
 * three CKBFS lifecycle operations: create, update, consume.
 *
 * OUTPUT FORMAT (matches CKB RPC sendTransaction):
 * {
 *   version: '0x0',
 *   cellDeps: [...],
 *   headerDeps: [],
 *   inputs: [{ previousOutput: { txHash, index }, since: '0x0' }, ...],
 *   outputs: [{ capacity, lock, type }, ...],
 *   outputsData: ['0x...', ...],
 *   witnesses: ['0x...', ...]   ← filled with zeros here; Signer replaces them
 * }
 *
 * Each builder function returns:
 * {
 *   rawTx:         object     — the unsigned raw transaction
 *   signingInputs: number[]   — input indices that need a secp256k1 witness
 * }
 */

import { config } from '@ckb-lumos/lumos';
import {
  CKBFS_CODE_HASH,
  CKBFS_CELL_DEP,
} from '../config.js';
import {
  chunkFile,
  encodeTypeArgs,
  encodeCellData,
  decodeCellData,
  bytesToHex,
  CURRENT_VERSION,
  FLAG_FINALIZED,
  FLAG_IMMUTABLE,
} from '../utils/encoding.js';
import {
  selectInputCells,
  findCkbfsCellsByFileId,
} from './InputSelector.js';
import {
  computeFee,
  computeCkbfsCellMinCapacity,
  computeChangeCellMinCapacity,
  DEFAULT_FEE_RATE,
} from './FeeCalculator.js';
import {
  computeChange,
  sumOutputCapacity,
  sumInputCapacity,
} from './ChangeOutput.js';
import {
  ImmutableCellError,
  FileNotFoundError,
  InsufficientCapacityError,
} from '../utils/errors.js';

// ── Cell Dep Helpers ───────────────────────────────────────────────────────────

/**
 * Build the standard cell deps array for a CKBFS transaction:
 *   1. Secp256k1/Blake160 dep group (for unlocking input cells)
 *   2. CKBFS binary cell (for executing the type script)
 */
function buildCellDeps() {
  const secp = config.getConfig().SCRIPTS.SECP256K1_BLAKE160;
  return [
    {
      outPoint: { txHash: secp.TX_HASH, index: secp.INDEX }, // INDEX is already '0x0'
      depType: secp.DEP_TYPE,
    },
    {
      outPoint: {
        txHash: CKBFS_CELL_DEP.outPoint.txHash,
        index: `0x${Number(CKBFS_CELL_DEP.outPoint.index).toString(16)}`,
      },
      depType: CKBFS_CELL_DEP.depType,
    },
  ];
}

/**
 * Convert a live-cell out-point to a transaction input.
 */
function cellToInput(cell) {
  return {
    previousOutput: {
      txHash: cell.outPoint.txHash,
      index: `0x${Number(cell.outPoint.index).toString(16)}`,
    },
    since: '0x0',
  };
}

// ── CREATE ─────────────────────────────────────────────────────────────────────

/**
 * Build a CREATE transaction (no GroupInput, only GroupOutput cells).
 *
 * @param {object} params
 * @param {Uint8Array} params.fileBytes       - Raw file content.
 * @param {object}     params.wallet          - Wallet instance.
 * @param {string}     params.fileId          - 0x-prefixed 32-byte file ID.
 * @param {number}     [params.chunkSize]     - Max bytes per chunk (default 512 KB).
 * @param {boolean}    [params.finalize]      - Set FLAG_FINALIZED (default true).
 * @param {boolean}    [params.immutable]     - Set FLAG_IMMUTABLE (default false).
 * @param {bigint}     [params.feeRate]       - Shannons per 1000 bytes.
 * @returns {Promise<{ rawTx, signingInputs, chunkCount }>}
 */
export async function buildCreateTx({
  fileBytes,
  wallet,
  fileId,
  chunkSize = 512_000,
  finalize = true,
  immutable = false,
  feeRate = DEFAULT_FEE_RATE,
}) {
  // ── 1. Flags ──────────────────────────────────────────────────────────────
  let flags = 0;
  if (finalize)  flags |= FLAG_FINALIZED;
  if (immutable) flags |= FLAG_IMMUTABLE;

  // ── 2. Encode file into CKBFS chunks ─────────────────────────────────────
  const content = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
  const encodedChunks = chunkFile(content, chunkSize, flags);
  console.log(`  [TxBuilder] CREATE: ${encodedChunks.length} chunk(s)`);

  // ── 3. Build Type Script ──────────────────────────────────────────────────
  const typeArgs = encodeTypeArgs(wallet.lockHash, fileId);
  // hashType 'data1': VM v1 (CKB2021) — handles W^X ELF loading correctly;
  // 'data' (VM v0) fails with MemWriteOnExecutablePage when loading R+X segments.
  const typeScript = { codeHash: CKBFS_CODE_HASH, hashType: 'data1', args: typeArgs };

  // ── 4. Build output cells ─────────────────────────────────────────────────
  const outputs = encodedChunks.map((chunkData) => {
    const minCap = computeCkbfsCellMinCapacity(wallet.lockScript, typeScript, chunkData.length);
    return {
      cellOutput: {
        capacity: '0x' + minCap.toString(16),
        lock: wallet.lockScript,
        type: typeScript,
      },
      data: bytesToHex(chunkData),
    };
  });

  // ── 5. Estimate fee (with placeholder 1 fee-input and 1 change output) ───
  const totalOutputCap = sumOutputCapacity(outputs);
  const changeCellSize = computeChangeCellMinCapacity(wallet.lockScript);

  const fee = computeFee(
    {
      inputCount: 1, // minimum placeholder; we'll know the real count below
      outputs: [...outputs, { cellOutput: { capacity: '0x' + changeCellSize.toString(16), lock: wallet.lockScript, type: null }, data: '0x' }],
      cellDepCount: 2,
      signingGroupCount: 1,
    },
    feeRate
  );

  // ── 6. Select inputs to cover outputs + fee ───────────────────────────────
  const required = totalOutputCap + fee + changeCellSize;
  const { selectedCells, totalInputCapacity } = await selectInputCells({
    address: wallet.address,
    requiredCapacity: required,
  });

  // ── 7. Re-estimate fee with real input count ──────────────────────────────
  const realFee = computeFee(
    {
      inputCount: selectedCells.length,
      outputs: [...outputs, { cellOutput: { capacity: '0x0', lock: wallet.lockScript, type: null }, data: '0x' }],
      cellDepCount: 2,
      signingGroupCount: 1,
    },
    feeRate
  );

  // ── 8. Compute change ─────────────────────────────────────────────────────
  const { changeCell, hasChange } = computeChange({
    totalInputCapacity,
    totalOutputCapacity: totalOutputCap,
    fee: realFee,
    lockScript: wallet.lockScript,
  });

  const allOutputs = hasChange ? [...outputs, changeCell] : outputs;

  // ── 9. Assemble raw transaction ───────────────────────────────────────────
  const rawTx = {
    version: '0x0',
    cellDeps: buildCellDeps(),
    headerDeps: [],
    inputs: selectedCells.map(cellToInput),
    outputs: allOutputs.map((o) => o.cellOutput),
    outputsData: allOutputs.map((o) => o.data),
    witnesses: selectedCells.map(() => '0x'), // placeholders; Signer fills these
  };

  // signingInputs = all fee-payment inputs (they all belong to the same secp256k1 lock)
  const signingInputs = selectedCells.map((_, i) => i);

  return { rawTx, signingInputs, chunkCount: encodedChunks.length };
}

// ── UPDATE ─────────────────────────────────────────────────────────────────────

/**
 * Build an UPDATE transaction (both GroupInput and GroupOutput cells present).
 *
 * @param {object} params
 * @param {string}     params.fileId         - 0x-prefixed 32-byte file ID.
 * @param {Uint8Array} params.newFileBytes    - New raw file content.
 * @param {object}     params.wallet         - Wallet instance.
 * @param {boolean}    [params.finalize]     - Set FLAG_FINALIZED on outputs (default true).
 * @param {bigint}     [params.feeRate]
 * @returns {Promise<{ rawTx, signingInputs, chunkCount }>}
 */
export async function buildUpdateTx({
  fileId,
  newFileBytes,
  wallet,
  finalize = true,
  feeRate = DEFAULT_FEE_RATE,
}) {
  // ── 1. Fetch existing CKBFS cells ─────────────────────────────────────────
  console.log(`  [TxBuilder] UPDATE: querying cells for fileId=${fileId}`);
  const existingCells = await findCkbfsCellsByFileId(wallet.address, CKBFS_CODE_HASH, fileId);

  if (existingCells.length === 0) {
    throw new FileNotFoundError(fileId, wallet.address);
  }

  const totalChunks = existingCells.length;
  console.log(`  [TxBuilder] UPDATE: ${totalChunks} chunk(s) found`);

  // ── 2. Immutability guard ─────────────────────────────────────────────────
  for (const cell of existingCells) {
    const decoded = decodeCellData(cell.data);
    if (decoded.isImmutable) {
      throw new ImmutableCellError(decoded.chunkIndex, cell.outPoint);
    }
  }

  // ── 3. Split new content to match existing chunk count ────────────────────
  const newContent = newFileBytes instanceof Uint8Array ? newFileBytes : new Uint8Array(newFileBytes);
  const chunkSize = Math.ceil(newContent.length / totalChunks);
  const newChunks = splitIntoNChunks(newContent, totalChunks);

  // ── 4. Build output cells (same args as inputs, new data) ─────────────────
  let flags = 0;
  if (finalize) flags |= FLAG_FINALIZED;

  const ckbfsOutputs = existingCells.map((inputCell, i) => {
    const inputDecoded = decodeCellData(inputCell.data);
    const newData = encodeCellData({
      version: CURRENT_VERSION,
      flags,
      chunkIndex: inputDecoded.chunkIndex,
      totalChunks: inputDecoded.totalChunks,
      content: newChunks[i],
    });
    return {
      cellOutput: {
        // Reuse the same capacity — content change doesn't need more capacity
        // (unless new content is larger; we check below)
        capacity: inputCell.cellOutput.capacity,
        lock: wallet.lockScript,
        type: inputCell.cellOutput.type, // preserve original args (U6/U7)
      },
      data: bytesToHex(newData),
    };
  });

  // Capacity check: if new data is larger, bump capacity to the minimum required.
  // The shortfall will be collected from extra fee-payment inputs below.
  for (let i = 0; i < ckbfsOutputs.length; i++) {
    const minCap = computeCkbfsCellMinCapacity(
      wallet.lockScript,
      ckbfsOutputs[i].cellOutput.type,
      (ckbfsOutputs[i].data.length - 2) / 2
    );
    const actualCap = BigInt(existingCells[i].cellOutput.capacity);
    if (minCap > actualCap) {
      // Bump the output capacity to fit the new content.
      ckbfsOutputs[i].cellOutput.capacity = `0x${minCap.toString(16)}`;
    }
  }

  // ── 5. Estimate fee + select fee-payment inputs ───────────────────────────
  const totalCkbfsInputCap = sumInputCapacity(existingCells);
  const totalCkbfsOutputCap = sumOutputCapacity(ckbfsOutputs);
  // Update txs typically break even on CKBFS capacity; fee comes from extra inputs.
  const changeCellMin = computeChangeCellMinCapacity(wallet.lockScript);

  const feePlaceholder = computeFee(
    {
      inputCount: existingCells.length + 1,
      outputs: [...ckbfsOutputs, { cellOutput: { capacity: '0x0', lock: wallet.lockScript, type: null }, data: '0x' }],
      cellDepCount: 2,
      signingGroupCount: 1,
    },
    feeRate
  );

  const netCapChange = totalCkbfsInputCap - totalCkbfsOutputCap; // usually 0 for same-capacity update
  const feeShortfall = feePlaceholder - netCapChange;
  const requiredExtra = feeShortfall > 0n ? feeShortfall + changeCellMin : changeCellMin;

  const { selectedCells, totalInputCapacity: feeInputCap } = await selectInputCells({
    address: wallet.address,
    requiredCapacity: requiredExtra,
    excludeOutPoints: existingCells.map((c) => c.outPoint),
  });

  // ── 6. Re-estimate with real input count ──────────────────────────────────
  const allInputs = [...existingCells, ...selectedCells];
  const realFee = computeFee(
    {
      inputCount: allInputs.length,
      outputs: [...ckbfsOutputs, { cellOutput: { capacity: '0x0', lock: wallet.lockScript, type: null }, data: '0x' }],
      cellDepCount: 2,
      signingGroupCount: 1,
    },
    feeRate
  );

  // ── 7. Change cell ────────────────────────────────────────────────────────
  const allInputCap = totalCkbfsInputCap + feeInputCap;
  const { changeCell, hasChange } = computeChange({
    totalInputCapacity: allInputCap,
    totalOutputCapacity: totalCkbfsOutputCap,
    fee: realFee,
    lockScript: wallet.lockScript,
  });

  const allOutputs = hasChange ? [...ckbfsOutputs, changeCell] : ckbfsOutputs;

  // ── 8. Assemble raw tx ────────────────────────────────────────────────────
  const rawTx = {
    version: '0x0',
    cellDeps: buildCellDeps(),
    headerDeps: [],
    inputs: allInputs.map(cellToInput),
    outputs: allOutputs.map((o) => o.cellOutput),
    outputsData: allOutputs.map((o) => o.data),
    witnesses: allInputs.map(() => '0x'),
  };

  // All inputs share the same secp256k1 lock — one signing group
  const signingInputs = allInputs.map((_, i) => i);

  return { rawTx, signingInputs, chunkCount: totalChunks };
}

// ── CONSUME ────────────────────────────────────────────────────────────────────

/**
 * Build a CONSUME (destroy) transaction (GroupInput cells, no GroupOutput cells).
 *
 * @param {object} params
 * @param {string}  params.fileId   - 0x-prefixed 32-byte file ID.
 * @param {object}  params.wallet   - Wallet instance.
 * @param {bigint}  [params.feeRate]
 * @returns {Promise<{ rawTx, signingInputs, chunksConsumed, capacityRecovered }>}
 */
export async function buildConsumeTx({
  fileId,
  wallet,
  feeRate = DEFAULT_FEE_RATE,
}) {
  // ── 1. Fetch CKBFS cells ──────────────────────────────────────────────────
  console.log(`  [TxBuilder] CONSUME: querying cells for fileId=${fileId}`);
  const ckbfsCells = await findCkbfsCellsByFileId(wallet.address, CKBFS_CODE_HASH, fileId);

  if (ckbfsCells.length === 0) {
    throw new FileNotFoundError(fileId, wallet.address);
  }

  console.log(`  [TxBuilder] CONSUME: ${ckbfsCells.length} chunk(s) to destroy`);
  const totalCkbfsCapacity = sumInputCapacity(ckbfsCells);

  // ── 2. Estimate fee (CKBFS cells are inputs; change cell is the only output) ─
  const changeCellMin = computeChangeCellMinCapacity(wallet.lockScript);
  const feePlaceholder = computeFee(
    {
      inputCount: ckbfsCells.length,
      outputs: [{ cellOutput: { capacity: '0x0', lock: wallet.lockScript, type: null }, data: '0x' }],
      cellDepCount: 2,
      signingGroupCount: 1,
    },
    feeRate
  );

  // After consuming, recovered capacity = ckbfsCapacity - fee.
  // If recovered >= MIN_CHANGE_CAPACITY, we don't need extra fee-payment cells.
  const afterFee = totalCkbfsCapacity - feePlaceholder;
  let allInputs = [...ckbfsCells];
  let totalInputCap = totalCkbfsCapacity;

  if (afterFee < changeCellMin) {
    // Need extra inputs to cover the change cell minimum
    const extra = changeCellMin - afterFee;
    const { selectedCells, totalInputCapacity: extraCap } = await selectInputCells({
      address: wallet.address,
      requiredCapacity: extra,
      excludeOutPoints: ckbfsCells.map((c) => c.outPoint),
    });
    allInputs = [...ckbfsCells, ...selectedCells];
    totalInputCap += extraCap;
  }

  // ── 3. Re-estimate with real input count ──────────────────────────────────
  const realFee = computeFee(
    {
      inputCount: allInputs.length,
      outputs: [{ cellOutput: { capacity: '0x0', lock: wallet.lockScript, type: null }, data: '0x' }],
      cellDepCount: 2,
      signingGroupCount: 1,
    },
    feeRate
  );

  // ── 4. Change cell (recovered CKB minus fee) ──────────────────────────────
  const { changeCell, hasChange, changeCapacity } = computeChange({
    totalInputCapacity: totalInputCap,
    totalOutputCapacity: 0n, // no CKBFS outputs
    fee: realFee,
    lockScript: wallet.lockScript,
  });

  const allOutputs = hasChange ? [changeCell] : [];

  // ── 5. Assemble raw tx ────────────────────────────────────────────────────
  const rawTx = {
    version: '0x0',
    cellDeps: buildCellDeps(),
    headerDeps: [],
    inputs: allInputs.map(cellToInput),
    outputs: allOutputs.map((o) => o.cellOutput),
    outputsData: allOutputs.map((o) => o.data),
    witnesses: allInputs.map(() => '0x'),
  };

  const signingInputs = allInputs.map((_, i) => i);

  return {
    rawTx,
    signingInputs,
    chunksConsumed: ckbfsCells.length,
    capacityRecovered: changeCapacity,
  };
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function splitIntoNChunks(data, n) {
  const chunkSize = Math.ceil(data.length / n);
  const chunks = [];
  for (let i = 0; i < n; i++) {
    const start = i * chunkSize;
    chunks.push(data.slice(start, Math.min(start + chunkSize, data.length)));
  }
  // Ensure exactly n chunks (last might be empty if data divides exactly)
  while (chunks.length < n) chunks.push(new Uint8Array(0));
  return chunks;
}
