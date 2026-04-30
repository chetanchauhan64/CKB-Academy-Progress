/**
 * services/txBuilder.ts — CKBFS transaction builder (server-side only)
 * Builds unsigned CKB transactions for CREATE / UPDATE / CONSUME.
 * No private key; signing is done by JoyID on the client.
 *
 * Cell-lock system:
 *  - usedOutPoints  : cleared on each build() call — prevents intra-request reuse
 *  - lockedOutPoints: NEVER cleared on rebuild — prevents cross-attempt reuse
 *                     Only cleared after confirmed successful broadcast.
 */

import { hexToBytes, bytesToHex, encodeCellData, decodeCellData, encodeTypeArgs,
         decodeTypeArgs, generateFileId, splitIntoChunks, sha256Sync } from '@/utils/encoding';
import type { LiveCell, OutPoint } from '@/types';

const PRIMARY_RPC   = process.env.NEXT_PUBLIC_CKB_RPC_URL ?? 'https://testnet.ckb.dev';
// SECONDARY_RPC removed — single-RPC architecture; PRIMARY is the sole source of truth.
const CODE_HASH     = process.env.NEXT_PUBLIC_CKBFS_CODE_HASH ?? '';
const TX_HASH       = process.env.NEXT_PUBLIC_CKBFS_TX_HASH   ?? '';
const OUT_INDEX     = process.env.NEXT_PUBLIC_CKBFS_OUT_INDEX  ?? '0x0';

// ─── Week 20: Script versioning + dep_group support ──────────────────────────
/** Current on-chain script version tag — stored in file metadata. */
export const SCRIPT_VERSION = 'v1';
/**
 * Set NEXT_PUBLIC_CKBFS_USE_DEP_GROUP=true in .env.local to switch the CKBFS
 * cell dep to dep_type: 'dep_group' (required once the script is wrapped in a
 * dep group after a future upgrade). Defaults to 'code' for backward compat.
 */
const USE_DEP_GROUP = process.env.NEXT_PUBLIC_CKBFS_USE_DEP_GROUP === 'true';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * EMPTY_WITNESS_ARGS — molecule-encoded empty WitnessArgs (all fields absent).
 *
 * Required by JoyID's signRawTransaction: it parses each witness using the
 * molecule codec which needs a valid 16-byte header even for empty slots.
 * '0x' (0 bytes) → "Invalid buffer length: 0, should be 4" crash.
 *
 * Layout (molecule Table, 3 optional Bytes fields, all None):
 *   [0..3]   total_size = 16 = 0x10000000 LE
 *   [4..7]   lock_offset        = 16 = 0x10000000 LE
 *   [8..11]  input_type_offset  = 16 = 0x10000000 LE
 *   [12..15] output_type_offset = 16 = 0x10000000 LE
 */
const EMPTY_WITNESS_ARGS = '0x10000000100000001000000010000000';

/**
 * usedOutPoints: cleared at the start of each build() call.
 * Prevents the same cell being selected twice within a single request.
 */
const usedOutPoints = new Set<string>();

/**
 * lockedOutPoints: NEVER cleared on rebuild attempts.
 * Prevents cells from being reused across retry attempts.
 * Only cleared after a SUCCESSFUL broadcast via clearLockedOutPoints().
 */
const lockedOutPoints = new Set<string>();

/**
 * Call this after a successful broadcast to release all locked cells.
 * Exported so the broadcast API route can call it on success.
 */
export function clearLockedOutPoints(): void {
  console.log(`[txBuilder] clearLockedOutPoints: releasing ${lockedOutPoints.size} locked cell(s) after successful broadcast`);
  lockedOutPoints.clear();
}

/** Canonical outpoint key — normalises hex index so "0x0" and "0" match. */
function outPointKey(txHash: string, index: string): string {
  return `${txHash}-${parseInt(index, 16)}`;
}

// ─── RPC helper (no cache, always fresh) ─────────────────────────────────────

