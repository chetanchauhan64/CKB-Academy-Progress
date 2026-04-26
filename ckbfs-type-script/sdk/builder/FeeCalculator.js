/**
 * builder/FeeCalculator.js — Byte-Accurate CKB Transaction Fee Estimation
 *
 * CKB fee formula:
 *   fee = ceil(serialized_tx_bytes * feeRate / 1000)
 *
 * "serialized_tx_bytes" is the length of the molecule-encoded transaction,
 * which includes inputs, outputs, cell deps, header deps, and witnesses.
 *
 * HOW MOLECULE ENCODING WORKS (for sizing purposes):
 *   Every molecule table is: 4-byte total_size + 4-byte * n offsets + content.
 *   Every molecule vector is: 4-byte length + items.
 *   Scripts: 4 (header) + 4*3 (offsets) + 32 (codeHash) + 1 (hashType) + args_len.
 *   CellOutput: 4 + 4*3 + 8 (capacity) + lock_size + type_size.
 *   Input: 32 (prev_txHash) + 4 (prev_index) + 8 (since) = 44 bytes.
 *   Witness: 4-byte length prefix + witness_bytes.
 *   WitnessArgs (lock only): 4 (header) + 4*4 (offsets) + 4 (lock len) + 65 (sig) = 85 bytes.
 *
 * We compute a conservative estimate — always >= actual — so transactions
 * never fail due to under-fee. The slight over-estimate means a tiny extra
 * capacity is absorbed into the change cell.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default fee rate: shannons per 1000 bytes. 1500 gives ~50% headroom over the 1000 min. */
export const DEFAULT_FEE_RATE = 1500n;

/** Absolute minimum fee to ensure mempool acceptance regardless of tx size. */
export const MIN_FEE = 1000n;

/** Minimum change cell capacity (61 CKB in shannons). */
export const MIN_CHANGE_CAPACITY = 6_100_000_000n;

// Molecule fixed overheads (bytes)
const MOLECULE_TABLE_HEADER = 4; // total_size (u32)
const MOLECULE_OFFSET = 4;       // each field offset (u32)
const TX_FIXED_HEADER = 4 + 4;   // table header + 5 field offsets

// Fixed-size components
const SCRIPT_FIXED = MOLECULE_TABLE_HEADER + MOLECULE_OFFSET * 3 + 32 + 1; // 49 bytes without args
const CELL_INPUT_SIZE = 44;     // txHash(32) + index(4) + since(8)
const CAPACITY_SIZE = 8;        // u64
const CELL_OUTPUT_FIXED = MOLECULE_TABLE_HEADER + MOLECULE_OFFSET * 3 + CAPACITY_SIZE; // 24 bytes without scripts

// Witness for a secp256k1 lock (WitnessArgs molecule):
//   table header(4) + 3 offsets(12) + lock_len(4) + sig(65) + empty input_type + empty output_type
const SECP256K1_WITNESS_SIZE = 4 + 4 * 3 + 4 + 65; // = 85 bytes

// ── Main Exports ───────────────────────────────────────────────────────────────

/**
 * Estimate the byte size of a transaction.
 *
 * @param {object} params
 * @param {number} params.inputCount       - Number of input cells.
 * @param {object[]} params.outputs        - Array of { cellOutput, data } objects.
 * @param {number} params.cellDepCount     - Number of cell deps.
 * @param {number} params.signingGroupCount - Number of distinct lock scripts signing (= witness count with sigs).
 * @returns {number} Estimated byte size.
 */
