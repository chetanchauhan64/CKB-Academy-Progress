/**
 * CKBFS Witness Encoding / Decoding
 *
 * Witness format per CKBFS protocol:
 *   Bytes 0-4 : "CKBFS" magic (0x43 0x4b 0x42 0x46 0x53)
 *   Byte  5   : version (0x00)
 *   Bytes 6+  : raw content
 *
 * NEVER call this module with pre-encoded witnesses.
 * NEVER strip the header from stored witnesses.
 */

import { CKBFS_MAGIC, CKBFS_VERSION, CKBFS_HEADER_LENGTH, CKBFSWitness } from './types';

// ─── Encode ──────────────────────────────────────────────────────────────────
/**
 * Encodes raw content bytes into a CKBFS-compliant witness.
 * Prepends the 5-byte "CKBFS" magic + 1-byte version (0x00).
 *
 * @param content - The raw file/post content bytes
 * @returns Full witness bytes: MAGIC(5) + VERSION(1) + CONTENT
 */
export function encodeWitness(content: Uint8Array): Uint8Array {
  const witness = new Uint8Array(CKBFS_HEADER_LENGTH + content.length);
  witness.set(CKBFS_MAGIC, 0);         // bytes 0-4: "CKBFS"
  witness[5] = CKBFS_VERSION;          // byte 5: 0x00
  witness.set(content, 6);             // bytes 6+: content
  return witness;
}

// ─── Decode ──────────────────────────────────────────────────────────────────
/**
 * Decodes a raw CKBFS witness, validates magic + version, returns content.
 *
 * @param raw - Full raw witness bytes including header
 * @returns Parsed CKBFSWitness with content bytes
 * @throws Error if magic or length is invalid
 */
export function decodeWitness(raw: Uint8Array): CKBFSWitness {
  if (raw.length < CKBFS_HEADER_LENGTH) {
    throw new Error(
      `CKBFS: witness too short (${raw.length} bytes, need at least ${CKBFS_HEADER_LENGTH})`
    );
  }

  // Validate magic bytes
  const magic = raw.slice(0, 5);
  for (let i = 0; i < CKBFS_MAGIC.length; i++) {
    if (magic[i] !== CKBFS_MAGIC[i]) {
      throw new Error(
        `CKBFS: invalid magic at byte ${i} — expected 0x${CKBFS_MAGIC[i].toString(16)}, got 0x${magic[i].toString(16)}`
      );
    }
  }

  const version = raw[5];
  if (version !== CKBFS_VERSION) {
    throw new Error(
      `CKBFS: unsupported version 0x${version.toString(16)} — expected 0x${CKBFS_VERSION.toString(16)}`
    );
  }

  const content = raw.slice(CKBFS_HEADER_LENGTH);

  return {
    magic: 'CKBFS',
    version,
    content,
  };
}

// ─── Validate ────────────────────────────────────────────────────────────────
/**
 * Validates that a byte array is a well-formed CKBFS witness.
 * Does NOT throw — returns boolean for safe checks.
 */
export function validateWitnessFormat(raw: Uint8Array): boolean {
  try {
    decodeWitness(raw);
    return true;
  } catch {
    return false;
  }
}

// ─── Hex Utilities ───────────────────────────────────────────────────────────
/**
 * Converts a hex string (with or without 0x prefix) to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error(`CKBFS: odd-length hex string`);
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a 0x-prefixed hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * UTF-8 string → Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Uint8Array → UTF-8 string
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
