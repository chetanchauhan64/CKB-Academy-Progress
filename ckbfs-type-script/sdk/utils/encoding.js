/**
 * utils/encoding.js — CKBFS Cell Data Encoding / Decoding
 *
 * Mirrors the binary layout defined in src/cell_data.rs:
 *
 * ┌──────────┬────────┬─────────────┬──────────────┬─────────────┬────────────┐
 * │ version  │ flags  │ chunk_index │ total_chunks │ sha256_hash │  content   │
 * │  1 byte  │ 1 byte │   4 bytes   │   4 bytes    │  32 bytes   │  variable  │
 * └──────────┴────────┴─────────────┴──────────────┴─────────────┴────────────┘
 * Total header: 42 bytes. Content length: data.len() - 42.
 *
 * All multi-byte integers are LITTLE-ENDIAN (matching the Rust impl).
 * Type Script args layout:
 *   [0..32]  = owner_lock_hash  (Blake2b of owner's lock script)
 *   [32..64] = file_id          (arbitrary unique identifier)
 */

import { createHash, randomBytes } from 'crypto';

// ── Constants ──────────────────────────────────────────────────────────────────

export const CURRENT_VERSION = 0x01;
export const MIN_DATA_SIZE = 42; // 1+1+4+4+32 bytes

/** Bit 0 of flags: cell is immutable (cannot be updated). */
export const FLAG_IMMUTABLE = 0b00000001;

/** Bit 1 of flags: all chunks are present on-chain (finalized). */
export const FLAG_FINALIZED = 0b00000010;

// Byte offsets
const OFFSET_VERSION = 0;
const OFFSET_FLAGS = 1;
const OFFSET_CHUNK_INDEX = 2;
const OFFSET_TOTAL_CHUNKS = 6;
const OFFSET_SHA256 = 10;
export const OFFSET_CONTENT = 42;

// ── Encoding ──────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of content and encode a complete CKBFS cell data buffer.
 *
 * @param {object} params
 * @param {number}       params.version       - Must be 0x01.
 * @param {number}       params.flags         - Bit field (FLAG_IMMUTABLE | FLAG_FINALIZED).
 * @param {number}       params.chunkIndex    - Zero-based chunk index.
 * @param {number}       params.totalChunks   - Total number of chunks for the file.
 * @param {Uint8Array}   params.content       - Raw content bytes.
 * @returns {Uint8Array} Encoded 42+content bytes cell data.
 */
export function encodeCellData({ version, flags, chunkIndex, totalChunks, content }) {
  if (version !== CURRENT_VERSION) {
    throw new Error(`Unsupported version: 0x${version.toString(16)} — must be 0x01`);
  }
  if (totalChunks === 0) {
    throw new Error('totalChunks must be > 0');
  }
  if (chunkIndex >= totalChunks) {
    throw new Error(`chunkIndex (${chunkIndex}) must be < totalChunks (${totalChunks})`);
  }
  if (!(content instanceof Uint8Array)) {
    throw new TypeError('content must be a Uint8Array');
  }

  const sha256Hash = sha256(content);
  const buf = Buffer.alloc(MIN_DATA_SIZE + content.length);

  buf.writeUInt8(version, OFFSET_VERSION);
  buf.writeUInt8(flags, OFFSET_FLAGS);
  buf.writeUInt32LE(chunkIndex, OFFSET_CHUNK_INDEX);
  buf.writeUInt32LE(totalChunks, OFFSET_TOTAL_CHUNKS);
  sha256Hash.copy(buf, OFFSET_SHA256);
  content.copy ? content.copy(buf, OFFSET_CONTENT) : buf.set(content, OFFSET_CONTENT);

  return new Uint8Array(buf);
}

/**
 * Decode a raw cell data buffer into its constituent fields.
 * Validates: minimum length, version byte, chunk_index, total_chunks > 0.
 * Does NOT verify the SHA-256 hash — call verifyHash() separately.
 *
 * @param {Uint8Array|Buffer|string} rawData - Raw bytes or 0x-prefixed hex string.
 * @returns {{ version, flags, chunkIndex, totalChunks, sha256Hash, content }}
 */
export function decodeCellData(rawData) {
  const buf = toBuffer(rawData);

  if (buf.length < MIN_DATA_SIZE) {
    throw new Error(`Cell data too short: ${buf.length} < ${MIN_DATA_SIZE}`);
  }

  const version = buf.readUInt8(OFFSET_VERSION);
  if (version !== CURRENT_VERSION) {
    throw new Error(`Unsupported version: 0x${version.toString(16)}`);
  }

  const flags = buf.readUInt8(OFFSET_FLAGS);
  const chunkIndex = buf.readUInt32LE(OFFSET_CHUNK_INDEX);
  const totalChunks = buf.readUInt32LE(OFFSET_TOTAL_CHUNKS);

  if (totalChunks === 0) throw new Error('totalChunks is 0 — invalid cell');
  if (chunkIndex >= totalChunks) {
    throw new Error(`chunkIndex (${chunkIndex}) >= totalChunks (${totalChunks})`);
  }

  const sha256Hash = new Uint8Array(buf.slice(OFFSET_SHA256, OFFSET_SHA256 + 32));
  const content = new Uint8Array(buf.slice(OFFSET_CONTENT));

  return {
    version,
    flags,
    chunkIndex,
    totalChunks,
    sha256Hash,
    content,
    isImmutable: (flags & FLAG_IMMUTABLE) !== 0,
    isFinalized: (flags & FLAG_FINALIZED) !== 0,
  };
}

