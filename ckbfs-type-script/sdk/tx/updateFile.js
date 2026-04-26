/**
 * tx/updateFile.js — CKBFS Update File Cell Orchestrator
 *
 * Thin orchestrator for the UPDATE lifecycle:
 *   1. Build wallet
 *   2. Assert indexer is synced
 *   3. Build raw transaction (TxBuilder — fetches existing cells internally)
 *   4. Sign transaction
 *   5. Send transaction
 *   6. Optionally wait for confirmation
 *
 * On-chain rules enforced by Type Script [U1–U8]:
 *   - All CREATE rules on outputs
 *   - 1:1 chunk_index pairing input↔output
 *   - Immutable cell → REJECT
 *   - args (owner + file_id) must not change
 */

import { Wallet } from '../wallet/Wallet.js';
import { buildUpdateTx } from '../builder/TxBuilder.js';
import { signTransaction } from '../executor/Signer.js';
import { sendTransaction } from '../executor/Sender.js';
import { waitForCommit } from '../executor/Confirmer.js';
import { assertSynced } from '../executor/IndexerSync.js';

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Update CKBFS file cells on Testnet (Aggron4).
 *
 * @param {object}  params
 * @param {string}            params.fileId            - 0x-prefixed 32-byte file ID to update.
 * @param {Uint8Array|Buffer} params.newFileBytes       - New raw file content.
 * @param {string}            [params.ownerPrivateKey]  - Falls back to process.env.PRIVATE_KEY.
 * @param {boolean}           [params.finalize]         - Set FLAG_FINALIZED on outputs (default true).
 * @param {bigint}            [params.feeRate]          - Shannons per 1000 bytes.
 * @param {boolean}           [params.waitForConfirm]   - Poll until committed (default false).
 * @param {boolean}           [params.dryRun]           - Build+sign but do NOT send.
 * @returns {Promise<{ txHash: string|null, fileId: string, chunkCount: number }>}
 */
export async function updateFileCells({
  fileId,
  newFileBytes,
  ownerPrivateKey,
  finalize = true,
  feeRate,
  waitForConfirm = false,
  dryRun = false,
}) {
  console.log(`[updateFileCells] Starting for fileId=${fileId}…`);

  // ── 1. Resolve wallet ──────────────────────────────────────────────────────
  const wallet = ownerPrivateKey
    ? Wallet.fromPrivateKey(ownerPrivateKey)
    : Wallet.fromEnv();

  console.log(`[updateFileCells] Wallet address: ${wallet.address}`);

  // ── 2. Assert indexer is synced ───────────────────────────────────────────
  await assertSynced();
  console.log('[updateFileCells] Indexer synced ✓');

  // ── 3. Build raw transaction ───────────────────────────────────────────────
  const { rawTx, signingInputs, chunkCount } = await buildUpdateTx({
    fileId,
    newFileBytes,
    wallet,
    finalize,
    feeRate,
  });
  console.log(`[updateFileCells] Raw tx built (${chunkCount} chunks, ${rawTx.inputs.length} inputs)`);

  // ── 4. Dry run ─────────────────────────────────────────────────────────────
  if (dryRun) {
    console.log('[updateFileCells] [dry-run] Skipping sign + send.');
    return { txHash: null, fileId, chunkCount, rawTx };
  }

  // ── 5. Sign ────────────────────────────────────────────────────────────────
  const signedTx = signTransaction(rawTx, signingInputs, wallet);
  console.log('[updateFileCells] Transaction signed ✓');

  // ── 6. Send ────────────────────────────────────────────────────────────────
  const txHash = await sendTransaction(signedTx);
  console.log(`[updateFileCells] ✅ Submitted: ${txHash}`);

  // ── 7. Confirm ─────────────────────────────────────────────────────────────
  if (waitForConfirm) {
    await waitForCommit(txHash);
  }

  return { txHash, fileId, chunkCount };
}
