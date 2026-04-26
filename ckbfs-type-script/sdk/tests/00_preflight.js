/**
 * tests/00_preflight.js — CKBFS Testnet Preflight Checker
 *
 * Verifies ALL prerequisites before live transaction tests run:
 *   1. .env file exists and PRIVATE_KEY is set
 *   2. Wallet derives a valid address
 *   3. RPC node is reachable and returns chain info
 *   4. Indexer is reachable and synced
 *   5. Wallet has enough CKB balance (minimum 500 CKB)
 *   6. CKBFS_CODE_HASH is not the zero placeholder
 *   7. CKBFS deploy tx is resolvable on-chain
 *
 * Exit codes:
 *   0 = all checks pass → safe to run live tests
 *   1 = one or more checks failed → fix before running
 */

import 'dotenv/config';
import { Wallet } from '../wallet/Wallet.js';
import { getRpc } from '../executor/Sender.js';
import { getSyncStatus } from '../executor/IndexerSync.js';
import { getBalance } from '../builder/InputSelector.js';
import { CKBFS_CODE_HASH, CKBFS_BINARY_OUT_POINT, CKB_RPC_URL, CKB_INDEXER_URL } from '../config.js';

const ZERO_HASH = '0x' + '0'.repeat(64);
const MIN_BALANCE_CKB = 500; // minimum CKB to safely run all 4 tests
const MIN_BALANCE_SHANNONS = BigInt(MIN_BALANCE_CKB) * 100_000_000n;

const results = [];
let allPass = true;

function check(name, pass, detail = '') {
  const status = pass ? '✅' : '❌';
  results.push({ name, pass, detail });
  if (!pass) allPass = false;
  console.log(`  ${status} ${name}${detail ? ': ' + detail : ''}`);
}

function warn(name, detail) {
  results.push({ name, pass: null, detail });
  console.log(`  ⚠️  ${name}: ${detail}`);
}

console.log('\n═══════════════════════════════════════════════════');
console.log('  CKBFS Testnet Preflight Check');
console.log('═══════════════════════════════════════════════════\n');

// ── 1. Private key ─────────────────────────────────────────────────────────────
const pk = process.env.PRIVATE_KEY;
check(
  'PRIVATE_KEY is set',
  !!pk && pk !== ZERO_HASH && pk !== '0x0000000000000000000000000000000000000000000000000000000000000000',
  pk ? `${pk.slice(0, 10)}...` : 'MISSING'
);

// ── 2. Wallet derivation ───────────────────────────────────────────────────────
let wallet = null;
try {
  wallet = Wallet.fromEnv();
  check('Wallet derives successfully', true, wallet.address);
} catch (err) {
  check('Wallet derives successfully', false, err.message);
}

// ── 3. RPC reachable ──────────────────────────────────────────────────────────
let chainInfo = null;
try {
  const rpc = getRpc();
  chainInfo = await rpc.getBlockchainInfo();
  const tipHex = await rpc.getTipBlockNumber();
  const tipNum = Number(BigInt(tipHex));
  check('RPC node reachable', true, `chain=${chainInfo.chain}, tip=#${tipNum}`);
} catch (err) {
  check('RPC node reachable', false, `${CKB_RPC_URL} → ${err.message}`);
}


// ── 4. Indexer synced ─────────────────────────────────────────────────────────
try {
  const sync = await getSyncStatus();
  const lagStr = `lag=${sync.lag} blocks`;
  check('Indexer synced (lag ≤ 5)', sync.synced, lagStr);
  if (!sync.synced) {
    warn('Indexer lag', `Chain tip: ${sync.chainTip}, Indexer tip: ${sync.indexerTip}. Wait and retry.`);
  }
} catch (err) {
  check('Indexer synced', false, err.message);
}

// ── 5. Wallet balance ─────────────────────────────────────────────────────────
if (wallet) {
  try {
    const balance = await getBalance(wallet.address);
    const balanceCkb = Number(balance) / 1e8;
    check(
      `Wallet balance ≥ ${MIN_BALANCE_CKB} CKB`,
      balance >= MIN_BALANCE_SHANNONS,
      `${balanceCkb.toFixed(4)} CKB available`
    );
    if (balance < MIN_BALANCE_SHANNONS && balance > 0n) {
      warn('Low balance', `Need ${MIN_BALANCE_CKB} CKB, have ${balanceCkb.toFixed(4)} CKB. Get more from https://faucet.nervos.org/`);
    } else if (balance === 0n) {
      warn('Zero balance', `Fund ${wallet.address} at https://faucet.nervos.org/`);
    }
  } catch (err) {
    check(`Wallet balance ≥ ${MIN_BALANCE_CKB} CKB`, false, err.message);
  }
}

// ── 6. CKBFS code_hash set ────────────────────────────────────────────────────
const codeHashSet = !!CKBFS_CODE_HASH && CKBFS_CODE_HASH !== ZERO_HASH;
check('CKBFS_CODE_HASH is set (not zero)', codeHashSet, codeHashSet ? CKBFS_CODE_HASH.slice(0, 18) + '...' : 'Still zero placeholder');
if (!codeHashSet) {
  warn('Deploy required', 'Run: capsule deploy --env testnet (inside ckbfs-type-script/)');
}

// ── 7. CKBFS deploy tx on-chain ───────────────────────────────────────────────
const txHashSet = CKBFS_BINARY_OUT_POINT.txHash !== ZERO_HASH;
if (txHashSet && codeHashSet) {
  try {
    const rpc = getRpc();
    const deployTx = await rpc.getTransaction(CKBFS_BINARY_OUT_POINT.txHash);
    const onChain = deployTx?.txStatus?.status === 'committed';
    check('CKBFS deploy tx committed on-chain', onChain, `status=${deployTx?.txStatus?.status}`);
  } catch (err) {
    check('CKBFS deploy tx committed on-chain', false, err.message);
  }
} else {
  warn('CKBFS deploy tx check', 'Skipped — CKBFS_TX_HASH is zero placeholder');
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════');
if (allPass) {
  console.log('  ✅ ALL CHECKS PASSED — Ready to run live tests!');
} else {
  console.log('  ❌ SOME CHECKS FAILED — Fix issues before running live tests.\n');
  console.log('  Failed checks:');
  results.filter(r => r.pass === false).forEach(r => {
    console.log(`    • ${r.name}: ${r.detail}`);
  });
}
console.log('\n  Wallet address:', wallet?.address ?? 'N/A');
console.log(`  RPC:     ${CKB_RPC_URL}`);
console.log(`  Indexer: ${CKB_INDEXER_URL}`);
console.log('═══════════════════════════════════════════════════\n');

process.exit(allPass ? 0 : 1);
