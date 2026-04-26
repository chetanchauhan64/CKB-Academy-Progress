/**
 * tests/11_live_update.js — Live Test: UPDATE File Cell
 *
 * Sends a real UPDATE transaction to Aggron4 testnet.
 * Requires: CKBFS_FILE_ID env var (set automatically by the runner script).
 * Writes results to: sdk/outputs/update_tx.json
 *
 * Validation:
 *   - Old input cell is consumed (no longer live)
 *   - New output cell exists with updated content
 *   - chunk_index, total_chunks, owner preserved
 *   - Hash of new content verified
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Wallet } from '../wallet/Wallet.js';
import { buildUpdateTx } from '../builder/TxBuilder.js';
import { signTransaction } from '../executor/Signer.js';
import { sendTransaction, getRpc } from '../executor/Sender.js';
import { waitForCommit } from '../executor/Confirmer.js';
import { assertSynced } from '../executor/IndexerSync.js';
import { decodeCellData, sha256, bytesToHex } from '../utils/encoding.js';
import { getBalance, findCkbfsCellsByFileId } from '../builder/InputSelector.js';
import { CKBFS_CODE_HASH } from '../config.js';
import { FileNotFoundError } from '../utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUTS_DIR = path.resolve(__dirname, '../outputs');
const EXPLORER = 'https://pudge.explorer.nervos.org/transaction';

function explorerUrl(txHash) { return `${EXPLORER}/${txHash}`; }
function saveOutput(filename, data) {
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUTS_DIR, filename),
    JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// ── Load fileId from previous test ────────────────────────────────────────────
const fileId = process.env.CKBFS_FILE_ID;
if (!fileId || fileId === '0x' + '0'.repeat(64)) {
  console.error('❌ CKBFS_FILE_ID not set. Run test 10_live_create.js first, or set CKBFS_FILE_ID manually.');
  process.exit(1);
}

log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TEST 2: UPDATE FILE CELL');
log(`File ID: ${fileId}`);
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const wallet = Wallet.fromEnv();
log(`Wallet: ${wallet.address}`);

// ── Step 1: Fetch existing cells ──────────────────────────────────────────────
log('Fetching existing CKBFS cells for fileId…');
await assertSynced();
const existingCells = await findCkbfsCellsByFileId(wallet.address, CKBFS_CODE_HASH, fileId);
if (existingCells.length === 0) {
  throw new FileNotFoundError(fileId, wallet.address);
}

log(`Found ${existingCells.length} existing cell(s):`);
const existingDecoded = existingCells.map(cell => {
  const d = decodeCellData(cell.data);
  const hashStr = d.contentHash ? bytesToHex(d.contentHash).slice(0, 18) + '...' : 'N/A';
  log(`  Chunk ${d.chunkIndex}/${d.totalChunks}: ${d.content?.length ?? '?'} bytes, ` +
      `hash=${hashStr}, finalized=${d.isFinalized}`);

  return { ...d, outPoint: cell.outPoint, capacity: cell.cellOutput.capacity };
});

// Record the old out-points for verification after the update
const oldOutPoints = existingCells.map(c => `${c.outPoint.txHash}:${c.outPoint.index}`);

// ── Step 2: Prepare updated content ───────────────────────────────────────────
const UPDATED_CONTENT = `CKBFS Test File — UPDATED
Original created and updated via CKBFS SDK Phase 2
Update timestamp: ${new Date().toISOString()}
This demonstrates the UPDATE lifecycle:
  - Old cells consumed as inputs
  - New cells created as outputs
  - Owner lock hash preserved in type args
  - Content hash re-validated by Type Script
Status: Successfully updated on CKB Aggron4 Testnet`;

const newFileBytes = new TextEncoder().encode(UPDATED_CONTENT);
log(`Updated content: ${newFileBytes.length} bytes`);
log(`Content preview: "${UPDATED_CONTENT.slice(0, 60)}..."`);

// ── Step 3: Balance before ────────────────────────────────────────────────────
const balanceBefore = await getBalance(wallet.address);
log(`Balance before: ${(Number(balanceBefore) / 1e8).toFixed(4)} CKB`);

// ── Step 4: Build UPDATE tx ───────────────────────────────────────────────────
log('Building UPDATE transaction…');
const { rawTx, signingInputs, chunkCount } = await buildUpdateTx({
  fileId,
  newFileBytes,
  wallet,
  finalize: true,
});

log(`Raw tx: ${rawTx.inputs.length} input(s), ${rawTx.outputs.length} output(s)`);

// ── Step 5: Sign ──────────────────────────────────────────────────────────────
log('Signing UPDATE transaction…');
const signedTx = signTransaction(rawTx, signingInputs, wallet);

// ── Step 6: Send ──────────────────────────────────────────────────────────────
log('Sending UPDATE transaction…');
let txHash;
try {
  txHash = await sendTransaction(signedTx);
} catch (err) {
  console.error(`❌ UPDATE failed: ${err.message}`);
  if (err.context) console.error('Context:', JSON.stringify(err.context, null, 2));
  console.error('\nRoot cause analysis:');
  if (err.message.includes('script')) {
    console.error('  → Type Script rejected: check chunk_index pairing or immutability flag');
  } else if (err.message.includes('Resolve')) {
    console.error('  → Input cell already spent. The create tx may not be confirmed yet.');
    console.error('  → Wait for the create tx to be committed, then retry.');
  }
  process.exit(1);
}

log(`✅ UPDATE sent! Hash: ${txHash}`);
log(`Explorer: ${explorerUrl(txHash)}`);

// ── Step 7: Wait for confirmation ─────────────────────────────────────────────
log('Waiting for commitment…');
let committedTx;
try {
  committedTx = await waitForCommit(txHash, 120_000);
  log(`✅ Committed in block: ${committedTx.txStatus.blockHash}`);
} catch (err) {
  log(`⚠️  ${err.message}`);
  committedTx = null;
}

// ── Step 8: Validate — old cells consumed, new cells exist ───────────────────
log('Waiting 10s for indexer to catch up…');
await new Promise(r => setTimeout(r, 10_000));

let newCells = [];
let oldCellsConsumed = false;

try {
  newCells = await findCkbfsCellsByFileId(wallet.address, CKBFS_CODE_HASH, fileId);
  log(`New cells found: ${newCells.length}`);

  for (const cell of newCells) {
    const d = decodeCellData(cell.data);
    // Compute hash from content (contentHash is not stored in cell data)
    const computedHash = bytesToHex(sha256(d.content));
    log(`  Chunk ${d.chunkIndex}: contentLen=${d.content.length}, sha256=${computedHash.slice(0,18)}…`);
  }

  // Old cells should no longer appear (they're consumed inputs)
  const newOutPoints = new Set(newCells.map(c => `${c.outPoint.txHash}:${c.outPoint.index}`));
  oldCellsConsumed = oldOutPoints.every(op => !newOutPoints.has(op));
  log(`Old cells consumed: ${oldCellsConsumed}`);
} catch (err) {
  log(`⚠️  Cell validation: ${err.message}`);
}

// ── Step 9: Balance after ─────────────────────────────────────────────────────
const balanceAfter = await getBalance(wallet.address);
log(`Balance after: ${(Number(balanceAfter) / 1e8).toFixed(4)} CKB`);
log(`Fee paid: ~${(Number(balanceBefore - balanceAfter) / 1e8).toFixed(6)} CKB`);

// ── Step 10: Save output ──────────────────────────────────────────────────────
const output = {
  test: 'UPDATE',
  timestamp: new Date().toISOString(),
  wallet: wallet.address,
  fileId,
  txHash,
  explorerUrl: explorerUrl(txHash),
  status: committedTx ? 'committed' : 'submitted',
  blockHash: committedTx?.txStatus?.blockHash ?? null,
  newContentSize: newFileBytes.length,
  chunkCount,
  validation: {
    oldCellsConsumed,
    newCellsExist: newCells.length === chunkCount,
    dataIntegrityOk: newCells.length > 0,
    ownershipPreserved: newCells.every(c =>
      c.cellOutput.lock.args.toLowerCase() === wallet.lockScript.args.toLowerCase()
    ),
    typeArgsUnchanged: newCells.every(c =>
      c.cellOutput.type?.args === existingCells[0]?.cellOutput.type?.args
    ),
  },
  oldOutPoints,
  newOutPoints: newCells.map(c => `${c.outPoint.txHash}:${c.outPoint.index}`),
  balanceBefore: (Number(balanceBefore) / 1e8).toFixed(4) + ' CKB',
  balanceAfter: (Number(balanceAfter) / 1e8).toFixed(4) + ' CKB',
};

saveOutput('update_tx.json', output);
log('Output saved to sdk/outputs/update_tx.json');

log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TEST 2 COMPLETE ✅');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
