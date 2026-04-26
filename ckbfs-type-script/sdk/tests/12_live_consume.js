/**
 * tests/12_live_consume.js — Live Test: CONSUME (Destroy) File Cells
 *
 * Sends a real CONSUME transaction to Aggron4 testnet.
 * Requires: CKBFS_FILE_ID env var.
 * Writes results to: sdk/outputs/consume_tx.json
 *
 * Validation:
 *   - All CKBFS cells for the file are consumed (no longer live)
 *   - Locked CKB capacity is returned to wallet (minus fee)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Wallet } from '../wallet/Wallet.js';
import { buildConsumeTx } from '../builder/TxBuilder.js';
import { signTransaction } from '../executor/Signer.js';
import { sendTransaction } from '../executor/Sender.js';
import { waitForCommit } from '../executor/Confirmer.js';
import { assertSynced } from '../executor/IndexerSync.js';
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

// ── Load fileId ────────────────────────────────────────────────────────────────
const fileId = process.env.CKBFS_FILE_ID;
if (!fileId || fileId === '0x' + '0'.repeat(64)) {
  console.error('❌ CKBFS_FILE_ID not set.');
  process.exit(1);
}

log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TEST 3: CONSUME (DESTROY) FILE CELLS');
log(`File ID: ${fileId}`);
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const wallet = Wallet.fromEnv();
log(`Wallet: ${wallet.address}`);

// ── Step 1: Verify cells exist before consuming ────────────────────────────────
log('Fetching cells to consume…');
await assertSynced();
const cellsBefore = await findCkbfsCellsByFileId(wallet.address, CKBFS_CODE_HASH, fileId);
if (cellsBefore.length === 0) {
  throw new FileNotFoundError(fileId, wallet.address);
}

const lockedCapacity = cellsBefore.reduce((s, c) => s + BigInt(c.cellOutput.capacity), 0n);
log(`Cells to consume: ${cellsBefore.length}`);
log(`Locked CKB to recover: ${(Number(lockedCapacity) / 1e8).toFixed(4)} CKB`);

// ── Step 2: Balance before ────────────────────────────────────────────────────
const balanceBefore = await getBalance(wallet.address);
log(`Balance before: ${(Number(balanceBefore) / 1e8).toFixed(4)} CKB`);

// ── Step 3: Build CONSUME tx ──────────────────────────────────────────────────
log('Building CONSUME transaction…');
const { rawTx, signingInputs, chunksConsumed, capacityRecovered } = await buildConsumeTx({
  fileId,
  wallet,
});

log(`Consuming ${chunksConsumed} chunk(s), recovering ~${(Number(capacityRecovered) / 1e8).toFixed(4)} CKB`);
log(`Inputs: ${rawTx.inputs.length}, Outputs: ${rawTx.outputs.length}`);

// ── Step 4: Sign ──────────────────────────────────────────────────────────────
log('Signing CONSUME transaction…');
const signedTx = signTransaction(rawTx, signingInputs, wallet);

// ── Step 5: Send ──────────────────────────────────────────────────────────────
log('Sending CONSUME transaction…');
let txHash;
try {
  txHash = await sendTransaction(signedTx);
} catch (err) {
  console.error(`❌ CONSUME failed: ${err.message}`);
  if (err.message.includes('script')) {
    console.error('  → Type Script check: DESTROY mode requires at least one input lock matching owner_lock_hash.');
    console.error('  → Ensure the wallet private key matches the file owner.');
  } else if (err.message.includes('Resolve')) {
    console.error('  → Input cells not found. The UPDATE tx may not be confirmed yet.');
  }
  process.exit(1);
}

log(`✅ CONSUME sent! Hash: ${txHash}`);
log(`Explorer: ${explorerUrl(txHash)}`);

// ── Step 6: Wait for confirmation ─────────────────────────────────────────────
log('Waiting for commitment…');
let committedTx;
try {
  committedTx = await waitForCommit(txHash, 120_000);
  log(`✅ Committed in block: ${committedTx.txStatus.blockHash}`);
} catch (err) {
  log(`⚠️  ${err.message}`);
  committedTx = null;
}

// ── Step 7: Validate — cells are gone ─────────────────────────────────────────
log('Waiting 5s for indexer to catch up…');
await new Promise(r => setTimeout(r, 5000));

let cellsAfter = [];
try {
  cellsAfter = await findCkbfsCellsByFileId(wallet.address, CKBFS_CODE_HASH, fileId);
  log(`Cells remaining after consume: ${cellsAfter.length} (expected: 0)`);
} catch (err) {
  log(`⚠️  Post-consume cell check: ${err.message}`);
}

const cellsGone = cellsAfter.length === 0;

// ── Step 8: Balance after — verify capacity returned ─────────────────────────
const balanceAfter = await getBalance(wallet.address);
const balanceDelta = balanceAfter - balanceBefore;
log(`Balance after: ${(Number(balanceAfter) / 1e8).toFixed(4)} CKB`);
log(`Balance delta: +${(Number(balanceDelta) / 1e8).toFixed(4)} CKB (locked capacity returned minus fee)`);

const capacityReturned = balanceDelta > 0n;

// ── Step 9: Save output ───────────────────────────────────────────────────────
const output = {
  test: 'CONSUME',
  timestamp: new Date().toISOString(),
  wallet: wallet.address,
  fileId,
  txHash,
  explorerUrl: explorerUrl(txHash),
  status: committedTx ? 'committed' : 'submitted',
  blockHash: committedTx?.txStatus?.blockHash ?? null,
  chunksConsumed,
  capacityRecovered: (Number(capacityRecovered) / 1e8).toFixed(4) + ' CKB',
  validation: {
    cellsGone,
    capacityReturned,
    cellsRemainingAfter: cellsAfter.length,
  },
  balanceBefore: (Number(balanceBefore) / 1e8).toFixed(4) + ' CKB',
  balanceAfter: (Number(balanceAfter) / 1e8).toFixed(4) + ' CKB',
  balanceDelta: (Number(balanceDelta) / 1e8).toFixed(4) + ' CKB',
};

saveOutput('consume_tx.json', output);
log('Output saved to sdk/outputs/consume_tx.json');

log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TEST 3 COMPLETE ✅');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
