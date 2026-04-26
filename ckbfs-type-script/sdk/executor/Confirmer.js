/**
 * executor/Confirmer.js — Transaction Confirmation Poller
 *
 * Polls the CKB node until a submitted transaction reaches 'committed' status.
 *
 * CKB transaction lifecycle:
 *   pending → proposed → committed
 *                      ↘ rejected  (immediate terminal state)
 *
 * Strategy:
 *   - Start with 2s interval, grow toward 30s with jitter
 *   - Immediately throw on 'rejected' status (no point waiting)
 *   - Throw ConfirmationTimeoutError if deadline is exceeded
 *   - On success, return the full committed transaction object
 */

import { getRpc } from './Sender.js';
import {
  TransactionRejectedError,
  ConfirmationTimeoutError,
  NetworkError,
} from '../utils/errors.js';

// ── Configuration ──────────────────────────────────────────────────────────────

const INITIAL_POLL_MS = 2_000;     // start: 2 seconds
const MAX_POLL_MS     = 30_000;    // cap: 30 seconds
const JITTER_FRACTION = 0.2;       // ±20% random jitter
const BACKOFF_FACTOR  = 1.5;       // each step grows by 50%

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Wait for a transaction to be committed on-chain.
 *
 * @param {string} txHash            - 0x-prefixed transaction hash.
 * @param {number} [timeoutMs]       - Max wait time in ms (default: 120s).
 * @returns {Promise<object>}          The committed transaction object.
 * @throws {TransactionRejectedError} if the node rejects the tx.
 * @throws {ConfirmationTimeoutError} if timeout is reached.
 * @throws {NetworkError}             if RPC calls keep failing.
 */
export async function waitForCommit(txHash, timeoutMs = 120_000) {
  const rpc = getRpc();
  const deadline = Date.now() + timeoutMs;

  let pollMs = INITIAL_POLL_MS;
  let lastStatus = 'unknown';
  let consecutiveErrors = 0;

  console.log(`  [Confirmer] Waiting for ${txHash}…`);

  while (Date.now() < deadline) {
    // ── Poll ───────────────────────────────────────────────────────────────
    let txWithStatus;
    try {
      txWithStatus = await rpc.getTransaction(txHash);
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors > 5) {
        throw new NetworkError(
          `getTransaction failed ${consecutiveErrors} times in a row: ${err.message}`,
          'rpc',
          'get_transaction',
          err
        );
      }
      // Transient network error — back off and retry
      await sleep(pollMs);
      continue;
    }

    if (!txWithStatus) {
      // Node doesn't know about this tx yet — it may still be propagating
      lastStatus = 'not_found';
      await sleep(pollMs);
      pollMs = nextPollInterval(pollMs);
      continue;
    }

    lastStatus = txWithStatus.txStatus?.status ?? 'unknown';
    const minedBlock = txWithStatus.txStatus?.blockHash;

    switch (lastStatus) {
      case 'committed':
        console.log(`  [Confirmer] ✅ Committed in block ${minedBlock}`);
        return txWithStatus;

      case 'rejected': {
        const reason = txWithStatus.txStatus?.reason ?? 'unknown reason';
        console.error(`  [Confirmer] ❌ Rejected: ${reason}`);
        throw new TransactionRejectedError(txHash, reason);
      }

      case 'pending':
      case 'proposed':
        // Still in flight — keep waiting
        console.log(`  [Confirmer] Status: ${lastStatus} (${Math.round((deadline - Date.now()) / 1000)}s left)`);
        break;

      default:
        console.warn(`  [Confirmer] Unknown status: ${lastStatus}`);
    }

    await sleep(pollMs);
    pollMs = nextPollInterval(pollMs);
  }

  throw new ConfirmationTimeoutError(txHash, timeoutMs, lastStatus);
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Compute next poll interval with exponential backoff and jitter.
 * @param {number} current - Current interval in ms.
 * @returns {number} Next interval in ms.
 */
function nextPollInterval(current) {
  const grown = Math.min(current * BACKOFF_FACTOR, MAX_POLL_MS);
  const jitter = grown * JITTER_FRACTION * (Math.random() * 2 - 1);
  return Math.round(grown + jitter);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
