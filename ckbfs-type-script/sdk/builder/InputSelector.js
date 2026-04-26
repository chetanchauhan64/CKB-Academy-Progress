/**
 * builder/InputSelector.js — Live Cell Coin Selection
 *
 * Uses the CKB node's built-in indexer (available via the main RPC since CKB v0.34+).
 * This avoids dependency on a separate indexer service and works with testnet.ckbapp.dev.
 *
 * WHY THIS MATTERS:
 *   CKB transactions must explicitly list all input cells. Unlike Bitcoin/EVM,
 *   there is no implicit "wallet pays fee" — the builder must:
 *   1. Fetch all spendable cells from the node indexer.
 *   2. Accumulate until their capacity sum >= (required outputs + fee).
 *   3. Pass selected cells as transaction inputs.
 *
 * SAFETY RULES:
 *   - Only select cells with NO type script (plain CKB capacity cells).
 *     Selecting type-script cells could accidentally destroy CKBFS data cells.
 *   - Only select cells with data = '0x' (no data).
 *   - Never select cells from a different lock script.
 */

import { helpers, RPC } from '@ckb-lumos/lumos';
import { CKB_RPC_URL, CKB_INDEXER_URL, CKBFS_CODE_HASH } from '../config.js';
import { InsufficientCapacityError, NetworkError } from '../utils/errors.js';

// ── Singleton RPC (built-in indexer) ──────────────────────────────────────────

