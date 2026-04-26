/**
 * utils/encoding.ts — CKBFS binary encoding / decoding
 *
 * Cell data layout (binary):
 *   [0]      version      (u8)
 *   [1]      flags        (u8)  bit-0 = is_finalized
 *   [2..5]   chunk_index  (u32 LE)
 *   [6..9]   total_chunks (u32 LE)
 *   [10..]   content      (bytes)
 *
 * Type args layout (64 bytes):
 *   [0..31]  file_id        (32 bytes)
 *   [32..63] owner_lock_hash (32 bytes)
 */

import type { DecodedCellData, TypeArgs } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error('Odd-length hex string');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { out.set(arr, offset); offset += arr.length; }
  return out;
}

// SHA-256 using SubtleCrypto (browser + Node 18+)
export async function sha256Async(data: Uint8Array): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
    return new Uint8Array(hash);
  }
  // Node.js fallback
  const { createHash } = await import('crypto');
  const buf = createHash('sha256').update(Buffer.from(data)).digest();
  return new Uint8Array(buf);
}

// Sync SHA-256 for Node.js (API routes)
export function sha256Sync(data: Uint8Array): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('crypto');
  return new Uint8Array(createHash('sha256').update(Buffer.from(data)).digest());
}

// ─── Cell data ────────────────────────────────────────────────────────────────

const CURRENT_VERSION = 1;
const HEADER_SIZE = 10; // version(1) + flags(1) + chunkIndex(4) + totalChunks(4)

export function encodeCellData(params: {
  version?: number;
  flags?: number;
  chunkIndex: number;
  totalChunks: number;
  content: Uint8Array;
}): Uint8Array {
  const { version = CURRENT_VERSION, flags = 0, chunkIndex, totalChunks, content } = params;
  const header = new Uint8Array(HEADER_SIZE);
  const view = new DataView(header.buffer);
  header[0] = version;
  header[1] = flags;
  view.setUint32(2, chunkIndex, true);
  view.setUint32(6, totalChunks, true);
  return concatBytes(header, content);
}

export function decodeCellData(data: string | Uint8Array): DecodedCellData {
  const bytes = typeof data === 'string' ? hexToBytes(data) : data;
  if (bytes.length < HEADER_SIZE) throw new Error('Cell data too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const version = bytes[0];
  const flags = bytes[1];
  const chunkIndex = view.getUint32(2, true);
  const totalChunks = view.getUint32(6, true);
  const content = bytes.slice(HEADER_SIZE);
  const isFinalized = (flags & 1) !== 0;
  return { version, flags, chunkIndex, totalChunks, content, isFinalized };
}

// ─── Type args ────────────────────────────────────────────────────────────────

export function encodeTypeArgs(fileId: string, ownerLockHash: string): Uint8Array {
  const fid = hexToBytes(fileId.startsWith('0x') ? fileId.slice(2) : fileId);
  const olh = hexToBytes(ownerLockHash.startsWith('0x') ? ownerLockHash.slice(2) : ownerLockHash);
  if (fid.length !== 32) throw new Error('fileId must be 32 bytes');
  if (olh.length !== 32) throw new Error('ownerLockHash must be 32 bytes');
  return concatBytes(fid, olh);
}

export function decodeTypeArgs(args: string): TypeArgs {
  const bytes = hexToBytes(args.startsWith('0x') ? args.slice(2) : args);
  if (bytes.length < 64) throw new Error('Type args too short');
  const fileId = '0x' + Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join('');
  const ownerLockHash = '0x' + Array.from(bytes.slice(32, 64)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { fileId, ownerLockHash };
}

// ─── File ID ──────────────────────────────────────────────────────────────────

export function generateFileId(ownerLockHash: string, content: Uint8Array): string {
  const lockBytes = hexToBytes(ownerLockHash.startsWith('0x') ? ownerLockHash.slice(2) : ownerLockHash);
  const timestamp = BigInt(Date.now());
  const tsBytes = new Uint8Array(8);
  const tsView = new DataView(tsBytes.buffer);
  tsView.setBigUint64(0, timestamp, true);

  const random = new Uint8Array(8);
  if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(random);
  } else {
    // Node.js
    const { randomBytes } = require('crypto');
    random.set(randomBytes(8));
  }

  const preimage = concatBytes(lockBytes, tsBytes, random, content.slice(0, Math.min(32, content.length)));
  const hash = sha256Sync(preimage);
  return '0x' + Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Chunking ────────────────────────────────────────────────────────────────

export const DEFAULT_CHUNK_SIZE = 32 * 1024; // 32 KB

export function splitIntoChunks(content: Uint8Array, chunkSize = DEFAULT_CHUNK_SIZE): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(content.slice(i, i + chunkSize));
  }
  return chunks.length > 0 ? chunks : [new Uint8Array(0)];
}

// ─── Lock hash ───────────────────────────────────────────────────────────────

export function computeLockHash(lockScript: { codeHash: string; hashType: string; args: string }): string {
  // Simplified: use codeHash+hashType+args concat hash as lock hash
  // In production use ckb-lumos utils.computeScriptHash()
  const { codeHash, hashType, args } = lockScript;
  const hashTypeNum = hashType === 'type' ? 1 : hashType === 'data1' ? 2 : 0;
  const ch = hexToBytes(codeHash.startsWith('0x') ? codeHash.slice(2) : codeHash);
  const ar = hexToBytes(args.startsWith('0x') ? args.slice(2) : args);
  const htb = new Uint8Array([hashTypeNum]);
  const preimage = concatBytes(ch, htb, ar);
  return bytesToHex(sha256Sync(preimage));
}
