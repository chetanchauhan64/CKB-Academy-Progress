/**
 * tests/04_changeOutput.js — Unit tests for builder/ChangeOutput.js
 */
import assert from 'node:assert/strict';
import { computeChange, sumOutputCapacity, sumInputCapacity } from '../builder/ChangeOutput.js';
import { MIN_CHANGE_CAPACITY } from '../builder/FeeCalculator.js';
import { InsufficientCapacityError } from '../utils/errors.js';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.error(`  ❌ ${name}: ${e.message}`); fail++; }
}

const LOCK = {
  codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
  hashType: 'type',
  args: '0x' + 'ab'.repeat(20),
};

const ONE_CKB = 100_000_000n;

test('change cell created when remainder >= MIN_CHANGE_CAPACITY', () => {
  const input   = 200n * ONE_CKB;
  const output  = 100n * ONE_CKB;
  const fee     = 1_000n;
  const result = computeChange({ totalInputCapacity: input, totalOutputCapacity: output, fee, lockScript: LOCK });
  assert.ok(result.hasChange, 'should have change');
  assert.ok(result.changeCell !== null);
  assert.equal(result.changeCapacity, input - output - fee);
});

test('change absorbed into fee when small remainder', () => {
  // Make remainder = 1 CKB (below MIN_CHANGE_CAPACITY = 61 CKB)
  const input  = 101n * ONE_CKB;
  const output = 100n * ONE_CKB;
  const fee    = 0n;
  const result = computeChange({ totalInputCapacity: input, totalOutputCapacity: output, fee, lockScript: LOCK });
  assert.ok(!result.hasChange, 'should NOT have change cell');
  assert.equal(result.changeCell, null);
  assert.ok(result.extraFee > 0n);
});

test('throws InsufficientCapacityError when inputs < outputs + fee', () => {
  assert.throws(
    () => computeChange({
      totalInputCapacity: 50n * ONE_CKB,
      totalOutputCapacity: 100n * ONE_CKB,
      fee: 1_000n,
      lockScript: LOCK,
    }),
    (e) => e instanceof InsufficientCapacityError
  );
});

test('sumOutputCapacity handles hex capacity strings', () => {
  const outputs = [
    { cellOutput: { capacity: '0x' + (100n * ONE_CKB).toString(16) } },
    { cellOutput: { capacity: '0x' + (200n * ONE_CKB).toString(16) } },
  ];
  assert.equal(sumOutputCapacity(outputs), 300n * ONE_CKB);
});

test('sumInputCapacity handles cell objects', () => {
  const cells = [
    { cellOutput: { capacity: '0x' + (50n * ONE_CKB).toString(16) } },
    { cellOutput: { capacity: '0x' + (75n * ONE_CKB).toString(16) } },
  ];
  assert.equal(sumInputCapacity(cells), 125n * ONE_CKB);
});

console.log(`\nChangeOutput: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
