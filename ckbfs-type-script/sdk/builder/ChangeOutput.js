/**
 * builder/ChangeOutput.js — Change Cell Computation
 *
 * Computes the leftover capacity after outputs and fee are deducted from inputs,
 * and decides whether to create a change output or absorb the remainder as extra fee.
 *
 * RULES:
 *   change = totalInputCapacity - totalOutputCapacity - fee
 *
 *   if change >= MIN_CHANGE_CAPACITY (61 CKB):
 *     → add a change output to the transaction
 *   else if 0 <= change < MIN_CHANGE_CAPACITY:
 *     → absorb into fee (CKB allows the miner to keep the extra)
 *   else (change < 0):
 *     → throw InsufficientCapacityError (caller must add more inputs)
 */

import { InsufficientCapacityError } from '../utils/errors.js';
import { MIN_CHANGE_CAPACITY } from './FeeCalculator.js';

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Compute the change amount and (optionally) build a change cell.
 *
 * @param {object} params
 * @param {bigint}   params.totalInputCapacity  - Sum of all input cell capacities (shannons).
 * @param {bigint}   params.totalOutputCapacity - Sum of all planned output capacities (shannons).
 * @param {bigint}   params.fee                 - Estimated transaction fee (shannons).
 * @param {object}   params.lockScript          - Owner's lock script (for change cell).
 * @returns {{ hasChange: boolean, changeCapacity: bigint, changeCell: object|null }}
 * @throws {InsufficientCapacityError} if totalInputCapacity < totalOutputCapacity + fee
 */
export function computeChange({ totalInputCapacity, totalOutputCapacity, fee, lockScript }) {
  const required = totalOutputCapacity + fee;
  const change = totalInputCapacity - required;

  // Deficit — caller must inject more inputs
  if (change < 0n) {
    throw new InsufficientCapacityError(required, totalInputCapacity);
  }

  // Remainder too small for its own cell — give to miner as extra fee
  if (change < MIN_CHANGE_CAPACITY) {
    return {
      hasChange: false,
      changeCapacity: 0n,
      changeCell: null,
      extraFee: change, // informational — the miner gets this
    };
  }

  // Build a plain change output (no type script, no data)
  const changeCell = {
    cellOutput: {
      capacity: '0x' + change.toString(16),
      lock: lockScript,
      type: null,
    },
    data: '0x',
  };

  return {
    hasChange: true,
    changeCapacity: change,
    changeCell,
    extraFee: 0n,
  };
}

/**
 * Compute the total capacity of an array of output cell descriptors.
 *
 * @param {object[]} outputs - Array of { cellOutput: { capacity } } objects.
 * @returns {bigint}
 */
export function sumOutputCapacity(outputs) {
  return outputs.reduce((sum, o) => sum + BigInt(o.cellOutput.capacity), 0n);
}

/**
 * Compute the total capacity of an array of live cells (from indexer).
 *
 * @param {object[]} cells - Array of Lumos cell objects with cellOutput.capacity.
 * @returns {bigint}
 */
export function sumInputCapacity(cells) {
  return cells.reduce((sum, c) => sum + BigInt(c.cellOutput.capacity), 0n);
}
