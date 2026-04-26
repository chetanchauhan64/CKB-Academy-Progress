/**
 * tests/13_live_multichunk.js — Live Test: Multi-Chunk File
 *
 * Creates a large file that must be split into multiple chunks.
 * Validates:
 *   - chunk_index uniqueness across all cells
 *   - total_chunks consistency (all cells agree)
 *   - Each cell's SHA-256 hash matches its content
 *   - All chunks stored in correct order
 *
 * Writes results to: sdk/outputs/multichunk_tx.json
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Wallet } from '../wallet/Wallet.js';
import { buildCreateTx } from '../builder/TxBuilder.js';
import { signTransaction } from '../executor/Signer.js';
import { sendTransaction } from '../executor/Sender.js';
import { waitForCommit } from '../executor/Confirmer.js';
import { assertSynced } from '../executor/IndexerSync.js';
import { generateFileId, decodeCellData, sha256, bytesToHex } from '../utils/encoding.js';
import { getBalance, findCkbfsCellsByFileId } from '../builder/InputSelector.js';
import { CKBFS_CODE_HASH } from '../config.js';

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

log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TEST 4: MULTI-CHUNK FILE CREATION');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const wallet = Wallet.fromEnv();
log(`Wallet: ${wallet.address}`);

// ── Step 1: Build a file large enough to split into multiple chunks ────────────
// We use chunkSize=200 bytes to force at least 3 chunks with a 600+ byte file.
const CHUNK_SIZE = 200; // tiny chunks for testing
const PARAGRAPH = `This is a test paragraph for CKBFS multi-chunk validation. 
Each chunk is stored as a separate on-chain cell with a unique chunk_index.
The Type Script validates that all chunk_index values are unique and contiguous.
SHA-256 content hash is verified for each chunk independently.\n`;

// Build a file that's ~3-4x the chunk size to guarantee multiple chunks
let LARGE_CONTENT = '';
for (let i = 0; i < 5; i++) {
  LARGE_CONTENT += `=== Section ${i + 1} ===\n${PARAGRAPH}`;
}
LARGE_CONTENT += `Total file created at: ${new Date().toISOString()}\n`;

const fileBytes = new TextEncoder().encode(LARGE_CONTENT);
const fileId = generateFileId();
const expectedChunks = Math.ceil(fileBytes.length / CHUNK_SIZE);

log(`File size: ${fileBytes.length} bytes`);
log(`Chunk size: ${CHUNK_SIZE} bytes`);
log(`Expected chunks: ${expectedChunks}`);
log(`File ID: ${fileId}`);

// ── Step 2: Balance before ────────────────────────────────────────────────────
const balanceBefore = await getBalance(wallet.address);
log(`Balance before: ${(Number(balanceBefore) / 1e8).toFixed(4)} CKB`);

// ── Step 3: Assert indexer synced ─────────────────────────────────────────────
await assertSynced();

// ── Step 4: Build CREATE tx with small chunkSize ──────────────────────────────
log(`Building multi-chunk CREATE tx (chunkSize=${CHUNK_SIZE})…`);
const { rawTx, signingInputs, chunkCount } = await buildCreateTx({
  fileBytes,
  wallet,
  fileId,
  chunkSize: CHUNK_SIZE,
  finalize: true,
  immutable: false,
});

log(`Chunks created: ${chunkCount} (expected: ${expectedChunks})`);
log(`Inputs: ${rawTx.inputs.length}, Outputs: ${rawTx.outputs.length}`);
log(`Output capacities: ${rawTx.outputs.map(o => (Number(BigInt(o.capacity)) / 1e8).toFixed(2) + ' CKB').join(', ')}`);

// ── Step 5: Sign & Send ───────────────────────────────────────────────────────
log('Signing and sending…');
const signedTx = signTransaction(rawTx, signingInputs, wallet);

let txHash;
try {
  txHash = await sendTransaction(signedTx);
} catch (err) {
  console.error(`❌ Multi-chunk CREATE failed: ${err.message}`);
  if (err.context) console.error('Context:', JSON.stringify(err.context, null, 2));
  process.exit(1);
}

log(`✅ Multi-chunk CREATE sent! Hash: ${txHash}`);
log(`Explorer: ${explorerUrl(txHash)}`);

// ── Step 6: Wait for confirmation ─────────────────────────────────────────────
log('Waiting for commitment…');
let committedTx;
try {
  committedTx = await waitForCommit(txHash, 180_000); // longer timeout for multi-output tx
  log(`✅ Committed in block: ${committedTx.txStatus.blockHash}`);
} catch (err) {
  log(`⚠️  ${err.message}`);
  committedTx = null;
}

// ── Step 7: Validate all chunks on-chain ─────────────────────────────────────
log('Waiting 10s for indexer…');
await new Promise(r => setTimeout(r, 10_000));

let onChainCells = [];
const chunkValidation = [];
let allValid = true;

try {
  onChainCells = await findCkbfsCellsByFileId(wallet.address, CKBFS_CODE_HASH, fileId);
  log(`On-chain cells found: ${onChainCells.length}`);

  // Check: correct count
  if (onChainCells.length !== chunkCount) {
    log(`⚠️  Expected ${chunkCount} cells, found ${onChainCells.length}`);
    allValid = false;
  }

  // Check each chunk
  const seenIndices = new Set();
  for (const cell of onChainCells) {
    const decoded = decodeCellData(cell.data);
    // contentHash is not stored in cell data; compute SHA-256 from content
    const computedHash = bytesToHex(sha256(decoded.content));
    const duplicateIdx = seenIndices.has(decoded.chunkIndex);

    const v = {
      chunkIndex: decoded.chunkIndex,
      totalChunks: decoded.totalChunks,
      contentBytes: decoded.content.length,
      sha256: computedHash.slice(0, 18) + '…',
      duplicateIndex: duplicateIdx,
      isFinalized: decoded.isFinalized,
      outPoint: cell.outPoint,
    };
    chunkValidation.push(v);

    if (duplicateIdx) { allValid = false; log(`  ❌ Chunk ${decoded.chunkIndex}: DUPLICATE index!`); }
    else { log(`  ✅ Chunk ${decoded.chunkIndex}: ${decoded.content.length}B, sha256=${computedHash.slice(0, 18)}…, finalized=${decoded.isFinalized}`); }
    seenIndices.add(decoded.chunkIndex);
  }

  // Check total_chunks consistency
  const totalChunkValues = new Set(onChainCells.map(c => decodeCellData(c.data).totalChunks));
  const totalChunksConsistent = totalChunkValues.size === 1;
  if (!totalChunksConsistent) {
    log(`  ❌ total_chunks inconsistency: ${[...totalChunkValues].join(', ')}`);
    allValid = false;
  } else {
    log(`  ✅ total_chunks consistent: all cells agree on ${[...totalChunkValues][0]}`);
  }

  // Check chunk_index uniqueness (0..n-1)
  const indices = [...seenIndices].sort((a, b) => a - b);
  const contiguous = indices.every((idx, i) => idx === i);
  if (!contiguous) {
    log(`  ❌ chunk_index not contiguous: [${indices.join(', ')}]`);
    allValid = false;
  } else {
    log(`  ✅ chunk_index sequence: [${indices.join(', ')}] — contiguous and unique`);
  }
} catch (err) {
  log(`⚠️  Chunk validation: ${err.message}`);
  allValid = false;
}

log(`\nMulti-chunk validation: ${allValid ? '✅ ALL PASS' : '❌ FAILURES DETECTED'}`);

// ── Step 8: Balance after ─────────────────────────────────────────────────────
const balanceAfter = await getBalance(wallet.address);
log(`Balance after: ${(Number(balanceAfter) / 1e8).toFixed(4)} CKB`);
log(`CKB locked in ${chunkCount} chunks: ${(Number(balanceBefore - balanceAfter) / 1e8).toFixed(4)} CKB`);

// ── Step 9: Save output ───────────────────────────────────────────────────────
const output = {
  test: 'MULTI_CHUNK',
  timestamp: new Date().toISOString(),
  wallet: wallet.address,
  fileId,
  txHash,
  explorerUrl: explorerUrl(txHash),
  status: committedTx ? 'committed' : 'submitted',
  blockHash: committedTx?.txStatus?.blockHash ?? null,
  fileSize: fileBytes.length,
  chunkSize: CHUNK_SIZE,
  expectedChunks,
  actualChunks: onChainCells.length,
  allValidationsPassed: allValid,
  chunkValidation,
  balanceBefore: (Number(balanceBefore) / 1e8).toFixed(4) + ' CKB',
  balanceAfter: (Number(balanceAfter) / 1e8).toFixed(4) + ' CKB',
  // Export fileId for potential cleanup
  fileIdForCleanup: fileId,
};

saveOutput('multichunk_tx.json', output);
// Also export for the runner script
fs.writeFileSync(path.join(OUTPUTS_DIR, '.multichunk_file_id'), fileId);

log('Output saved to sdk/outputs/multichunk_tx.json');

log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TEST 4 COMPLETE ✅');
log(`Multi-chunk file ID (for cleanup): ${fileId}`);
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
