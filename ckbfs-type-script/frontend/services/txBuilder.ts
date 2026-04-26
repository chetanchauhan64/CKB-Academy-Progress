/**
 * services/txBuilder.ts — CKBFS transaction builder (server-side only)
 * Builds unsigned CKB transactions for CREATE / UPDATE / CONSUME.
 * No private key; signing is done by JoyID on the client.
 */

import { hexToBytes, bytesToHex, encodeCellData, decodeCellData, encodeTypeArgs,
         decodeTypeArgs, generateFileId, splitIntoChunks, sha256Sync } from '@/utils/encoding';
import type { LiveCell, OutPoint } from '@/types';

const RPC_URL  = process.env.NEXT_PUBLIC_CKB_RPC_URL  ?? 'https://testnet.ckbapp.dev';
const CODE_HASH = process.env.NEXT_PUBLIC_CKBFS_CODE_HASH ?? '';
const TX_HASH   = process.env.NEXT_PUBLIC_CKBFS_TX_HASH   ?? '';
const OUT_INDEX = process.env.NEXT_PUBLIC_CKBFS_OUT_INDEX  ?? '0x0';

// ─── RPC helper ───────────────────────────────────────────────────────────────

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ─── Capacity helpers ─────────────────────────────────────────────────────────

const SHANNON_PER_CKB = 100_000_000n;
const MIN_CHANGE_CAP = 61n * SHANNON_PER_CKB;
const BASE_FEE = 100_000n; // 0.001 CKB

function ckbfsCellCapacity(lockArgs: string, typeArgs: Uint8Array, dataLen: number): bigint {
  // capacity = (lock_bytes + type_bytes + data_bytes + capacity_bytes) * SHANNON_PER_BYTE
  // lock: 1(hashtype)+32(codehash)+argsLen
  // type: 1+32+typeArgsLen
  // capacity: 8 bytes
  const lockBytes = 33n + BigInt(lockArgs.length / 2 - 1); // hex->bytes minus 0x
  const typeBytes = 33n + BigInt(typeArgs.length);
  const dataBytes = BigInt(dataLen);
  const total = lockBytes + typeBytes + dataBytes + 8n; // 8 = capacity field
  return total * SHANNON_PER_CKB;
}

function minCellCap(lockScript: Script, typeScript: Script, dataLen: number): bigint {
  const lockArgBytes = BigInt((lockScript.args.length - 2) / 2);
  const typeArgBytes = BigInt((typeScript.args.length - 2) / 2);
  const lockBytes = 1n + 32n + lockArgBytes;
  const typeBytes = 1n + 32n + typeArgBytes;
  const dataBytes = BigInt(dataLen);
  const total = lockBytes + typeBytes + dataBytes + 8n;
  return total * SHANNON_PER_CKB;
}

interface Script {
  codeHash: string;
  hashType: string;
  args: string;
}

// ─── Cell selector ────────────────────────────────────────────────────────────

