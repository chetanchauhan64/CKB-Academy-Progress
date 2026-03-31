/**
 * CKBFS Checksum Logic
 *
 * Protocol rule:
 *   - Checksum uses Adler32
 *   - On PUBLISH:  checksum = Adler32(content_bytes)
 *   - On APPEND:   recover previous checksum from backlinks,
 *                  then update with new content bytes
 *   - On TRANSFER: checksum MUST NOT change
 *   - On FORK:     compute fresh from combined backlink + new content
 *
 * Validation:
 *   If backlinks exist → recover previous checksum from last backlink
 *   Update with new content bytes
 *   Final checksum must match stored checksum in cell data
 */

import * as ADLER32 from 'adler-32';
import { BackLink } from './types';

// ─── Core Adler32 ────────────────────────────────────────────────────────────
/**
 * Computes Adler32 checksum of a Uint8Array.
 * Used for PUBLISH (no prior state).
 *
 * @param content - Raw content bytes (EXCLUDING witness header)
 * @returns Unsigned 32-bit Adler32 checksum
 */
export function computeChecksum(content: Uint8Array): number {
  // adler-32 accepts Uint8Array directly; returns signed int32
  // Convert to unsigned 32-bit via >>> 0
  const signed = ADLER32.buf(content);
  return signed >>> 0;
}

// ─── Adler32 Continuation ────────────────────────────────────────────────────
/**
 * Continues an Adler32 checksum from a prior value.
 * This is the stateful update used during APPEND.
 *
 * Adler32(prev_content || new_content) =
 *   adler32_cont(new_content, prev_checksum)
 *
 * @param prevChecksum - Adler32 from the previous state (signed or unsigned)
 * @param newContent   - New bytes being appended to the logical file
 * @returns Updated unsigned 32-bit Adler32
 */
export function updateChecksum(prevChecksum: number, newContent: Uint8Array): number {
  // adler-32 `buf` accepts an optional seed parameter
  const signed = ADLER32.buf(newContent, prevChecksum);
  return signed >>> 0;
}

// ─── Recover From Backlinks ──────────────────────────────────────────────────
/**
 * Recovers the "previous checksum" for an APPEND operation.
 *
 * Protocol rule:
 *   If backlinks exist → the last backlink's checksum IS the previous checksum.
 *   If no backlinks exist → previous checksum is the initial Adler32(1) seed = 1
 *     (Adler32 initial S1=1, S2=0, combined = 1)
 *
 * @param backlinks - Current array of backlinks from the cell
 * @returns The previous checksum to use as continuation seed
 */
export function recoverChecksumFromBacklinks(backlinks: BackLink[]): number {
  if (backlinks.length === 0) {
    // No prior content — use Adler32 initial seed value (1)
    return 1;
  }
  // The last backlink stores the checksum of the content at that point
  return backlinks[backlinks.length - 1].checksum;
}

// ─── Validate Checksum ───────────────────────────────────────────────────────
/**
 * Validates that a newly computed checksum matches the stored cell checksum.
 * Call this before submitting any CKBFS transaction to verify correctness.
 *
 * @param backlinks      - Existing backlinks in the cell
 * @param newContent     - New content bytes being added this transaction
 * @param storedChecksum - The checksum stored in the cell data
 * @returns true if checksums match, false otherwise
 */
export function validateChecksum(
  backlinks: BackLink[],
  newContent: Uint8Array,
  storedChecksum: number
): boolean {
  const prevChecksum = recoverChecksumFromBacklinks(backlinks);
  const computedChecksum = updateChecksum(prevChecksum, newContent);
  return computedChecksum === (storedChecksum >>> 0);
}

/**
 * Computes the expected checksum for a PUBLISH operation
 * (no prior backlinks, fresh Adler32 of content).
 */
export function computePublishChecksum(content: Uint8Array): number {
  return computeChecksum(content);
}

/**
 * Computes the expected checksum for an APPEND operation.
 * Chains from the last backlink's checksum.
 *
 * @param existingBacklinks - All current backlinks (BEFORE adding the new one)
 * @param newContent - New content bytes being appended
 */
export function computeAppendChecksum(
  existingBacklinks: BackLink[],
  newContent: Uint8Array
): number {
  const prevChecksum = recoverChecksumFromBacklinks(existingBacklinks);
  return updateChecksum(prevChecksum, newContent);
}
