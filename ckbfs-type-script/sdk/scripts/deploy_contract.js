/**
 * scripts/deploy_contract.js — CKBFS Type Script Deployer
 *
 * Deploys the CKBFS RISC-V binary to CKB Aggron4 testnet.
 *
 * What it does:
 *   1. Reads the compiled binary from build/release/ckbfs-type-script
 *   2. Computes its blake2b code_hash
 *   3. Selects enough CKB input cells from the wallet
 *   4. Creates a cell with the binary as data (no type script = data hash type)
 *   5. Signs, sends, and waits for confirmation
 *   6. Updates sdk/.env with CKBFS_CODE_HASH, CKBFS_TX_HASH, CKBFS_TX_INDEX
 *
 * Usage: node sdk/scripts/deploy_contract.js
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { utils, config } from '@ckb-lumos/lumos';
import { predefined, initializeConfig } from '@ckb-lumos/config-manager';
import { bytes } from '@ckb-lumos/codec';
import { blockchain } from '@ckb-lumos/base';
import { Wallet } from '../wallet/Wallet.js';
import { selectInputCells } from '../builder/InputSelector.js';
import { signTransaction } from '../executor/Signer.js';
import { sendTransaction, getRpc } from '../executor/Sender.js';
import { waitForCommit } from '../executor/Confirmer.js';
import { assertSynced } from '../executor/IndexerSync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR  = path.resolve(__dirname, '../..');
const SDK_DIR   = path.resolve(__dirname, '..');
const ENV_PATH  = path.join(SDK_DIR, '.env');

initializeConfig(predefined.AGGRON4);

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

log('═══════════════════════════════════════════════════');
log('  CKBFS Contract Deployment → Aggron4 Testnet');
log('═══════════════════════════════════════════════════');

// ── Step 1: Load binary ───────────────────────────────────────────────────────
const BINARY_PATH = path.join(ROOT_DIR, 'build', 'release', 'ckbfs-type-script');
if (!fs.existsSync(BINARY_PATH)) {
  console.error(`❌ Binary not found at ${BINARY_PATH}`);
  console.error('   Run: cargo build --release --target riscv64imac-unknown-none-elf');
  console.error('   Then: cp target/riscv64imac-unknown-none-elf/release/ckbfs-type-script build/release/');
  process.exit(1);
}

const binaryData = fs.readFileSync(BINARY_PATH);
const codeHash = utils.ckbHash(binaryData);
log(`Binary loaded: ${binaryData.length} bytes`);
log(`Code hash: ${codeHash}`);

// ── Step 2: Wallet ────────────────────────────────────────────────────────────
const wallet = Wallet.fromEnv();
log(`Deploying from: ${wallet.address}`);

// ── Step 3: Calculate capacity ────────────────────────────────────────────────
// Cell capacity: 8 (capacity field) + lock_script_size + data_size
// secp256k1 lock: 33 (code_hash) + 1 (hash_type) + 20 (args) = 54 bytes
const LOCK_OVERHEAD = 8n + 54n; // capacity field + lock script occupied_bytes
const DATA_CAPACITY = BigInt(binaryData.length);
const CELL_CAPACITY = (LOCK_OVERHEAD + DATA_CAPACITY) * 100_000_000n; // shannons
const FEE = 10_000_000n; // 0.1 CKB fee
const CHANGE_MIN = 6_100_000_000n; // 61 CKB min change cell
const REQUIRED = CELL_CAPACITY + FEE + CHANGE_MIN;

log(`Cell capacity needed: ${Number(CELL_CAPACITY) / 1e8} CKB`);
log(`Total required (+ fee + change): ${Number(REQUIRED) / 1e8} CKB`);

// ── Step 4: Assert indexer synced ────────────────────────────────────────────
log('Checking indexer sync...');
await assertSynced();
log('Indexer synced ✅');

// ── Step 5: Select inputs ─────────────────────────────────────────────────────
log('Selecting input cells...');
let selectedCells, totalInputCapacity;
try {
  ({ selectedCells, totalInputCapacity } = await selectInputCells({
    address: wallet.address,
    requiredCapacity: REQUIRED,
  }));
} catch (err) {
  console.error(`❌ Input selection failed: ${err.message}`);
  if (err.message.includes('Insufficient')) {
    console.error(`   Wallet needs at least ${Number(REQUIRED) / 1e8} CKB`);
    console.error(`   Fund at: https://faucet.nervos.org/`);
    console.error(`   Address: ${wallet.address}`);
    console.error(`   Or update PRIVATE_KEY in sdk/.env to a funded wallet`);
  }
  process.exit(1);
}
log(`Selected ${selectedCells.length} input cell(s), total ${Number(totalInputCapacity) / 1e8} CKB`);

// ── Step 6: Build raw deploy transaction ──────────────────────────────────────
log('Building deploy transaction...');
const secp = config.getConfig().SCRIPTS.SECP256K1_BLAKE160;
const changeCap = totalInputCapacity - CELL_CAPACITY - FEE;

const rawTx = {
  version: '0x0',
  cellDeps: [{
    outPoint: {
      txHash: secp.TX_HASH,
      index: secp.INDEX,         // already '0x0' — do NOT prefix again
    },
    depType: secp.DEP_TYPE,      // already 'depGroup' — use from config
  }],
  headerDeps: [],
  inputs: selectedCells.map(cell => ({
    previousOutput: cell.outPoint, // index already hex '0x...' from RPC
    since: '0x0',
  })),
  outputs: [
    // Output 0: the contract binary cell
    {
      capacity: `0x${CELL_CAPACITY.toString(16)}`,
      lock: wallet.lockScript,
      type: null,
    },
    // Output 1: change cell
    {
      capacity: `0x${changeCap.toString(16)}`,
      lock: wallet.lockScript,
      type: null,
    },
  ],
  outputsData: [
    '0x' + binaryData.toString('hex'), // contract binary
    '0x',                              // change (empty data)
  ],
};

const inputIndices = selectedCells.map((_, i) => i);
log(`Inputs: ${rawTx.inputs.length}, Outputs: ${rawTx.outputs.length}`);
log(`Contract cell capacity: ${Number(CELL_CAPACITY) / 1e8} CKB`);
log(`Change cell: ${Number(changeCap) / 1e8} CKB`);

// ── Step 7: Sign ──────────────────────────────────────────────────────────────
log('Signing deploy transaction...');
const signedTx = signTransaction(rawTx, inputIndices, wallet);

// ── Step 8: Send ──────────────────────────────────────────────────────────────
log('Broadcasting to Aggron4...');
let txHash;
try {
  txHash = await sendTransaction(signedTx);
} catch (err) {
  console.error(`❌ Deploy transaction rejected: ${err.message}`);
  if (err.context) console.error('  Context:', JSON.stringify(err.context, null, 2));
  process.exit(1);
}

log(`✅ Deploy transaction sent!`);
log(`   Tx Hash: ${txHash}`);
log(`   Explorer: https://pudge.explorer.nervos.org/transaction/${txHash}`);

// ── Step 9: Wait for confirmation ────────────────────────────────────────────
log('Waiting for commitment (up to 180s)...');
try {
  const committed = await waitForCommit(txHash, 180_000);
  log(`✅ Confirmed in block: ${committed.txStatus.blockHash}`);
} catch (err) {
  log(`⚠️  Confirmation: ${err.message} — check explorer for status`);
}

// ── Step 10: Update sdk/.env ──────────────────────────────────────────────────
const TX_INDEX = 0; // the binary cell is output index 0
log('\nUpdating sdk/.env with deployment values...');

let envContent = fs.readFileSync(ENV_PATH, 'utf8');
envContent = envContent
  .replace(/^CKBFS_CODE_HASH=.*/m, `CKBFS_CODE_HASH=${codeHash}`)
  .replace(/^CKBFS_TX_HASH=.*/m,   `CKBFS_TX_HASH=${txHash}`)
  .replace(/^CKBFS_TX_INDEX=.*/m,  `CKBFS_TX_INDEX=${TX_INDEX}`);
