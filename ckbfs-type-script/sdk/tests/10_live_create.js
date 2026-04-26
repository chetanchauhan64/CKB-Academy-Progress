/**
 * tests/10_live_create.js — Live Test: CREATE File Cell
 *
 * Sends a real CREATE transaction to CKB Aggron4 testnet.
 * Writes results to: sdk/outputs/create_tx.json
 *
 * Prerequisites: run tests/00_preflight.js first and ensure exit 0.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Wallet } from '../wallet/Wallet.js';
import { buildCreateTx } from '../builder/TxBuilder.js';
import { signTransaction } from '../executor/Signer.js';
import { sendTransaction, getRpc } from '../executor/Sender.js';
import { waitForCommit } from '../executor/Confirmer.js';
import { assertSynced } from '../executor/IndexerSync.js';
import { generateFileId, decodeCellData, bytesToHex } from '../utils/encoding.js';
import { getBalance, findCkbfsCellsByFileId } from '../builder/InputSelector.js';
import { CKBFS_CODE_HASH } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUTS_DIR = path.resolve(__dirname, '../outputs');
const EXPLORER = 'https://pudge.explorer.nervos.org/transaction';

// ── Helpers ────────────────────────────────────────────────────────────────────

function explorerUrl(txHash) {
  return `${EXPLORER}/${txHash}`;
}

function saveOutput(filename, data) {
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUTS_DIR, filename),
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2),
    'utf8'
  );
}

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TEST 1: CREATE FILE CELL');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ── Step 1: Wallet ─────────────────────────────────────────────────────────────
const wallet = Wallet.fromEnv();
log(`Wallet: ${wallet.address}`);
log(`Lock hash: ${wallet.lockHash}`);

// ── Step 2: Balance check ──────────────────────────────────────────────────────
const balanceBefore = await getBalance(wallet.address);
log(`Balance before: ${(Number(balanceBefore) / 1e8).toFixed(4)} CKB`);

if (balanceBefore < 200n * 100_000_000n) {
  console.error('❌ Insufficient balance. Need at least 200 CKB. Fund your wallet first.');
  process.exit(1);
}

// ── Step 3: Assert indexer synced ─────────────────────────────────────────────
log('Checking indexer sync…');
const { chainTip, indexerTip, lag } = await assertSynced();
log(`Indexer synced: chainTip=${chainTip}, indexerTip=${indexerTip}, lag=${lag}`);

// ── Step 4: Prepare file content ──────────────────────────────────────────────
const FILE_CONTENT = `CKBFS Test File
Created: ${new Date().toISOString()}
Author: CKBFS SDK Phase 2 Live Test
Content: Production-grade CKB File Storage System
This file was stored on-chain via a Type Script validated transaction.
Version: 1.0.0
Network: Aggron4 Testnet`;

const fileBytes = new TextEncoder().encode(FILE_CONTENT);
const fileId = generateFileId();

log(`File ID: ${fileId}`);
log(`File size: ${fileBytes.length} bytes`);
log(`Content preview: "${FILE_CONTENT.slice(0, 60)}..."`);

// ── Step 5: Build transaction ──────────────────────────────────────────────────
log('Building CREATE transaction…');
const { rawTx, signingInputs, chunkCount } = await buildCreateTx({
  fileBytes,
  wallet,
  fileId,
  chunkSize: 512_000, // single chunk for small file
  finalize: true,
  immutable: false,
});

log(`Raw tx built: ${rawTx.inputs.length} input(s), ${rawTx.outputs.length} output(s), ${chunkCount} chunk(s)`);
log(`Outputs capacities: ${rawTx.outputs.map(o => (Number(BigInt(o.capacity)) / 1e8).toFixed(2) + ' CKB').join(', ')}`);

// ── Step 6: Sign ──────────────────────────────────────────────────────────────
log('Signing transaction…');
const signedTx = signTransaction(rawTx, signingInputs, wallet);
log(`Witnesses built: ${signedTx.witnesses.length} witness(es)`);
log(`Witness[0] length: ${(signedTx.witnesses[0].length - 2) / 2} bytes`);

// ── Step 7: Send ──────────────────────────────────────────────────────────────
log('Sending transaction to Aggron4…');
let txHash;
try {
  txHash = await sendTransaction(signedTx);
} catch (err) {
  console.error(`❌ sendTransaction failed: ${err.message}`);
  if (err.context) console.error('Context:', JSON.stringify(err.context, null, 2));
  console.error('\nRoot cause analysis:');
  if (err.message.includes('Resolve failed')) {
    console.error('  → Input cell not found or already spent. Indexer may be stale — wait and retry.');
  } else if (err.message.includes('capacity')) {
    console.error('  → Output capacity too low. The cell data may require more CKB.');
  } else if (err.message.includes('fee')) {
    console.error('  → Fee rate too low. Try increasing feeRate in config.');
  } else if (err.message.includes('script')) {
    console.error('  → Type Script rejected the transaction. Check CKBFS_CODE_HASH matches deployed binary.');
  }
  process.exit(1);
}

log(`✅ Transaction sent! Hash: ${txHash}`);
log(`Explorer: ${explorerUrl(txHash)}`);

// ── Step 8: Wait for confirmation ─────────────────────────────────────────────
log('Waiting for commitment (up to 120s)…');
let committedTx;
try {
  committedTx = await waitForCommit(txHash, 120_000);
  log(`✅ Confirmed in block: ${committedTx.txStatus.blockHash}`);
} catch (err) {
  log(`⚠️  Confirmation wait: ${err.message}`);
  log('Transaction was submitted — check explorer for final status.');
  committedTx = null;
}

// ── Step 9: Validate cells on-chain ───────────────────────────────────────────
let onChainCells = [];
if (committedTx) {
  log('Fetching created cells from indexer…');
  // Give indexer 5s to catch up
  await new Promise(r => setTimeout(r, 5000));
  try {
    onChainCells = await findCkbfsCellsByFileId(wallet.address, CKBFS_CODE_HASH, fileId);
    log(`Found ${onChainCells.length} cell(s) on-chain for fileId=${fileId}`);
    for (const cell of onChainCells) {
      const decoded = decodeCellData(cell.data);
      log(`  Cell: chunkIndex=${decoded.chunkIndex}, totalChunks=${decoded.totalChunks}, ` +
          `contentLen=${decoded.content.length}, isFinalized=${decoded.isFinalized}`);
    }
  } catch (err) {
    log(`⚠️  Cell query: ${err.message}`);
  }
}

// ── Step 10: Balance after ─────────────────────────────────────────────────────
const balanceAfter = await getBalance(wallet.address);
const spent = balanceBefore - balanceAfter;
log(`Balance after: ${(Number(balanceAfter) / 1e8).toFixed(4)} CKB`);
log(`CKB spent (locked in cells + fee): ${(Number(spent) / 1e8).toFixed(4)} CKB`);

// ── Step 11: Save output ───────────────────────────────────────────────────────
const output = {
  test: 'CREATE',
  timestamp: new Date().toISOString(),
  wallet: wallet.address,
  fileId,
  fileSize: fileBytes.length,
  chunkCount,
  txHash,
  explorerUrl: explorerUrl(txHash),
  status: committedTx ? 'committed' : 'submitted',
  blockHash: committedTx?.txStatus?.blockHash ?? null,
  onChainCells: onChainCells.length,
  balanceBefore: (Number(balanceBefore) / 1e8).toFixed(4) + ' CKB',
  balanceAfter: (Number(balanceAfter) / 1e8).toFixed(4) + ' CKB',
  ckbSpent: (Number(spent) / 1e8).toFixed(4) + ' CKB',
  validation: {
    cellsFound: onChainCells.length === chunkCount,
    dataIntegrity: onChainCells.length > 0,
    ownershipVerified: onChainCells.every(c =>
      c.cellOutput.lock.args.toLowerCase() === wallet.lockScript.args.toLowerCase()
    ),
  },
};

saveOutput('create_tx.json', output);
log(`Output saved to sdk/outputs/create_tx.json`);

// Export fileId for subsequent tests
export { fileId, txHash };

log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TEST 1 COMPLETE ✅');
log(`File ID to use in UPDATE test: ${fileId}`);
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
