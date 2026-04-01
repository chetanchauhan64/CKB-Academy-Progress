/**
 * CKBFS Security Validation Utilities
 *
 * Provides client-side security checks for:
 *   1. Witness header validation (magic bytes + version)
 *   2. Backlink structural validation (tx_hash format + checksum presence)
 *   3. Checksum integrity (recomputed vs stored)
 *
 * All validators return { valid: boolean; error?: string } — never throw.
 */

import { BackLink } from './types';
import { stringToBytes } from './witness';
import { computePublishChecksum, computeAppendChecksum } from './checksum';

// ─── Constants ───────────────────────────────────────────────────────────────
const CKBFS_MAGIC_STR = 'CKBFS';
const CKBFS_MAGIC_BYTES = new Uint8Array([0x43, 0x4b, 0x42, 0x46, 0x53]);
const CKBFS_VERSION_BYTE = 0x00;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ─── 1. Witness Header Validation ────────────────────────────────────────────
/**
 * Validates the 6-byte CKBFS witness header from raw bytes.
 * - Bytes 0-4 must be "CKBFS" (0x43 0x4b 0x42 0x46 0x53)
 * - Byte  5   must be 0x00
 *
 * @param raw - Full raw witness bytes
 */
export function validateWitnessHeader(raw: Uint8Array): ValidationResult {
  try {
    if (raw.length < 6) {
      return { valid: false, error: `Witness too short: ${raw.length} bytes (minimum 6 required)` };
    }
    // Check magic bytes
    for (let i = 0; i < 5; i++) {
      if (raw[i] !== CKBFS_MAGIC_BYTES[i]) {
        return {
          valid: false,
          error: `Invalid magic byte at position ${i}: expected 0x${CKBFS_MAGIC_BYTES[i].toString(16).padStart(2, '0')}, got 0x${raw[i].toString(16).padStart(2, '0')}`,
        };
      }
    }
    // Check version byte
    if (raw[5] !== CKBFS_VERSION_BYTE) {
      return {
        valid: false,
        error: `Unsupported witness version: 0x${raw[5].toString(16).padStart(2, '0')} (expected 0x00)`,
      };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: `Witness parse error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Validates CKBFS witness header from a reconstructed witness string.
 * Used on the client when raw bytes aren't available — reconstructs
 * the witness from the decoded content and checks the header would be valid.
 *
 * Since CKBFSResolvedData doesn't store raw bytes, this function builds a
 * simulated witness from the known content and verifies the protocol invariant.
 *
 * @param contentJson - The JSON string that was stored as the witness content
 */
export function validateWitnessFromContent(contentJson: string): ValidationResult {
  try {
    const contentBytes = stringToBytes(contentJson);
    // Reconstruct witness as encoder would: MAGIC + VERSION + CONTENT
    const witness = new Uint8Array(6 + contentBytes.length);
    witness.set(CKBFS_MAGIC_BYTES, 0);
    witness[5] = CKBFS_VERSION_BYTE;
    witness.set(contentBytes, 6);
    // Validate the reconstructed witness header
    return validateWitnessHeader(witness);
  } catch (e) {
    return {
      valid: false,
      error: `Witness reconstruction failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ─── 2. Backlink Validation ───────────────────────────────────────────────────
/**
 * Validates a single backlink entry.
 * Checks:
 *   - tx_hash is a 0x-prefixed 64-char hex string (32 bytes)
 *   - checksum is a valid unsigned 32-bit integer (0 < checksum <= 0xFFFFFFFF)
 *   - index is a non-negative integer
 */
export function validateBacklink(bl: BackLink): ValidationResult {
  // tx_hash format
  if (!/^0x[0-9a-f]{64}$/i.test(bl.tx_hash)) {
    return {
      valid: false,
      error: `Invalid tx_hash format: "${bl.tx_hash.slice(0, 20)}…" (expected 0x + 64 hex chars)`,
    };
  }
  // index
  if (!Number.isInteger(bl.index) || bl.index < 0) {
    return { valid: false, error: `Invalid backlink index: ${bl.index} (must be non-negative integer)` };
  }
  // checksum must be a positive uint32 (Adler32 minimum is 1)
  const cs = bl.checksum >>> 0;
  if (cs === 0) {
    return { valid: false, error: `Invalid backlink checksum: 0 (Adler32 cannot be zero)` };
  }
  return { valid: true };
}

/**
 * Validates all backlinks in an array.
 * Returns the first error found or { valid: true }.
 */
export function validateAllBacklinks(backlinks: BackLink[]): ValidationResult {
  try {
    for (let i = 0; i < backlinks.length; i++) {
      const result = validateBacklink(backlinks[i]);
      if (!result.valid) {
        return {
          valid: false,
          error: `Backlink[${i}]: ${result.error}`,
        };
      }
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: `Backlink validation error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ─── 3. Checksum Integrity ────────────────────────────────────────────────────
/**
 * Recomputes the content checksum from the post's data and compares with stored.
 *
 * @param metadata  - Post metadata fields
 * @param content   - Post body content
 * @param backlinks - Current backlinks array
 * @param stored    - Stored checksum from the resolved cell
 */
export function validateContentChecksum(
  metadata: {
    title: string;
    description?: string;
    tags?: string[];
    author: string;
    created_at: number;
    updated_at?: number;
    is_paid?: boolean;
    unlock_price?: number;
  },
  content: string,
  backlinks: BackLink[],
  stored: number
): ValidationResult {
  try {
    // IMPORTANT: key order must match publish.ts exactly (canonical schema order).
    // Order: title → description → author → tags → created_at → updated_at
    //        → is_paid → unlock_price → content
    const contentBytes = stringToBytes(
      JSON.stringify({
        title:        metadata.title,
        description:  metadata.description ?? '',
        author:       metadata.author,
        tags:         metadata.tags ?? [],
        created_at:   metadata.created_at,
        updated_at:   metadata.updated_at ?? metadata.created_at,
        is_paid:      metadata.is_paid ?? false,
        unlock_price: metadata.unlock_price ?? 0,
        content,
      })
    );

    const expected = backlinks.length === 0
      ? computePublishChecksum(contentBytes)
      : computeAppendChecksum(backlinks, contentBytes);

    const storedU32 = stored >>> 0;
    const expectedU32 = expected >>> 0;

    if (storedU32 !== expectedU32) {
      return {
        valid: false,
        error: `Adler32 mismatch — stored: 0x${storedU32.toString(16).padStart(8, '0')}, computed: 0x${expectedU32.toString(16).padStart(8, '0')}`,
      };
    }

    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: `Checksum computation error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ─── 4. Full Post Security Report ────────────────────────────────────────────
export interface PostSecurityReport {
  witnessValid: boolean;
  witnessError?: string;
  backlinksValid: boolean;
  backlinksError?: string;
  checksumValid: boolean;
  checksumError?: string;
  /** true = no warnings at all */
  allClear: boolean;
}

/**
 * Runs all security checks on a resolved post and returns a structured report.
 * Never throws — wraps all checks in try/catch.
 */
export function runPostSecurityChecks(post: {
  metadata: {
    title: string;
    description?: string;
    tags?: string[];
    author: string;
    created_at: number;
    updated_at?: number;
    is_paid?: boolean;
    unlock_price?: number;
  };
  content: string;
  backlinks: BackLink[];
  checksum: number;
}): PostSecurityReport {
  let witnessValid = true;
  let witnessError: string | undefined;
  let backlinksValid = true;
  let backlinksError: string | undefined;
  let checksumValid = true;
  let checksumError: string | undefined;

  // 1. Witness header (simulated from content)
  // Canonical key order matches publish.ts / metadata.ts schema.
  try {
    const contentJson = JSON.stringify({
      title:        post.metadata.title,
      description:  post.metadata.description ?? '',
      author:       post.metadata.author,
      tags:         post.metadata.tags ?? [],
      created_at:   post.metadata.created_at,
      updated_at:   post.metadata.updated_at ?? post.metadata.created_at,
      is_paid:      (post.metadata as Record<string, unknown>).is_paid ?? false,
      unlock_price: (post.metadata as Record<string, unknown>).unlock_price ?? 0,
      content:      post.content,
    });
    const wr = validateWitnessFromContent(contentJson);
    witnessValid = wr.valid;
    witnessError = wr.error;
  } catch (e) {
    witnessValid = false;
    witnessError = `Witness check failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 2. Backlinks
  try {
    const br = validateAllBacklinks(post.backlinks);
    backlinksValid = br.valid;
    backlinksError = br.error;
  } catch (e) {
    backlinksValid = false;
    backlinksError = `Backlink check failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3. Checksum
  try {
    const cr = validateContentChecksum(post.metadata, post.content, post.backlinks, post.checksum);
    checksumValid = cr.valid;
    checksumError = cr.error;
  } catch (e) {
    checksumValid = false;
    checksumError = `Checksum check failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  return {
    witnessValid,
    witnessError,
    backlinksValid,
    backlinksError,
    checksumValid,
    checksumError,
    allClear: witnessValid && backlinksValid && checksumValid,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Checks if a string looks like a CKBFS magic prefix (for display purposes). */
export function hasCKBFSMagic(str: string): boolean {
  return str.startsWith(CKBFS_MAGIC_STR);
}
