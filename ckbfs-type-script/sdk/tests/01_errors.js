/**
 * tests/01_errors.js — Unit tests for utils/errors.js
 */
import assert from 'node:assert/strict';
import {
  CkbfsError,
  InsufficientCapacityError,
  InvalidCellError,
  HashMismatchError,
  ImmutableCellError,
  NetworkError,
  IndexerNotSyncedError,
  TransactionRejectedError,
  ConfirmationTimeoutError,
  FileNotFoundError,
} from '../utils/errors.js';

let pass = 0, fail = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.error(`  ❌ ${name}: ${e.message}`); fail++; }
}

test('CkbfsError is base class', () => {
  const err = new CkbfsError('test', { foo: 1 });
  assert.equal(err.name, 'CkbfsError');
  assert.equal(err.context.foo, 1);
  assert.ok(err instanceof Error);
});

test('InsufficientCapacityError computes shortfall', () => {
  const err = new InsufficientCapacityError(200n, 100n);
  assert.equal(err.name, 'InsufficientCapacityError');
  assert.equal(err.context.shortfall, 100n);
  assert.ok(err instanceof CkbfsError);
});

test('HashMismatchError stores hashes', () => {
  const err = new HashMismatchError('0xaa', '0xbb', { txHash: '0x1', index: 0 });
  assert.equal(err.context.stored, '0xaa');
  assert.equal(err.context.computed, '0xbb');
});

test('ImmutableCellError stores chunkIndex', () => {
  const err = new ImmutableCellError(3);
  assert.equal(err.context.chunkIndex, 3);
});

test('IndexerNotSyncedError computes lag', () => {
  const err = new IndexerNotSyncedError(1000n, 990n, 5);
  assert.equal(err.context.lag, 10n);
});

test('All error types are instanceof CkbfsError', () => {
  const types = [
    new InvalidCellError('x'),
    new NetworkError('x', 'url'),
    new TransactionRejectedError('0x1', 'reason'),
    new ConfirmationTimeoutError('0x1', 1000, 'pending'),
    new FileNotFoundError('0xid', 'addr'),
  ];
  for (const e of types) assert.ok(e instanceof CkbfsError, e.name);
});

console.log(`\nErrors: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