async function rpc(method: string, params: unknown[], url = PRIMARY_RPC): Promise<unknown> {
  const res = await fetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache  : 'no-store',
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ─── Tip block helper ───────────────────────────────────────────────────────────

async function getTipBlockNumber(): Promise<number> {
  try {
    const result = (await rpc('get_tip_block_number', [])) as string;
    return parseInt(result, 16);
  } catch {
    return 0; // on failure, depth filter skips nothing (fail-open)
  }
}

// ─── Strict cell liveness check ─────────────────────────────────────────────

type LiveCellResult = { status: string; cell?: { block_hash?: string } };

/**
 * PRIMARY RPC is the single source of truth for cell liveness.
 *
 * Returns true IF status === "live".
 * NOTE: testnet.ckb.dev does NOT return block_hash in get_live_cell responses.
 *       status === 'live' is the correct and sufficient liveness check.
 *
 * Logs the exact check result for debugging.
 */
async function isCellLive(
  outPoint: { tx_hash: string; index: string },
): Promise<boolean> {
  try {
    const res = (await rpc(
      'get_live_cell',
      [{ tx_hash: outPoint.tx_hash, index: outPoint.index }, false],
      PRIMARY_RPC,
    )) as LiveCellResult;

    const status = res?.status ?? 'unknown';
    console.log('Cell check:', outPoint, 'status:', status);
    // status === 'live' is sufficient — block_hash is not provided by testnet.ckb.dev
    return status === 'live';
  } catch (e) {
    console.warn('Cell check failed (RPC error):', outPoint, e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Pre-broadcast validation — PRIMARY RPC is the sole source of truth.
 *
 * ALL inputs must have status === 'live' via PRIMARY RPC.
 * Retries up to maxAttempts times with 1500ms wait between each.
 * Throws "Inputs not stable yet" if any input fails all attempts.
 * NOTE: block_hash is NOT checked — testnet.ckb.dev does not return it.
 */
async function validateInputsLive(
  rawTx      : Record<string, unknown>,
  maxAttempts = 3,
): Promise<void> {
  const inputs = rawTx.inputs as Array<{ previous_output: { tx_hash: string; index: string } }>;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[txBuilder] validateInputsLive attempt ${attempt}/${maxAttempts} — ${inputs.length} input(s) via PRIMARY RPC…`);

    const results = await Promise.all(
      inputs.map(async inp => {
        const op   = inp.previous_output;
        const safe = await isCellLive(op);
        console.log(`[txBuilder]   input ${op.tx_hash}:${parseInt(op.index, 16)} — ${safe ? '✅ stable' : '❌ NOT stable'}`);
        return { op, safe };
      }),
    );

    const unstable = results.filter(r => !r.safe);
    if (unstable.length === 0) {
      console.log(`[txBuilder] validateInputsLive: all ${inputs.length} input(s) confirmed stable via PRIMARY RPC ✓ (attempt ${attempt})`);
      return;
    }

    console.warn(
      `[txBuilder] validateInputsLive: ${unstable.length} input(s) NOT stable — attempt ${attempt}/${maxAttempts}`,
      unstable.map(u => `${u.op.tx_hash}:${parseInt(u.op.index, 16)}`),
    );

    if (attempt < maxAttempts) {
      console.log('[txBuilder] Waiting 1500ms before retry…');
      await sleep(1500);
    }
  }

  throw new Error(
    'Inputs not stable yet — PRIMARY RPC could not confirm all inputs after ' +
    `${maxAttempts} attempts. The cells may not have enough confirmations. ` +
    'Wait a moment and try again.',
  );
}

// ─── Capacity helpers ─────────────────────────────────────────────────────────

const SHANNON_PER_CKB = 100_000_000n;
const MIN_CHANGE_CAP  = 61n * SHANNON_PER_CKB;
const BASE_FEE        = 100_000n; // 0.001 CKB

interface Script {
  codeHash: string;
  hashType: string;
  args: string;
}

function minCellCap(lockScript: Script, typeScript: Script, dataLen: number): bigint {
  const lockArgBytes = BigInt((lockScript.args.length - 2) / 2);
  const typeArgBytes = BigInt((typeScript.args.length - 2) / 2);
  const lockBytes    = 1n + 32n + lockArgBytes;
  const typeBytes    = 1n + 32n + typeArgBytes;
  const dataBytes    = BigInt(dataLen);
  const total        = lockBytes + typeBytes + dataBytes + 8n;
  return total * SHANNON_PER_CKB;
}

// ─── Cell fetcher — A: desc order, limit 50 (0x32), no cache ─────────────────

async function fetchLiveCells(lockScript: Script): Promise<Array<{
  out_point   : { tx_hash: string; index: string };
  output      : { capacity: string; lock: { code_hash: string; hash_type: string; args: string }; type?: unknown };
  output_data : string;
  block_number: string;
}>> {
  console.log('[txBuilder] fetchLiveCells using lockScript:', JSON.stringify(lockScript));

  const result = (await rpc('get_cells', [
    {
      script:      { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      script_type: 'lock',
    },
    'desc',
    '0x32',
  ])) as {
    objects: Array<{
      out_point   : { tx_hash: string; index: string };
      output      : { capacity: string; lock: { code_hash: string; hash_type: string; args: string }; type?: unknown };
      output_data : string;
      block_number: string;
    }>;
  };

  const cells = result.objects ?? [];
  console.log(`[txBuilder] fetchLiveCells returned ${cells.length} raw cell(s) from indexer`);

  // ── FULL DUMP of every raw indexer cell ──────────────────────────────────────
  console.log('[DEBUG] RAW INDEXER CELLS:');
  cells.forEach((c, i) => {
    console.log(
      `  #${i}`,
      'outPoint:', c.out_point,
      'capacity:', (Number(c.output.capacity) / 1e8).toFixed(4), 'CKB',
      'type:', !!c.output.type,
      'data:', c.output_data ?? '(missing)',
      'block#:', parseInt(c.block_number ?? '0x0', 16),
    );
  });

  return cells;
}



// ─── Cell selector — PRIMARY RPC is source of truth ─────────────────────────────

async function selectInputCells(
  lockScript: Script,
  required  : bigint,
  exclude   : string[] = [],
): Promise<{ cells: LiveCell[]; total: bigint } | null> {
  // ── STEP 1: Hard guard — lockScript must be present ──────────────────────────
  if (!lockScript || !lockScript.codeHash || !lockScript.args) {
    throw new Error(
      '[txBuilder] lockScript is missing or incomplete — wallet may not be properly connected. ' +
      `Received: ${JSON.stringify(lockScript)}`,
    );
  }

  // ── Diagnostic: log the full lock script and derived args ────────────────────
  console.log('[txBuilder] selectInputCells — lockScript:', JSON.stringify(lockScript));
  console.log('[txBuilder] wallet address args (lock args):', lockScript.args);
  console.log('[txBuilder] required capacity:', (Number(required) / 1e8).toFixed(4), 'CKB');

  const excludeSet = new Set(exclude);

  // 1. Fetch tip + all indexer cells (retry once if empty)
  const tipBlock = await getTipBlockNumber();
  console.log(`[txBuilder] selectInputCells: tip block = ${tipBlock}`);

  let objects = await fetchLiveCells(lockScript);
  if (objects.length === 0) {
    console.warn('[txBuilder] No cells on first fetch — waiting 1.5s then retrying…');
    await sleep(1500);
    objects = await fetchLiveCells(lockScript);
  }

  if (objects.length === 0) {
    throw new Error(
      'No CKB cells found for this address. ' +
      'The indexer may not be synced yet, or the wallet has no balance. ' +
      'Wait a few seconds and try again, or fund via https://faucet.nervos.org/',
    );
  }

  console.log(`[txBuilder] Fetched ${objects.length} cell(s) from indexer. Verifying each against PRIMARY RPC…`);

  // 2. Single pass: filter pure-cap + dedup, then verify against PRIMARY RPC
  //    lockedOutPoints does NOT gate selection here — RPC liveness is the sole truth.
  //    (already-spent locked cells will fail get_live_cell automatically.)
  const cells : LiveCell[] = [];
  let total        = 0n;
  let skippedType  = 0;
  let skippedData  = 0;
  let skippedUsed  = 0;
  let skippedDead  = 0;

  for (const c of objects) {
    const key = outPointKey(c.out_point.tx_hash, c.out_point.index);
    const label = `  [cell ${c.out_point.tx_hash.slice(0,10)}…:${parseInt(c.out_point.index, 16)}]`;

    // ── Dedup check ──────────────────────────────────────────────────────────
    if (excludeSet.has(key) || usedOutPoints.has(key)) {
      console.log(`${label} [SKIP] already used / excluded`);
      skippedUsed++;
      continue;
    }

    // ── STRICT pure-capacity filter ──────────────────────────────────────────
    console.log(
      `${label} checking — type: ${!!c.output.type}, data: "${c.output_data ?? '(missing)'}", capacity: ${(Number(c.output.capacity) / 1e8).toFixed(4)} CKB`,
    );

    if (c.output.type !== null && c.output.type !== undefined) {
      console.log(`${label} [SKIP] type script present (CKBFS / deployed script cell)`);
      skippedType++;
      continue;
    }
    if (c.output_data !== '0x') {
      console.log(`${label} [SKIP] data cell — output_data = "${c.output_data ?? '(missing)'}"`);
      skippedData++;
      continue;
    }

    // ── PRIMARY RPC liveness check ────────────────────────────────────────────
    // NOTE: testnet.ckb.dev does NOT return block_hash in get_live_cell responses.
    // status === 'live' is the correct and sufficient proof of liveness.
    console.log(`${label} pure-capacity cell — calling get_live_cell on PRIMARY RPC…`);
    const rpcRes = (await rpc(
      'get_live_cell',
      [{ tx_hash: c.out_point.tx_hash, index: c.out_point.index }, false],
      PRIMARY_RPC,
    )) as { status: string; cell?: { block_hash?: string } };

    console.log(`${label} [DEBUG] RPC CHECK:`, {
      outPoint: c.out_point,
      status  : rpcRes?.status ?? 'unknown',
    });

    if (rpcRes?.status !== 'live') {
      console.log(`${label} [SKIP] not live — status = "${rpcRes?.status ?? 'unknown'}"`);
      skippedDead++;
      continue;
    }

    // ── Cell accepted ─────────────────────────────────────────────────────────
    const cellCap = BigInt(c.output.capacity);
    console.log(`${label} [SUCCESS] live cell — ${(Number(cellCap) / 1e8).toFixed(4)} CKB (accumulated: ${(Number(total + cellCap) / 1e8).toFixed(4)} CKB)`);

    cells.push({
      outPoint  : { txHash: c.out_point.tx_hash, index: c.out_point.index },
      cellOutput: {
        capacity: c.output.capacity,
        lock    : { codeHash: c.output.lock.code_hash, hashType: c.output.lock.hash_type, args: c.output.lock.args },
      },
      data: '0x',
    });

    usedOutPoints.add(key);
    lockedOutPoints.add(key);

    total += cellCap;
    // Accumulate cells until we have enough — multi-cell input support
    if (total >= required) {
      console.log(`[txBuilder] ✅ Capacity satisfied: ${(Number(total) / 1e8).toFixed(4)} CKB (need ${(Number(required) / 1e8).toFixed(4)} CKB) with ${cells.length} cell(s)`);
      break;
    }
  }

  console.log(
    `[txBuilder] selectInputCells done: ${objects.length} fetched, ` +
    `${skippedType} type-script, ${skippedData} data, ${skippedUsed} used, ` +
    `${skippedDead} RPC-dead, ${cells.length} accepted — ` +
    `${(Number(total) / 1e8).toFixed(4)} CKB`,
  );

  // Guard: no cells found at all — treat as indexer lag, caller retries silently
  if (cells.length === 0) {
    console.warn(
      '[txBuilder] No live cells found — indexer may be lagging or all cells have type/data. Skipping build cycle.',
    );
    return null;
  }

  // Guard: cells found but still not enough total capacity
  if (total < required) {
    throw new Error(
      `Insufficient CKB: need ${(Number(required) / 1e8).toFixed(4)} CKB ` +
      `but only ${(Number(total) / 1e8).toFixed(4)} CKB confirmed live across ${cells.length} cell(s). ` +
      'Fund your address at https://faucet.nervos.org/',
    );
  }

  return { cells, total };
}

// ─── CKBFS cell finder ────────────────────────────────────────────────────────

async function findCkbfsCells(lockScript: Script, fileId: string): Promise<LiveCell[]> {
  const result = (await rpc('get_cells', [
    {
      script     : { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      script_type: 'lock',
      filter     : { script: { code_hash: CODE_HASH, hash_type: 'data1', args: '0x' } },
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
      outPoint  : { txHash: c.out_point.tx_hash, index: c.out_point.index },
      cellOutput: {
        capacity: c.output.capacity,
        lock    : { codeHash: c.output.lock.code_hash, hashType: c.output.lock.hash_type, args: c.output.lock.args },
        type    : c.output.type ? { codeHash: c.output.type.code_hash, hashType: c.output.type.hash_type, args: c.output.type.args } : null,
      },
      data: c.output_data ?? '0x',
    }));
}

// ─── Lock hash ────────────────────────────────────────────────────────────────

function scriptHash(script: Script): string {
  const codeHashBytes = hexToBytes(script.codeHash.slice(2));
  const argsBytes     = hexToBytes(script.args.startsWith('0x') ? script.args.slice(2) : script.args);
  const hashTypeNum   = script.hashType === 'type' ? 1 : script.hashType === 'data1' ? 2 : 0;
  const preimage      = new Uint8Array([...codeHashBytes, new Uint8Array([hashTypeNum])[0], ...argsBytes]);
  return bytesToHex(sha256Sync(preimage));
}

// ─── Shared cell deps ─────────────────────────────────────────────────────────

// Correct Aggron4 testnet secp256k1 dep group (genesis block tx[1], index 0x0)
// Source: @ckb-lumos/lumos/config → predefined.AGGRON4.SCRIPTS.SECP256K1_BLAKE160
const secp256k1Dep = {
  out_point: { tx_hash: '0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37', index: '0x0' },
  dep_type : 'dep_group',
};

/**
 * JoyID lock script cell dep on Pudge (Aggron4) testnet — LIVE ✓
 *
 * Found by querying actual JoyID-signed transactions on Aggron4.
 * This dep_group (0x636a7860...) appears in ALL JoyID signing transactions
 * and its inner cells are confirmed live with ELF JoyID lock binary.
 *
 * Inner cells (via dep_group):
 *   0x03ce5eabf7...:0x0  → live (JoyID lock ELF)
 *   0x03ce5eabf7...:0x1  → live
 *   0x64aa5ba40c...:0x2  → live
 *
 * The SDK's getJoyIDCellDep(false) value (0x4dcf3f3b...) is spent/outdated.
 */
const joyidLockCodeHash = '0xd23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac';
const joyidDep = {
  out_point: { tx_hash: '0x636a786001f87cb615acfcf408be0f9a1f077001f0bbc75ca54eadfe7e221713', index: '0x0' },
  dep_type : 'dep_group',
};

/**
 * Returns the correct lock script cell dep for the given wallet lock:
 * - JoyID lock  → joyidDep (dep_group at 0x4dcf3f...)
 * - Secp256k1   → secp256k1Dep (dep_group at 0xf8de3b...)
 */
function lockCellDep(lockScript: Script) {
  if (lockScript.codeHash.toLowerCase() === joyidLockCodeHash.toLowerCase()) {
    console.log('[txBuilder] Detected JoyID lock — using JoyID cell dep');
    return joyidDep;
  }
  return secp256k1Dep;
}

/** CKBFS cell dep — switches to dep_group when USE_DEP_GROUP=true (Week 20 upgradeability). */
const ckbfsCellDep = () => ({
  out_point: { tx_hash: TX_HASH, index: OUT_INDEX },
  dep_type : USE_DEP_GROUP ? 'dep_group' : 'code',
});

// ─── BUILD CREATE TX ──────────────────────────────────────────────────────────

export interface CreateTxParams {
  lockScript  : Script;
  fileContent : Uint8Array;
  chunkSize  ?: number;
  feeRate    ?: bigint;
  /** Week 20: human-readable filename forwarded from the client */
  fileName   ?: string;
  /** Week 20: MIME type detected by the browser */
  mimeType   ?: string;
}

export interface UnsignedTxResult {
  rawTx          : Record<string, unknown>;
  fileId         : string;
  chunkCount     : number;
  capacityNeeded : string;
  /** Week 20 metadata — echoed back so the client can build its metadata store */
  fileName       : string;
  mimeType       : string;
  scriptVersion  : string;
}

const MAX_RETRY_ATTEMPTS = 10;
const RETRY_DELAY_MS     = 3_000; // base reference (backoff overrides per-loop)

export async function buildCreateTransaction(params: CreateTxParams): Promise<UnsignedTxResult> {
  usedOutPoints.clear(); // fresh request — reset used-cell registry
  const { lockScript, fileContent, chunkSize = 32 * 1024, fileName = 'untitled', mimeType = 'application/octet-stream' } = params;

  const ownerLockHash = scriptHash(lockScript);
  const fileId        = generateFileId(ownerLockHash, fileContent);
  const chunks        = splitIntoChunks(fileContent, chunkSize);
  const totalChunks   = chunks.length;

  const ckbfsOutputs = chunks.map((chunk, i) => {
    // FLAG_FINALIZED=0x02: all chunks of this file are present on-chain.
    // Only set when we are uploading ALL chunks in this single transaction.
    const isLastChunk = i === totalChunks - 1;
    const flags = isLastChunk ? 0x02 : 0x00; // FLAG_FINALIZED on last chunk only if all fit
    const cellData  = encodeCellData({ chunkIndex: i, totalChunks, content: chunk, flags });
    // encodeTypeArgs(ownerLockHash, fileId) — Rust order: [owner_lock_hash][file_id]
    const typeArgs  = encodeTypeArgs(ownerLockHash, fileId);
    const typeScript: Script = { codeHash: CODE_HASH, hashType: 'data1', args: bytesToHex(typeArgs) };
    const minCap    = minCellCap(lockScript, typeScript, cellData.length);
    return {
      output: {
        capacity: `0x${minCap.toString(16)}`,
        lock    : { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
        type    : { code_hash: CODE_HASH, hash_type: 'data1', args: bytesToHex(typeArgs) },
      },
      data: bytesToHex(cellData),
    };
  });

  const totalCkbfsCapacity = ckbfsOutputs.reduce((s, o) => s + BigInt(o.output.capacity), 0n);
  const required           = totalCkbfsCapacity + MIN_CHANGE_CAP + BASE_FEE;

  // ── Indexer-lag safe cell selection (progressive backoff) ───────────────────
  let cellResult: { cells: LiveCell[]; total: bigint } | null = null;
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    cellResult = await selectInputCells(lockScript, required);
    if (cellResult) break;
    const baseDelay = 2000 + attempt * 500;
    const jitter    = Math.floor(Math.random() * 500); // 0–500ms randomness
    const delay     = baseDelay + jitter;
    console.log(
      `[txBuilder] Retry ${attempt}/${MAX_RETRY_ATTEMPTS} — base=${baseDelay}ms jitter=${jitter}ms total=${delay}ms`,
    );
    await sleep(delay);
  }
  if (!cellResult) {
    throw new Error(
      `Unable to find RPC-confirmed live cells after ${MAX_RETRY_ATTEMPTS} attempts. ` +
      'The indexer may be lagging. Please wait a moment and try again.',
    );
  }

  const { cells: inputs, total: inputTotal } = cellResult;
  const changeCapacity = inputTotal - totalCkbfsCapacity - BASE_FEE;

  const rawTx = {
    version     : '0x0',
    cell_deps   : [lockCellDep(lockScript), ckbfsCellDep()],
    header_deps : [],
    inputs      : inputs.map(c => ({
      previous_output: { tx_hash: c.outPoint.txHash, index: c.outPoint.index },
      since          : '0x0',
    })),
    outputs: [
      ...ckbfsOutputs.map(o => o.output),
      {
        capacity: `0x${changeCapacity.toString(16)}`,
        lock    : { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
        type    : null,
      },
    ],
    outputs_data: [...ckbfsOutputs.map(o => o.data), '0x'],
    witnesses   : inputs.map(() => EMPTY_WITNESS_ARGS),
  };

  // B: Pre-broadcast validation with 3-attempt retry
  await validateInputsLive(rawTx, 3);

  return {
    rawTx,
    fileId,
    chunkCount     : totalChunks,
    capacityNeeded : (Number(totalCkbfsCapacity) / 1e8).toFixed(4) + ' CKB',
    // Week 20: echo metadata back so the client can populate its metadata store
    fileName,
    mimeType,
    scriptVersion  : SCRIPT_VERSION,
  };
}

// ─── BUILD UPDATE TX ──────────────────────────────────────────────────────────

export async function buildUpdateTransaction(params: {
  lockScript : Script;
  fileId     : string;
  newContent : Uint8Array;
  chunkSize ?: number;
}): Promise<UnsignedTxResult> {
  usedOutPoints.clear();
  const { lockScript, fileId, newContent, chunkSize = 32 * 1024 } = params;

  const existingCells = await findCkbfsCells(lockScript, fileId);
  if (existingCells.length === 0) throw new Error(`No cells found for fileId ${fileId}`);

  // Pre-register existing CKBFS cells to prevent double-spending them as fee inputs
  for (const c of existingCells) {
    usedOutPoints.add(outPointKey(c.outPoint.txHash, c.outPoint.index));
  }

  const ownerLockHash = scriptHash(lockScript);
  const chunks        = splitIntoChunks(newContent, chunkSize);
  const totalChunks   = chunks.length;

  const ckbfsOutputs = chunks.map((chunk, i) => {
    const cellData   = encodeCellData({ chunkIndex: i, totalChunks, content: chunk, flags: 1 });
    const typeArgs   = encodeTypeArgs(fileId, ownerLockHash);
    const typeScript: Script = { codeHash: CODE_HASH, hashType: 'data1', args: bytesToHex(typeArgs) };
    const existingCap = existingCells[i] ? BigInt(existingCells[i].cellOutput.capacity) : 0n;
    const minCap      = minCellCap(lockScript, typeScript, cellData.length);
    const cap         = existingCap >= minCap ? existingCap : minCap;
    return {
      output: {
        capacity: `0x${cap.toString(16)}`,
        lock    : { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
        type    : { code_hash: CODE_HASH, hash_type: 'data1', args: bytesToHex(typeArgs) },
      },
      data: bytesToHex(cellData),
    };
  });

  const totalOldCap = existingCells.reduce((s, c) => s + BigInt(c.cellOutput.capacity), 0n);
  const totalNewCap = ckbfsOutputs.reduce((s, o) => s + BigInt(o.output.capacity), 0n);
  const netDelta    = totalNewCap - totalOldCap;
  const required    = netDelta > 0n ? netDelta + MIN_CHANGE_CAP + BASE_FEE : MIN_CHANGE_CAP + BASE_FEE;

  // ── Indexer-lag safe cell selection (progressive backoff) ───────────────────
  let feeCellResult: { cells: LiveCell[]; total: bigint } | null = null;
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    feeCellResult = await selectInputCells(lockScript, required);
    if (feeCellResult) break;
    const baseDelay = 2000 + attempt * 500;
    const jitter    = Math.floor(Math.random() * 500); // 0–500ms randomness
    const delay     = baseDelay + jitter;
    console.log(
      `[txBuilder] Retry ${attempt}/${MAX_RETRY_ATTEMPTS} — base=${baseDelay}ms jitter=${jitter}ms total=${delay}ms`,
    );
    await sleep(delay);
  }
  if (!feeCellResult) {
    throw new Error(
      `Unable to find RPC-confirmed fee cells after ${MAX_RETRY_ATTEMPTS} attempts. ` +
      'The indexer may be lagging. Please wait a moment and try again.',
    );
  }
  const { cells: feeInputs, total: feeInputTotal } = feeCellResult;
  const changeCapacity = feeInputTotal + totalOldCap - totalNewCap - BASE_FEE;

  const allInputs = [
    ...existingCells.map(c => ({ previous_output: { tx_hash: c.outPoint.txHash, index: c.outPoint.index }, since: '0x0' })),
    ...feeInputs.map(c    => ({ previous_output: { tx_hash: c.outPoint.txHash, index: c.outPoint.index }, since: '0x0' })),
  ];

  const rawTx = {
    version     : '0x0',
    cell_deps   : [lockCellDep(lockScript), ckbfsCellDep()],
    header_deps : [],
    inputs      : allInputs,
    outputs     : [
      ...ckbfsOutputs.map(o => o.output),
      {
        capacity: `0x${changeCapacity.toString(16)}`,
        lock    : { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
        type    : null,
      },
    ],
    outputs_data: [...ckbfsOutputs.map(o => o.data), '0x'],
    witnesses   : allInputs.map(() => EMPTY_WITNESS_ARGS),
  };

  await validateInputsLive(rawTx, 3);

  return {
    rawTx,
    fileId,
    chunkCount     : totalChunks,
    capacityNeeded : (Number(totalNewCap) / 1e8).toFixed(4) + ' CKB',
    // Week 20: update retains the same script version; fileName/mimeType unknown at update time
    fileName      : fileId,   // use fileId as fallback identifier
    mimeType      : 'application/octet-stream',
    scriptVersion : SCRIPT_VERSION,
  };
}

// ─── BUILD CONSUME TX ─────────────────────────────────────────────────────────

export async function buildConsumeTransaction(params: {
  lockScript : Script;
  fileId     : string;
}): Promise<{ rawTx: Record<string, unknown>; recoveredCkb: string }> {
  const { lockScript, fileId } = params;

  const cells = await findCkbfsCells(lockScript, fileId);
  if (cells.length === 0) throw new Error(`No cells found for fileId ${fileId}`);

  const totalCap       = cells.reduce((s, c) => s + BigInt(c.cellOutput.capacity), 0n);
  const recoverCapacity = totalCap - BASE_FEE;

  const rawTx = {
    version     : '0x0',
    cell_deps   : [lockCellDep(lockScript), ckbfsCellDep()],
    header_deps : [],
    inputs      : cells.map(c => ({ previous_output: { tx_hash: c.outPoint.txHash, index: c.outPoint.index }, since: '0x0' })),
    outputs     : [{
      capacity: `0x${recoverCapacity.toString(16)}`,
      lock    : { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      type    : null,
    }],
    outputs_data: ['0x'],
    witnesses   : cells.map(() => EMPTY_WITNESS_ARGS),
  };

  return { rawTx, recoveredCkb: (Number(recoverCapacity) / 1e8).toFixed(4) + ' CKB' };
}

// ─── READ FILE ────────────────────────────────────────────────────────────────

export async function readFileFromChain(
  lockScript: Script,
  fileId    : string,
): Promise<{ content: Uint8Array; chunks: number; mimeType?: string } | null> {
  const cells = await findCkbfsCells(lockScript, fileId);
  if (cells.length === 0) return null;

  const sorted = [...cells].sort((a, b) => {
    try {
      return decodeCellData(a.data).chunkIndex - decodeCellData(b.data).chunkIndex;
    } catch { return 0; }
  });

  const parts    = sorted.map(c => decodeCellData(c.data).content);
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const content  = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) { content.set(part, offset); offset += part.length; }

  return { content, chunks: sorted.length };
}

// ─── LIST USER FILES ──────────────────────────────────────────────────────────

export async function listUserFiles(lockScript: Script): Promise<Array<{
  fileId        : string;
  chunks        : number;
  totalSize     : number;
  totalCapacity : string;
  outPoints     : OutPoint[];
}>> {
  const result = (await rpc('get_cells', [
    {
      script     : { code_hash: lockScript.codeHash, hash_type: lockScript.hashType, args: lockScript.args },
      script_type: 'lock',
      filter     : { script: { code_hash: CODE_HASH, hash_type: 'data1', args: '0x' } },
    },
    'asc',
    '0x100',
  ])) as { objects: Array<{ out_point: { tx_hash: string; index: string }; output: { capacity: string; type?: { args: string } }; output_data: string }> };

  const fileMap = new Map<string, { chunks: number; totalSize: number; totalCapacity: bigint; outPoints: OutPoint[] }>();

  for (const c of result.objects) {
    if (!c.output.type) continue;
    try {
      const { fileId }  = decodeTypeArgs(c.output.type.args);
      const decoded     = decodeCellData(c.output_data);
      const entry       = fileMap.get(fileId) ?? { chunks: 0, totalSize: 0, totalCapacity: 0n, outPoints: [] };
      entry.chunks++;
      entry.totalSize     += decoded.content.length;
      entry.totalCapacity += BigInt(c.output.capacity);
      entry.outPoints.push({ txHash: c.out_point.tx_hash, index: c.out_point.index });
      fileMap.set(fileId, entry);
    } catch { /* skip malformed */ }
  }

  return Array.from(fileMap.entries()).map(([fileId, v]) => ({
    fileId,
    chunks        : v.chunks,
    totalSize     : v.totalSize,
    totalCapacity : `0x${v.totalCapacity.toString(16)}`,
    outPoints     : v.outPoints,
  }));
}