/**
 * Verify SHA-256(content) matches the stored hash in the decoded cell.
 * Throws if there is a mismatch.
 *
 * @param {{ sha256Hash: Uint8Array, content: Uint8Array }} cell
 */
export function verifyHash(cell) {
  const computed = sha256(cell.content);
  for (let i = 0; i < 32; i++) {
    if (computed[i] !== cell.sha256Hash[i]) {
      throw new Error('SHA-256 hash mismatch — content is corrupted');
    }
  }
}

// ── Type Script Args ──────────────────────────────────────────────────────────

/**
 * Encode the 64-byte Type Script args:
 *   bytes [0..32]  = owner_lock_hash
 *   bytes [32..64] = file_id
 *
 * @param {string} ownerLockHash - 0x-prefixed 32-byte hex (64 hex chars + '0x').
 * @param {string} fileId        - 0x-prefixed 32-byte hex (64 hex chars + '0x').
 * @returns {string} 0x-prefixed 64-byte hex string.
 */
export function encodeTypeArgs(ownerLockHash, fileId) {
  const ownerBytes = hexToBytes(ownerLockHash);
  const fileIdBytes = hexToBytes(fileId);
  if (ownerBytes.length !== 32) throw new Error('ownerLockHash must be 32 bytes');
  if (fileIdBytes.length !== 32) throw new Error('fileId must be 32 bytes');

  return '0x' + Buffer.concat([ownerBytes, fileIdBytes]).toString('hex');
}

/**
 * Decode Type Script args into owner_lock_hash and file_id.
 *
 * @param {string} args - 0x-prefixed 64-byte hex string.
 * @returns {{ ownerLockHash: string, fileId: string }}
 */
export function decodeTypeArgs(args) {
  const buf = hexToBytes(args);
  if (buf.length !== 64) throw new Error(`args must be 64 bytes, got ${buf.length}`);
  return {
    ownerLockHash: '0x' + buf.slice(0, 32).toString('hex'),
    fileId: '0x' + buf.slice(32, 64).toString('hex'),
  };
}

// ── File Chunking ──────────────────────────────────────────────────────────────

/**
 * Split a file buffer into chunks, each encoded as CKBFS cell data.
 *
 * @param {Uint8Array} fileBytes    - Full file content.
 * @param {number}     chunkSize    - Max bytes per chunk (default: 500 KB).
 * @param {number}     flags        - Flags applied to each chunk (0 = none).
 * @returns {Uint8Array[]} Array of encoded cell data buffers, one per chunk.
 */
export function chunkFile(fileBytes, chunkSize = 512_000, flags = 0) {
  const totalChunks = Math.ceil(fileBytes.length / chunkSize) || 1;
  const chunks = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const slice = fileBytes.slice(start, start + chunkSize);
    chunks.push(
      encodeCellData({
        version: CURRENT_VERSION,
        flags,
        chunkIndex: i,
        totalChunks,
        content: slice instanceof Uint8Array ? slice : new Uint8Array(slice),
      })
    );
  }
  return chunks;
}

// ── Low-Level Utilities ────────────────────────────────────────────────────────

/**
 * SHA-256 of a Uint8Array or Buffer. Returns a Buffer of 32 bytes.
 * @param {Uint8Array|Buffer} data
 * @returns {Buffer}
 */
export function sha256(data) {
  return createHash('sha256').update(data).digest();
}

/**
 * Convert a 0x-prefixed hex string to a Buffer.
 * @param {string} hex
 * @returns {Buffer}
 */
export function hexToBytes(hex) {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (stripped.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${stripped.length}`);
  }
  return Buffer.from(stripped, 'hex');
}

/**
 * Convert a Buffer or Uint8Array to a 0x-prefixed hex string.
 * @param {Buffer|Uint8Array} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  return '0x' + Buffer.from(bytes).toString('hex');
}

/**
 * Accept hex string, Buffer, or Uint8Array and always return a Buffer.
 * @param {string|Buffer|Uint8Array} input
 * @returns {Buffer}
 */
function toBuffer(input) {
  if (typeof input === 'string') return hexToBytes(input);
  if (Buffer.isBuffer(input)) return input;
  return Buffer.from(input);
}

/**
 * Generate a random 32-byte file ID (hex string).
 * Uses crypto.randomBytes for cryptographic quality.
 * @returns {string} 0x-prefixed 32-byte hex.
 */
export function generateFileId() {
  return '0x' + randomBytes(32).toString('hex');
}
