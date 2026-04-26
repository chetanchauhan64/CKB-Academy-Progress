/**
 * tx/createFile.js — CKBFS Create File Cell Orchestrator
 *
 * Thin orchestrator for the CREATE lifecycle:
 *   1. Build wallet from private key
 *   2. Assert indexer is synced
 *   3. Build raw transaction (TxBuilder)
 *   4. Sign transaction (Signer)
 *   5. Send transaction (Sender)
 *   6. Optionally wait for confirmation (Confirmer)
 *
 * On-chain validation rules enforced by Type Script [C1–C6]:
 *   - Data >= 42 bytes, version=0x01, chunk_index < total_chunks
 *   - SHA-256(content) == stored hash
 *   - No duplicate chunk_index per group
 *   - If FLAG_FINALIZED: all chunks must be contiguous 0..n-1
 */

import { Wallet } from '../wallet/Wallet.js';
import { buildCreateTx } from '../builder/TxBuilder.js';
import { signTransaction } from '../executor/Signer.js';
import { sendTransaction } from '../executor/Sender.js';
import { waitForCommit } from '../executor/Confirmer.js';
import { assertSynced } from '../executor/IndexerSync.js';
import { generateFileId } from '../utils/encoding.js';

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Create CKBFS file cells on Testnet (Aggron4).
 *
 * @param {object}  params
 * @param {Uint8Array|Buffer} params.fileBytes        - Raw file content.
 * @param {string}            [params.ownerPrivateKey] - 0x-prefixed private key.
 *                                                       Falls back to process.env.PRIVATE_KEY.
 * @param {string}            [params.fileId]          - 0x-prefixed 32-byte file ID.
 *                                                       Auto-generated if omitted.
 * @param {number}            [params.chunkSize]       - Max bytes per chunk (default 512 KB).
 * @param {boolean}           [params.finalize]        - Set FLAG_FINALIZED (default true).
 * @param {boolean}           [params.immutable]       - Set FLAG_IMMUTABLE (default false).
 * @param {bigint}            [params.feeRate]         - Shannons per 1000 bytes.
 * @param {boolean}           [params.waitForConfirm]  - Poll until committed (default false).
 * @param {boolean}           [params.dryRun]          - Build+sign but do NOT send.
 * @returns {Promise<{
 *   txHash:     string|null,
 *   fileId:     string,
 *   chunkCount: number,
 *   rawTx?:     object,   // only in dryRun
 * }>}
 */
export async function createFileCells({
  fileBytes,
  ownerPrivateKey,
  fileId,
  chunkSize = 512_000,
  finalize = true,
  immutable = false,
  feeRate,
  waitForConfirm = false,
  dryRun = false,
}) {
  console.log('[createFileCells] Starting…');

  // ── 1. Resolve wallet ──────────────────────────────────────────────────────
  const wallet = ownerPrivateKey
    ? Wallet.fromPrivateKey(ownerPrivateKey)
    : Wallet.fromEnv();

  console.log(`[createFileCells] Wallet address: ${wallet.address}`);

  // ── 2. Resolve fileId ─────────────────────────────────────────────────────
  const resolvedFileId = fileId ?? generateFileId();
  console.log(`[createFileCells] File ID: ${resolvedFileId}`);

  // ── 3. Assert indexer is synced ───────────────────────────────────────────
  await assertSynced();
  console.log('[createFileCells] Indexer synced ✓');

  // ── 4. Build raw transaction ───────────────────────────────────────────────
  const { rawTx, signingInputs, chunkCount } = await buildCreateTx({
    fileBytes,
    wallet,
    fileId: resolvedFileId,
    chunkSize,
    finalize,
    immutable,
    feeRate,
  });
  console.log(`[createFileCells] Raw tx built (${chunkCount} chunks, ${rawTx.inputs.length} inputs)`);

  // ── 5. Dry run ─────────────────────────────────────────────────────────────
  if (dryRun) {
    console.log('[createFileCells] [dry-run] Skipping sign + send.');
    return { txHash: null, fileId: resolvedFileId, chunkCount, rawTx };
  }

  // ── 6. Sign ────────────────────────────────────────────────────────────────
  const signedTx = signTransaction(rawTx, signingInputs, wallet);
  console.log('[createFileCells] Transaction signed ✓');

  // ── 7. Send ────────────────────────────────────────────────────────────────
  const txHash = await sendTransaction(signedTx);
  console.log(`[createFileCells] ✅ Submitted: ${txHash}`);

  // ── 8. Wait for confirmation (optional) ───────────────────────────────────
  if (waitForConfirm) {
    await waitForCommit(txHash);
  }

  return { txHash, fileId: resolvedFileId, chunkCount };
}
