/**
 * executor/Sender.js — Transaction Broadcaster
 *
 * Submits a signed transaction to the CKB node via RPC and normalises
 * all known rejection errors into typed SDK errors.
 *
 * CKB RPC `send_transaction` returns either:
 *   - Success: the tx hash (0x-prefixed)
 *   - Error: JSON-RPC error object with code and message
 *
 * Known rejection codes from the CKB node:
 *   -1107  PoolRejectedTransactionByOutputsValidator — output capacity too low
 *   -1111  PoolRejectedDuplicatedTransaction         — already in mempool
 *   -1116  PoolRejectedTransactionByMinFeeRate       — fee too low
 *   -301   TransactionFailedToResolve                — input cell not found / already spent
 *   -302   TransactionFailedToVerify                 — script verification failed
 */

import { RPC } from '@ckb-lumos/lumos';
import { CKB_RPC_URL } from '../config.js';
import {
  TransactionRejectedError,
  NetworkError,
} from '../utils/errors.js';

// ── Singleton RPC ──────────────────────────────────────────────────────────────

let _rpc = null;
export function getRpc() {
  if (!_rpc) _rpc = new RPC(CKB_RPC_URL);
  return _rpc;
}

// ── Known RPC error codes ──────────────────────────────────────────────────────
const REJECTION_CODES = new Set([-1107, -1111, -1116, -301, -302]);

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Send a signed transaction to the CKB node.
 *
 * @param {object} signedTx - Fully signed CKB transaction object.
 * @returns {Promise<string>} Transaction hash (0x-prefixed).
 * @throws {TransactionRejectedError} for node-level rejections.
 * @throws {NetworkError} for connection / timeout errors.
 */
export async function sendTransaction(signedTx) {
  const rpc = getRpc();

  // Normalise the transaction format for the RPC:
  // - All hex numbers must be 0x-prefixed strings
  // - capacity must be a hex string (not BigInt)
  const normalised = normaliseForRpc(signedTx);

  let txHash;
  try {
    txHash = await rpc.sendTransaction(normalised, 'passthrough');
  } catch (err) {
    // JSON-RPC errors have a `code` field
    const code = err?.code ?? err?.data?.code;
    const msg = err?.message ?? String(err);

    if (REJECTION_CODES.has(code)) {
      throw new TransactionRejectedError('(pending)', msg, err);
    }

    // Network / connection errors
    throw new NetworkError(
      `sendTransaction failed: ${msg}`,
      CKB_RPC_URL,
      'send_transaction',
      err
    );
  }

  return txHash;
}

// ── Internal: RPC Format Normalisation ───────────────────────────────────────

/**
 * Convert a raw tx object to the format expected by the CKB JSON-RPC.
 * - capacity: BigInt → hex string
 * - index: number → hex string
 * - hashType: camelCase might need normalisation (Lumos handles this, but we're explicit)
 */
function normaliseForRpc(tx) {
  return {
    version: tx.version,
    cellDeps: tx.cellDeps.map((dep) => ({
      outPoint: {
        txHash: dep.outPoint.txHash,
        index: ensureHex(dep.outPoint.index),
      },
      depType: dep.depType,
    })),
    headerDeps: tx.headerDeps ?? [],
    inputs: tx.inputs.map((inp) => ({
      previousOutput: {
        txHash: inp.previousOutput.txHash,
        index: ensureHex(inp.previousOutput.index),
      },
      since: inp.since,
    })),
    outputs: tx.outputs.map((out) => ({
      capacity: ensureHex(out.capacity),
      lock: normaliseScript(out.lock),
      type: out.type ? normaliseScript(out.type) : null,
    })),
    outputsData: tx.outputsData,
    witnesses: tx.witnesses,
  };
}

function ensureHex(value) {
  if (typeof value === 'bigint') return '0x' + value.toString(16);
  if (typeof value === 'number') return '0x' + value.toString(16);
  if (typeof value === 'string' && !value.startsWith('0x')) return '0x' + value;
  return value;
}

function normaliseScript(script) {
  return {
    codeHash: script.codeHash,
    hashType: script.hashType,
    args: script.args,
  };
}