async function selectInputCells(
  lockScript: Script,
  required: bigint,
  exclude: string[] = [],
): Promise<{ cells: LiveCell[]; total: bigint }> {
  const excludeSet = new Set(exclude);
  const result = (await rpc('get_cells', [
    {
      script: { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      script_type: 'lock',
      filter: { script: null, output_data_len_range: ['0x0', '0x1'] },
    },
    'asc',
    '0x64',
  ])) as { objects: Array<{ out_point: { tx_hash: string; index: string }; output: { capacity: string; lock: { code_hash: string; hash_type: string; args: string }; type?: unknown }; output_data: string }> };

  const cells: LiveCell[] = [];
  let total = 0n;

  for (const c of result.objects) {
    const key = `${c.out_point.tx_hash}:${parseInt(c.out_point.index, 16)}`;
    if (excludeSet.has(key)) continue;
    if (c.output.type) continue;
    if (c.output_data && c.output_data !== '0x') continue;

    cells.push({
      outPoint: { txHash: c.out_point.tx_hash, index: c.out_point.index },
      cellOutput: {
        capacity: c.output.capacity,
        lock: { codeHash: c.output.lock.code_hash, hashType: c.output.lock.hash_type, args: c.output.lock.args },
      },
      data: c.output_data ?? '0x',
    });
    total += BigInt(c.output.capacity);
    if (total >= required) break;
  }

  if (total < required) throw new Error(`Insufficient CKB: need ${Number(required) / 1e8} CKB`);
  return { cells, total };
}

async function findCkbfsCells(lockScript: Script, fileId: string): Promise<LiveCell[]> {
  const result = (await rpc('get_cells', [
    {
      script: { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      script_type: 'lock',
      filter: {
        script: { code_hash: CODE_HASH, hash_type: 'data1', args: '0x' },
      },
    },
    'asc',
    '0x64',
  ])) as { objects: Array<{ out_point: { tx_hash: string; index: string }; output: { capacity: string; lock: { code_hash: string; hash_type: string; args: string }; type?: { code_hash: string; hash_type: string; args: string } }; output_data: string }> };

  return result.objects
    .filter(c => {
      if (!c.output.type) return false;
      try {
        const { fileId: fid } = decodeTypeArgs(c.output.type.args);
        return fid.toLowerCase() === fileId.toLowerCase();
      } catch { return false; }
    })
    .map(c => ({
      outPoint: { txHash: c.out_point.tx_hash, index: c.out_point.index },
      cellOutput: {
        capacity: c.output.capacity,
        lock: { codeHash: c.output.lock.code_hash, hashType: c.output.lock.hash_type, args: c.output.lock.args },
        type: c.output.type ? { codeHash: c.output.type.code_hash, hashType: c.output.type.hash_type, args: c.output.type.args } : null,
      },
      data: c.output_data ?? '0x',
    }));
}

// Compute lock hash from script
function scriptHash(script: Script): string {
  const codeHashBytes = hexToBytes(script.codeHash.slice(2));
  const argsBytes = hexToBytes(script.args.startsWith('0x') ? script.args.slice(2) : script.args);
  const hashTypeNum = script.hashType === 'type' ? 1 : script.hashType === 'data1' ? 2 : 0;
  const typeBytes = new Uint8Array([hashTypeNum]);
  // simplified hash — real app should use ckb-lumos computeScriptHash
  const preimage = new Uint8Array([...codeHashBytes, ...typeBytes, ...argsBytes]);
  return bytesToHex(sha256Sync(preimage));
}

// ─── BUILD CREATE TX ──────────────────────────────────────────────────────────

export interface CreateTxParams {
  lockScript: Script;
  fileContent: Uint8Array;
  chunkSize?: number;
  feeRate?: bigint;
}

export interface UnsignedTxResult {
  rawTx: Record<string, unknown>;
  fileId: string;
  chunkCount: number;
  capacityNeeded: string;
}

export async function buildCreateTransaction(params: CreateTxParams): Promise<UnsignedTxResult> {
  const { lockScript, fileContent, chunkSize = 32 * 1024, feeRate = 1000n } = params;

  const ownerLockHash = scriptHash(lockScript);
  const fileId = generateFileId(ownerLockHash, fileContent);
  const chunks = splitIntoChunks(fileContent, chunkSize);
  const totalChunks = chunks.length;

  // Build CKBFS outputs
  const ckbfsOutputs = chunks.map((chunk, i) => {
    const isFinalized = true;
    const flags = isFinalized ? 1 : 0;
    const cellData = encodeCellData({ chunkIndex: i, totalChunks, content: chunk, flags });
    const typeArgs = encodeTypeArgs(fileId, ownerLockHash);
    const typeScript: Script = { codeHash: CODE_HASH, hashType: 'data1', args: bytesToHex(typeArgs) };
    const minCap = minCellCap(lockScript, typeScript, cellData.length);
    return {
      output: {
        capacity: `0x${minCap.toString(16)}`,
        lock: { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
        type: { code_hash: CODE_HASH, hash_type: 'data1', args: bytesToHex(typeArgs) },
      },
      data: bytesToHex(cellData),
    };
  });

  const totalCkbfsCapacity = ckbfsOutputs.reduce((s, o) => s + BigInt(o.output.capacity), 0n);
  const required = totalCkbfsCapacity + MIN_CHANGE_CAP + BASE_FEE;

  const { cells: inputs, total: inputTotal } = await selectInputCells(lockScript, required);
  const changeCapacity = inputTotal - totalCkbfsCapacity - BASE_FEE;

  const changeOutput = {
    output: {
      capacity: `0x${changeCapacity.toString(16)}`,
      lock: { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      type: null,
    },
    data: '0x',
  };

  const cellDep = {
    out_point: { tx_hash: TX_HASH, index: OUT_INDEX },
    dep_type: 'code',
  };

  // secp256k1 cell dep (mainnet/testnet)
  const secp256k1Dep = {
    out_point: { tx_hash: '0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c', index: '0x0' },
    dep_type: 'dep_group',
  };

  const rawTx = {
    version: '0x0',
    cell_deps: [secp256k1Dep, cellDep],
    header_deps: [],
    inputs: inputs.map(c => ({
      previous_output: { tx_hash: c.outPoint.txHash, index: c.outPoint.index },
      since: '0x0',
    })),
    outputs: [...ckbfsOutputs.map(o => o.output), changeOutput.output],
    outputs_data: [...ckbfsOutputs.map(o => o.data), changeOutput.data],
    witnesses: inputs.map(() => '0x'),
  };

  return {
    rawTx,
    fileId,
    chunkCount: totalChunks,
    capacityNeeded: (Number(totalCkbfsCapacity) / 1e8).toFixed(4) + ' CKB',
  };
}

// ─── BUILD UPDATE TX ──────────────────────────────────────────────────────────

export async function buildUpdateTransaction(params: {
  lockScript: Script;
  fileId: string;
  newContent: Uint8Array;
  chunkSize?: number;
}): Promise<UnsignedTxResult> {
  const { lockScript, fileId, newContent, chunkSize = 32 * 1024 } = params;

  const existingCells = await findCkbfsCells(lockScript, fileId);
  if (existingCells.length === 0) throw new Error(`No cells found for fileId ${fileId}`);

  const ownerLockHash = scriptHash(lockScript);
  const chunks = splitIntoChunks(newContent, chunkSize);
  const totalChunks = chunks.length;

  const ckbfsOutputs = chunks.map((chunk, i) => {
    const flags = 1; // finalized
    const cellData = encodeCellData({ chunkIndex: i, totalChunks, content: chunk, flags });
    const typeArgs = encodeTypeArgs(fileId, ownerLockHash);
    const typeScript: Script = { codeHash: CODE_HASH, hashType: 'data1', args: bytesToHex(typeArgs) };
    // Try to reuse capacity from existing cell at index i, otherwise compute min
    const existingCap = existingCells[i] ? BigInt(existingCells[i].cellOutput.capacity) : 0n;
    const minCap = minCellCap(lockScript, typeScript, cellData.length);
    const cap = existingCap >= minCap ? existingCap : minCap;
    return {
      output: {
        capacity: `0x${cap.toString(16)}`,
        lock: { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
        type: { code_hash: CODE_HASH, hash_type: 'data1', args: bytesToHex(typeArgs) },
      },
      data: bytesToHex(cellData),
    };
  });

  const totalOldCap = existingCells.reduce((s, c) => s + BigInt(c.cellOutput.capacity), 0n);
  const totalNewCap = ckbfsOutputs.reduce((s, o) => s + BigInt(o.output.capacity), 0n);
  const netDelta = totalNewCap - totalOldCap; // positive = need more CKB
  const required = netDelta > 0n ? netDelta + MIN_CHANGE_CAP + BASE_FEE : MIN_CHANGE_CAP + BASE_FEE;

  const { cells: feeInputs, total: feeInputTotal } = await selectInputCells(lockScript, required);
  const changeCapacity = feeInputTotal + totalOldCap - totalNewCap - BASE_FEE;

  const changeOutput = {
    output: {
      capacity: `0x${changeCapacity.toString(16)}`,
      lock: { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      type: null,
    },
    data: '0x',
  };

  const cellDep = { out_point: { tx_hash: TX_HASH, index: OUT_INDEX }, dep_type: 'code' };
  const secp256k1Dep = { out_point: { tx_hash: '0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c', index: '0x0' }, dep_type: 'dep_group' };

  const allInputs = [
    ...existingCells.map(c => ({ previous_output: { tx_hash: c.outPoint.txHash, index: c.outPoint.index }, since: '0x0' })),
    ...feeInputs.map(c => ({ previous_output: { tx_hash: c.outPoint.txHash, index: c.outPoint.index }, since: '0x0' })),
  ];

  const rawTx = {
    version: '0x0',
    cell_deps: [secp256k1Dep, cellDep],
    header_deps: [],
    inputs: allInputs,
    outputs: [...ckbfsOutputs.map(o => o.output), changeOutput.output],
    outputs_data: [...ckbfsOutputs.map(o => o.data), changeOutput.data],
    witnesses: allInputs.map(() => '0x'),
  };

  return { rawTx, fileId, chunkCount: totalChunks, capacityNeeded: (Number(totalNewCap) / 1e8).toFixed(4) + ' CKB' };
}

// ─── BUILD CONSUME TX ─────────────────────────────────────────────────────────

export async function buildConsumeTransaction(params: {
  lockScript: Script;
  fileId: string;
}): Promise<{ rawTx: Record<string, unknown>; recoveredCkb: string }> {
  const { lockScript, fileId } = params;

  const cells = await findCkbfsCells(lockScript, fileId);
  if (cells.length === 0) throw new Error(`No cells found for fileId ${fileId}`);

  const totalCap = cells.reduce((s, c) => s + BigInt(c.cellOutput.capacity), 0n);
  const recoverCapacity = totalCap - BASE_FEE;

  const cellDep = { out_point: { tx_hash: TX_HASH, index: OUT_INDEX }, dep_type: 'code' };
  const secp256k1Dep = { out_point: { tx_hash: '0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c', index: '0x0' }, dep_type: 'dep_group' };

  const rawTx = {
    version: '0x0',
    cell_deps: [secp256k1Dep, cellDep],
    header_deps: [],
    inputs: cells.map(c => ({ previous_output: { tx_hash: c.outPoint.txHash, index: c.outPoint.index }, since: '0x0' })),
    outputs: [{
      capacity: `0x${recoverCapacity.toString(16)}`,
      lock: { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      type: null,
    }],
    outputs_data: ['0x'],
    witnesses: cells.map(() => '0x'),
  };

  return { rawTx, recoveredCkb: (Number(recoverCapacity) / 1e8).toFixed(4) + ' CKB' };
}

// ─── READ FILE ────────────────────────────────────────────────────────────────

export async function readFileFromChain(
  lockScript: Script,
  fileId: string,
): Promise<{ content: Uint8Array; chunks: number; mimeType?: string } | null> {
  const cells = await findCkbfsCells(lockScript, fileId);
  if (cells.length === 0) return null;

  // Sort by chunk index
  const sorted = [...cells].sort((a, b) => {
    try {
      const da = decodeCellData(a.data);
      const db = decodeCellData(b.data);
      return da.chunkIndex - db.chunkIndex;
    } catch { return 0; }
  });

  const parts: Uint8Array[] = sorted.map(c => {
    const decoded = decodeCellData(c.data);
    return decoded.content;
  });

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const content = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) { content.set(part, offset); offset += part.length; }

  return { content, chunks: sorted.length };
}

// ─── LIST USER FILES ──────────────────────────────────────────────────────────

export async function listUserFiles(lockScript: Script): Promise<Array<{ fileId: string; chunks: number; totalSize: number; totalCapacity: string; outPoints: OutPoint[] }>> {
  const result = (await rpc('get_cells', [
    {
      script: { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      script_type: 'lock',
      filter: { script: { code_hash: CODE_HASH, hash_type: 'data1', args: '0x' } },
    },
    'asc',
    '0x100',
  ])) as { objects: Array<{ out_point: { tx_hash: string; index: string }; output: { capacity: string; type?: { args: string } }; output_data: string }> };

  const fileMap = new Map<string, { chunks: number; totalSize: number; totalCapacity: bigint; outPoints: OutPoint[] }>();

  for (const c of result.objects) {
    if (!c.output.type) continue;
    try {
      const { fileId } = decodeTypeArgs(c.output.type.args);
      const decoded = decodeCellData(c.output_data);
      const entry = fileMap.get(fileId) ?? { chunks: 0, totalSize: 0, totalCapacity: 0n, outPoints: [] };
      entry.chunks++;
      entry.totalSize += decoded.content.length;
      entry.totalCapacity += BigInt(c.output.capacity);
      entry.outPoints.push({ txHash: c.out_point.tx_hash, index: c.out_point.index });
      fileMap.set(fileId, entry);
    } catch { /* skip malformed */ }
  }

  return Array.from(fileMap.entries()).map(([fileId, v]) => ({
    fileId,
    chunks: v.chunks,
    totalSize: v.totalSize,
    totalCapacity: `0x${v.totalCapacity.toString(16)}`,
    outPoints: v.outPoints,
  }));
}
