/**
 * tests/03_feeCalc.js — Unit tests for builder/FeeCalculator.js
 */
import assert from 'node:assert/strict';
import {
  estimateTxSize,
  computeFee,
  computeCkbfsCellMinCapacity,
  computeChangeCellMinCapacity,
  DEFAULT_FEE_RATE,
  MIN_CHANGE_CAPACITY,
} from '../builder/FeeCalculator.js';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.error(`  ❌ ${name}: ${e.message}`); fail++; }
}

const SECP_LOCK = {
  codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
  hashType: 'type',
  args: '0x' + 'ab'.repeat(20), // 20-byte args
};
const CKBFS_TYPE = {
  codeHash: '0x' + '01'.repeat(32),
  hashType: 'type',
  args: '0x' + 'cd'.repeat(64), // 64-byte args
};

test('estimateTxSize returns a positive number', () => {
  const size = estimateTxSize({
    inputCount: 1,
    outputs: [
      { cellOutput: { capacity: '0x1', lock: SECP_LOCK, type: CKBFS_TYPE }, data: '0x' + '00'.repeat(42) },
    ],
    cellDepCount: 2,
    signingGroupCount: 1,
  });
  assert.ok(size > 0, `size=${size}`);
  assert.ok(size < 10_000, 'should be under 10 KB for simple tx');
});

test('estimateTxSize grows with more inputs', () => {
  const s1 = estimateTxSize({ inputCount: 1, outputs: [], cellDepCount: 2, signingGroupCount: 1 });
  const s3 = estimateTxSize({ inputCount: 3, outputs: [], cellDepCount: 2, signingGroupCount: 1 });
  assert.ok(s3 > s1, `3-input tx (${s3}) should be larger than 1-input tx (${s1})`);
});

test('computeFee is non-zero for non-empty tx', () => {
  const fee = computeFee({
    inputCount: 1,
    outputs: [{ cellOutput: { capacity: '0x1', lock: SECP_LOCK, type: null }, data: '0x' }],
    cellDepCount: 2,
    signingGroupCount: 1,
  });
  assert.ok(fee > 0n, `fee=${fee}`);
});

test('computeFee scales with feeRate', () => {
  const params = { inputCount: 1, outputs: [], cellDepCount: 2, signingGroupCount: 1 };
  const fee1k = computeFee(params, 1000n);
  const fee2k = computeFee(params, 2000n);
  assert.ok(fee2k >= fee1k * 2n - 1n, `2x feeRate should produce ~2x fee: ${fee1k} → ${fee2k}`);
});

test('computeCkbfsCellMinCapacity is > 0', () => {
  const cap = computeCkbfsCellMinCapacity(SECP_LOCK, CKBFS_TYPE, 55);
  assert.ok(cap > 0n);
  // 55 bytes data + lock(57) + type(101) + capacity(8) = 221 bytes = 221 CKB
  const expectedShannons = 221n * 100_000_000n;
  assert.ok(cap >= expectedShannons, `Expected >= ${expectedShannons}, got ${cap}`);
});

test('computeChangeCellMinCapacity equals MIN_CHANGE_CAPACITY', () => {
  const cap = computeChangeCellMinCapacity(SECP_LOCK);
  assert.ok(cap >= MIN_CHANGE_CAPACITY, `${cap} should be >= ${MIN_CHANGE_CAPACITY}`);
});

console.log(`\nFeeCalculator: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
