/**
 * tx/consumeFile.js — CKBFS Consume (Destroy) File Cell Orchestrator
 *
 * Thin orchestrator for the DESTROY lifecycle:
 *   1. Build wallet
 *   2. Assert indexer is synced
 *   3. Build raw transaction (TxBuilder — fetches and destroys all chunks)
 *   4. Sign transaction
 *   5. Send transaction
 *   6. Optionally wait for confirmation
 *
 * On-chain rules enforced by Type Script [D1]:
 *   - At least one input's lock hash == owner_lock_hash from args
 *   (The owner's secp256k1 input automatically satisfies D1)
 */

import { Wallet } from '../wallet/Wallet.js';
import { buildConsumeTx } from '../builder/TxBuilder.js';
import { signTransaction } from '../executor/Signer.js';
import { sendTransaction } from '../executor/Sender.js';
import { waitForCommit } from '../executor/Confirmer.js';
import { assertSynced } from '../executor/IndexerSync.js';

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Consume (destroy) all CKBFS cells for a given file.
 * The stored CKB capacity is returned to the owner's address minus fee.
 *
 * @param {object}  params
 * @param {string}            params.fileId            - 0x-prefixed 32-byte file ID.
 * @param {string}            [params.ownerPrivateKey] - Falls back to process.env.PRIVATE_KEY.
 * @param {bigint}            [params.feeRate]         - Shannons per 1000 bytes.
 * @param {boolean}           [params.waitForConfirm]  - Poll until committed (default false).
 * @param {boolean}           [params.dryRun]          - Build+sign but do NOT send.
 * @returns {Promise<{
 *   txHash:            string|null,
 *   fileId:            string,
 *   chunksConsumed:    number,
 *   capacityRecovered: bigint,
 * }>}
 */
export async function consumeFileCells({
  fileId,
  ownerPrivateKey,
  feeRate,
  waitForConfirm = false,
  dryRun = false,
}) {
  console.log(`[consumeFileCells] Starting for fileId=${fileId}…`);

  // ── 1. Resolve wallet ──────────────────────────────────────────────────────
  const wallet = ownerPrivateKey
    ? Wallet.fromPrivateKey(ownerPrivateKey)
    : Wallet.fromEnv();

  console.log(`[consumeFileCells] Wallet address: ${wallet.address}`);

  // ── 2. Assert indexer is synced ───────────────────────────────────────────
  await assertSynced();
  console.log('[consumeFileCells] Indexer synced ✓');

  // ── 3. Build raw transaction ───────────────────────────────────────────────
  const { rawTx, signingInputs, chunksConsumed, capacityRecovered } = await buildConsumeTx({
    fileId,
    wallet,
    feeRate,
  });

  const recoveredCkb = (Number(capacityRecovered) / 1e8).toFixed(4);
  console.log(
    `[consumeFileCells] Consuming ${chunksConsumed} chunk(s), ` +
      `recovering ~${recoveredCkb} CKB`
  );

  // ── 4. Dry run ─────────────────────────────────────────────────────────────
  if (dryRun) {
    console.log('[consumeFileCells] [dry-run] Skipping sign + send.');
    return { txHash: null, fileId, chunksConsumed, capacityRecovered, rawTx };
  }

  // ── 5. Sign ────────────────────────────────────────────────────────────────
  const signedTx = signTransaction(rawTx, signingInputs, wallet);
  console.log('[consumeFileCells] Transaction signed ✓');

  // ── 6. Send ────────────────────────────────────────────────────────────────
  const txHash = await sendTransaction(signedTx);
  console.log(`[consumeFileCells] ✅ Submitted: ${txHash}`);
  console.log(`[consumeFileCells] ✅ Recovered ~${recoveredCkb} CKB`);

  // ── 7. Confirm ─────────────────────────────────────────────────────────────
  if (waitForConfirm) {
    await waitForCommit(txHash);
  }

  return { txHash, fileId, chunksConsumed, capacityRecovered };
}