fs.writeFileSync(ENV_PATH, envContent, 'utf8');

// ── Step 11: Save deployment record ──────────────────────────────────────────
const deployRecord = {
  timestamp: new Date().toISOString(),
  network: 'Aggron4',
  binaryPath: BINARY_PATH,
  binarySize: binaryData.length,
  codeHash,
  hashType: 'data1',
  txHash,
  txIndex: TX_INDEX,
  outPoint: { txHash, index: `0x${TX_INDEX.toString(16)}` },
  explorerUrl: `https://pudge.explorer.nervos.org/transaction/${txHash}`,
  cellCapacity: `${Number(CELL_CAPACITY) / 1e8} CKB`,
  deployedBy: wallet.address,
};

fs.mkdirSync(path.join(ROOT_DIR, 'outputs'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT_DIR, 'outputs', 'deployment.json'),
  JSON.stringify(deployRecord, null, 2)
);

log('\n═══════════════════════════════════════════════════');
log('  DEPLOYMENT COMPLETE ✅');
log('═══════════════════════════════════════════════════');
log(`  Code Hash : ${codeHash}`);
log(`  Tx Hash   : ${txHash}`);
log(`  Out Index : ${TX_INDEX}`);
log(`  Hash Type : data`);
log(`  Explorer  : https://pudge.explorer.nervos.org/transaction/${txHash}`);
log('');
log('  sdk/.env has been updated automatically.');
log('  Next: npm run test:preflight  →  npm run test:live');
log('═══════════════════════════════════════════════════\n');
