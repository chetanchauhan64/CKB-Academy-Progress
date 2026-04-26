/**
 * executor/IndexerSync.js — Indexer Synchronisation Guard
 *
 * Uses the CKB node's built-in indexer tip (getIndexerTip) and chain tip
 * (getTipBlockNumber) — both available via the same RPC endpoint.
 * This avoids the need for a separate indexer service.
 */

import { RPC } from '@ckb-lumos/lumos';
import { CKB_RPC_URL } from '../config.js';
import { IndexerNotSyncedError, NetworkError } from '../utils/errors.js';

const MAX_LAG = 5; // blocks

let _rpc = null;
function getRpc() {
  if (!_rpc) _rpc = new RPC(CKB_RPC_URL);
  return _rpc;
}

/**
 * Assert that the indexer is within MAX_LAG blocks of the chain tip.
 * @param {number} [maxLag]
 * @returns {Promise<{ chainTip: bigint, indexerTip: bigint, lag: bigint }>}
 */
export async function assertSynced(maxLag = MAX_LAG) {
  const [chainTip, indexerTip] = await Promise.all([
    fetchChainTip(),
    fetchIndexerTip(),
  ]);

  const lag = chainTip - indexerTip;

  if (lag > BigInt(maxLag)) {
    throw new IndexerNotSyncedError(chainTip, indexerTip, maxLag);
  }

  return { chainTip, indexerTip, lag };
}

/**
 * Get sync status without throwing.
 */
export async function getSyncStatus(maxLag = MAX_LAG) {
  try {
    const [chainTip, indexerTip] = await Promise.all([
      fetchChainTip(),
      fetchIndexerTip(),
    ]);
    const lag = chainTip - indexerTip;
    return { chainTip, indexerTip, lag, synced: lag <= BigInt(maxLag) };
  } catch (err) {
    return { chainTip: 0n, indexerTip: 0n, lag: 0n, synced: false, error: err.message };
  }
}

async function fetchChainTip() {
  try {
    const tipHex = await getRpc().getTipBlockNumber();
    return BigInt(tipHex);
  } catch (err) {
    throw new NetworkError(`getTipBlockNumber failed: ${err.message}`, CKB_RPC_URL, 'get_tip_block_number', err);
  }
}

async function fetchIndexerTip() {
  try {
    const tip = await getRpc().getIndexerTip();
    return BigInt(tip?.blockNumber ?? 0);
  } catch (err) {
    // Fall back to chain tip if getIndexerTip is not available
    // (some nodes don't expose this; assume synced)
    console.warn(`  ⚠️  getIndexerTip unavailable: ${err.message}. Assuming synced.`);
    return await fetchChainTip();
  }
}