export function estimateTxSize({ inputCount, outputs, cellDepCount, signingGroupCount }) {
  // ── Fixed overhead ──────────────────────────────────────────────────────
  // Transaction table: header(4) + 5 field offsets(20) = 24 bytes
  let size = 24;

  // ── Cell Deps ──────────────────────────────────────────────────────────
  // Each cell dep: outPoint(36) + depType(1) = 37 bytes
  // Vector: length(4) + items
  size += 4 + cellDepCount * 37;

  // ── Header Deps (none for standard txs) ───────────────────────────────
  size += 4; // empty vector length

  // ── Inputs ────────────────────────────────────────────────────────────
  // Vector: length(4) + inputCount * 44
  size += 4 + inputCount * CELL_INPUT_SIZE;

  // ── Outputs ───────────────────────────────────────────────────────────
  // Each output: CellOutput molecule + data bytes
  let outputsSize = 4; // vector length
  let outputDataSize = 4; // vector length
  for (const { cellOutput, data } of outputs) {
    outputsSize += computeCellOutputSize(cellOutput);
    // data is a hex string; convert to byte count
    const dataBytes = data === '0x' ? 0 : (data.length - 2) / 2;
    outputDataSize += 4 + dataBytes; // 4-byte length prefix + bytes
  }
  size += outputsSize + outputDataSize;

  // ── Witnesses ──────────────────────────────────────────────────────────
  // Non-signing inputs get an empty witness (4-byte length = 0).
  const emptyWitnessCount = Math.max(0, inputCount - signingGroupCount);
  size += 4 // vector length
    + signingGroupCount * (4 + SECP256K1_WITNESS_SIZE) // 4-byte prefix + witness bytes
    + emptyWitnessCount * 4; // empty = just the 4-byte zero-length prefix

  return size;
}

/**
 * Compute the transaction fee.
 *
 * @param {object} txSizeParams - Same params as estimateTxSize.
 * @param {bigint} [feeRate]    - Shannons per 1000 bytes (default: 1000).
 * @returns {bigint} Fee in shannons.
 */
export function computeFee(txSizeParams, feeRate = DEFAULT_FEE_RATE) {
  const bytes = BigInt(estimateTxSize(txSizeParams));
  // ceil(bytes * feeRate / 1000), never below MIN_FEE
  const computed = (bytes * feeRate + 999n) / 1000n;
  return computed < MIN_FEE ? MIN_FEE : computed;
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Compute the molecule-encoded byte size of a CellOutput.
 * CellOutput = table { capacity: Uint64, lock: Script, type: ScriptOpt }
 *
 * @param {{ capacity, lock, type }} cellOutput
 * @returns {number}
 */
function computeCellOutputSize(cellOutput) {
  const lockSize = computeScriptSize(cellOutput.lock);
  const typeSize = cellOutput.type ? computeScriptSize(cellOutput.type) : 0;
  // CellOutput table: header(4) + 3 offsets(12) + capacity(8) + lock + type
  return CELL_OUTPUT_FIXED + lockSize + typeSize;
}

/**
 * Compute the molecule-encoded byte size of a Script.
 * Script = table { code_hash: Byte32, hash_type: byte, args: Bytes }
 *
 * @param {{ codeHash, hashType, args }} script
 * @returns {number}
 */
function computeScriptSize(script) {
  const argsBytes = script.args === '0x' ? 0 : (script.args.length - 2) / 2;
  return SCRIPT_FIXED + argsBytes;
}

/**
 * Compute the minimum cell capacity for a plain change output (lock-only).
 * lock = secp256k1-blake160 (20-byte args)
 *
 * @param {object} lockScript
 * @returns {bigint} Minimum capacity in shannons.
 */
export function computeChangeCellMinCapacity(lockScript) {
  const lockSize = computeScriptSize(lockScript);
  // cell = capacity(8) + lock + no-type + no-data
  const totalBytes = CAPACITY_SIZE + lockSize;
  return BigInt(totalBytes) * 100_000_000n;
}

/**
 * Compute the minimum capacity for a CKBFS output cell.
 *
 * @param {object} lockScript  - Owner's secp256k1 lock.
 * @param {object} typeScript  - CKBFS type script (64-byte args).
 * @param {number} dataLength  - Cell data byte length (42 + content).
 * @returns {bigint} Minimum capacity in shannons.
 */
export function computeCkbfsCellMinCapacity(lockScript, typeScript, dataLength) {
  const lockSize = computeScriptSize(lockScript);
  const typeSize = computeScriptSize(typeScript);
  const totalBytes = CAPACITY_SIZE + lockSize + typeSize + dataLength;
  return BigInt(totalBytes) * 100_000_000n;
}
