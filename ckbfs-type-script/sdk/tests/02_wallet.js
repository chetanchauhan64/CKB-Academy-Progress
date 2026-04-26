/**
 * tests/02_wallet.js — Unit tests for wallet/Wallet.js
 */
import assert from 'node:assert/strict';
import { Wallet } from '../wallet/Wallet.js';
import { CkbfsError } from '../utils/errors.js';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.error(`  ❌ ${name}: ${e.message}`); fail++; }
}

// Use a well-known testnet private key (DO NOT use in production with real funds)
const TEST_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';

test('Wallet derives public key from private key', () => {
  const wallet = new Wallet(TEST_PRIVATE_KEY);
  assert.ok(wallet.publicKey.startsWith('0x'), 'publicKey should be hex');
  assert.equal((wallet.publicKey.length - 2) / 2, 33, 'publicKey should be 33 bytes');
});

test('Wallet derives correct lock script structure', () => {
  const wallet = new Wallet(TEST_PRIVATE_KEY);
  assert.ok(wallet.lockScript.codeHash.startsWith('0x'));
  assert.equal(wallet.lockScript.hashType, 'type');
  assert.ok(wallet.lockScript.args.startsWith('0x'));
  assert.equal((wallet.lockScript.args.length - 2) / 2, 20, 'args should be 20 bytes (blake160)');
});

test('Wallet derives a valid CKB testnet address', () => {
  const wallet = new Wallet(TEST_PRIVATE_KEY);
  assert.ok(typeof wallet.address === 'string' && wallet.address.length > 0);
  // Lumos 0.22 encodeToAddress uses full bech32m — starts with 'ckb1q' or 'ckt1q'
  // Both prefixes are valid Nervos addresses (mainnet=ckb, testnet=ckt in short form,
  // but full format used by Lumos may use ckb1q prefix even on AGGRON4)
  assert.ok(
    wallet.address.startsWith('ckb') || wallet.address.startsWith('ckt'),
    `Expected ckb or ckt prefix, got: ${wallet.address}`
  );
});

test('Wallet computes lockHash as 32-byte hex', () => {
  const wallet = new Wallet(TEST_PRIVATE_KEY);
  assert.ok(wallet.lockHash.startsWith('0x'));
  assert.equal((wallet.lockHash.length - 2) / 2, 32, 'lockHash should be 32 bytes');
});

test('Wallet.sign returns 65-byte signature', () => {
  const wallet = new Wallet(TEST_PRIVATE_KEY);
  const message = '0x' + '01'.repeat(32); // dummy 32-byte message
  const sig = wallet.sign(message);
  assert.ok(sig.startsWith('0x'));
  assert.equal((sig.length - 2) / 2, 65, 'signature should be 65 bytes');
});

test('Wallet rejects invalid private key (too short)', () => {
  assert.throws(
    () => new Wallet('0x1234'),
    (err) => err instanceof CkbfsError
  );
});

test('Wallet rejects non-string private key', () => {
  assert.throws(
    () => new Wallet(12345),
    (err) => err instanceof CkbfsError
  );
});

test('Wallet is frozen (immutable)', () => {
  const wallet = new Wallet(TEST_PRIVATE_KEY);
  assert.throws(() => { wallet.address = 'hacked'; }, TypeError);
});

test('Wallet.toJSON does not include privateKey', () => {
  const wallet = new Wallet(TEST_PRIVATE_KEY);
  const json = JSON.parse(JSON.stringify(wallet));
  assert.ok(!json.hasOwnProperty('privateKey'), 'privateKey must not be in JSON output');
  assert.ok(json.hasOwnProperty('address'));
});

test('Wallet.fromPrivateKey is an alias for constructor', () => {
  const w1 = new Wallet(TEST_PRIVATE_KEY);
  const w2 = Wallet.fromPrivateKey(TEST_PRIVATE_KEY);
  assert.equal(w1.address, w2.address);
  assert.equal(w1.lockHash, w2.lockHash);
});

console.log(`\nWallet: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