let _rpc = null;
export function getIndexer() {
  if (!_rpc) _rpc = new RPC(CKB_RPC_URL);
  return _rpc;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Minimum capacity for a plain change cell (lock-only, no type, no data).
 * 8 (capacity) + 49 (secp256k1 lock) = 57 bytes → 57 CKB. We use 61 for margin.
 */
export const MIN_CHANGE_CAPACITY = 6_100_000_000n; // 61 CKB in shannons

const PAGE_LIMIT = '0x64'; // 100 cells per page

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Select enough live cells to cover a required capacity.
 *
 * Uses getCells via the built-in CKB node indexer.
 *
 * @param {object} params
 * @param {string} params.address          - CKB testnet address of the owner.
 * @param {bigint} params.requiredCapacity - Minimum shannons needed.
 * @param {object[]} [params.excludeOutPoints] - Out-points to skip.
 * @returns {Promise<{ selectedCells: object[], totalInputCapacity: bigint }>}
 */
export async function selectInputCells({ address, requiredCapacity, excludeOutPoints = [] }) {
  const rpc = getIndexer();
  const lockScript = helpers.parseAddress(address);

  const excluded = new Set(
    excludeOutPoints.map((op) => `${op.txHash}:${normalizeIndex(op.index)}`)
  );

  const selectedCells = [];
  let totalInputCapacity = 0n;
  let cursor = null;

  try {
    while (true) {
      const params = {
        script: lockScript,
        scriptType: 'lock',
        filter: {
          script: null,       // no type script
          outputDataLenRange: ['0x0', '0x1'], // data length 0 only
        },
      };

      const args = cursor
        ? [params, 'asc', PAGE_LIMIT, cursor]
        : [params, 'asc', PAGE_LIMIT];

      const result = await rpc.getCells(...args);
      const cells = result.objects ?? [];

      for (const cell of cells) {
        const opKey = `${cell.outPoint.txHash}:${normalizeIndex(cell.outPoint.index)}`;
        if (excluded.has(opKey)) continue;
        if (cell.output.type) continue; // skip cells with type script
        if (cell.outputData && cell.outputData !== '0x') continue; // skip cells with data

        selectedCells.push({
          outPoint: cell.outPoint,
          cellOutput: {
            capacity: cell.output.capacity,
            lock: cell.output.lock,
            type: cell.output.type ?? null,
          },
          data: cell.outputData ?? '0x',
          blockHash: cell.blockHash,
          blockNumber: cell.blockNumber,
        });

        totalInputCapacity += BigInt(cell.output.capacity);
        if (totalInputCapacity >= requiredCapacity) break;
      }

      if (totalInputCapacity >= requiredCapacity) break;

      cursor = result.lastCursor;
      if (!cursor || cells.length === 0) break;
    }
  } catch (err) {
    throw new NetworkError(
      `Cell query failed: ${err.message}`,
      CKB_RPC_URL,
      'getCells',
      err
    );
  }

  if (totalInputCapacity < requiredCapacity) {
    throw new InsufficientCapacityError(requiredCapacity, totalInputCapacity);
  }

  return { selectedCells, totalInputCapacity };
}

/**
 * Query the total spendable CKB balance of an address.
 * @param {string} address
 * @returns {Promise<bigint>}
 */
export async function getBalance(address) {
  const rpc = getIndexer();
  const lockScript = helpers.parseAddress(address);

  let total = 0n;
  let cursor = null;

  try {
    while (true) {
      const params = {
        script: lockScript,
        scriptType: 'lock',
        filter: {
          script: null,
          outputDataLenRange: ['0x0', '0x1'],
        },
      };
      const args = cursor ? [params, 'asc', PAGE_LIMIT, cursor] : [params, 'asc', PAGE_LIMIT];
      const result = await rpc.getCells(...args);
      const cells = result.objects ?? [];

      for (const cell of cells) {
        if (!cell.output.type && (!cell.outputData || cell.outputData === '0x')) {
          total += BigInt(cell.output.capacity);
        }
      }

      cursor = result.lastCursor;
      if (!cursor || cells.length === 0) break;
    }
  } catch (err) {
    throw new NetworkError(`Balance query failed: ${err.message}`, CKB_RPC_URL, 'getCells', err);
  }
  return total;
}

/**
 * Find all live CKBFS cells for a given address and code_hash.
 * @param {string} address
 * @param {string} codeHash
 * @returns {Promise<object[]>}
 */
export async function findCkbfsCells(address, codeHash) {
  const rpc = getIndexer();
  const lockScript = helpers.parseAddress(address);

  const cells = [];
  let cursor = null;

  try {
    while (true) {
      const params = {
        script: lockScript,
        scriptType: 'lock',
        filter: {
          script: {
            codeHash,
            hashType: 'data1',
            args: '0x',
          },
        },
      };
      const args = cursor ? [params, 'asc', PAGE_LIMIT, cursor] : [params, 'asc', PAGE_LIMIT];
      const result = await rpc.getCells(...args);
      const objs = result.objects ?? [];

      for (const cell of objs) {
        cells.push({
          outPoint: cell.outPoint,
          cellOutput: {
            capacity: cell.output.capacity,
            lock: cell.output.lock,
            type: cell.output.type ?? null,
          },
          data: cell.outputData ?? '0x',
        });
      }

      cursor = result.lastCursor;
      if (!cursor || objs.length === 0) break;
    }
  } catch (err) {
    throw new NetworkError(`CKBFS cell query failed: ${err.message}`, CKB_RPC_URL, null, err);
  }
  return cells;
}

/**
 * Find CKBFS cells matching a specific file_id in the type args.
 * @param {string} address
 * @param {string} codeHash
 * @param {string} fileId
 * @returns {Promise<object[]>} Sorted by chunkIndex.
 */
export async function findCkbfsCellsByFileId(address, codeHash, fileId) {
  const { decodeTypeArgs, decodeCellData } = await import('../utils/encoding.js');
  const all = await findCkbfsCells(address, codeHash);

  return all
    .filter((cell) => {
      try {
        if (!cell.cellOutput.type) return false;
        const { fileId: fid } = decodeTypeArgs(cell.cellOutput.type.args);
        return fid.toLowerCase() === fileId.toLowerCase();
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      try {
        return decodeCellData(a.data).chunkIndex - decodeCellData(b.data).chunkIndex;
      } catch {
        return 0;
      }
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeIndex(index) {
  return typeof index === 'string' ? parseInt(index, 16) : index;
}
