/**
 * CKBFS Cell Data Codec
 *
 * Encodes and decodes the structured data stored in a CKBFS cell's `data` field.
 *
 * Schema (length-prefixed byte packing — no Molecule compiler dependency):
 *
 *  [4 bytes] content_type length (LE uint32)
 *  [N bytes] content_type (UTF-8)
 *  [4 bytes] filename length (LE uint32)
 *  [N bytes] filename (UTF-8)
 *  [1 byte]  index present flag (0x00 = null, 0x01 = present)
 *  [4 bytes] index value (LE uint32, only if flag = 0x01)
 *  [4 bytes] checksum (LE uint32)
 *  [4 bytes] backlinks count (LE uint32)
 *  For each backlink:
 *    [4 bytes]  tx_hash length (LE uint32)
 *    [N bytes]  tx_hash (UTF-8 hex string with 0x prefix)
 *    [4 bytes]  backlink index (LE uint32)
 *    [4 bytes]  backlink checksum (LE uint32)
 */

import { CKBFSCellData, BackLink } from './types';

// ─── Encode ──────────────────────────────────────────────────────────────────

/**
 * Encodes a CKBFSCellData object into raw bytes for storage in a CKB cell's data field.
 */
export function encodeCellData(data: CKBFSCellData): Uint8Array {
  const enc = new TextEncoder();
  const contentTypeBytes = enc.encode(data.content_type);
  const filenameBytes = enc.encode(data.filename);

  // Pre-compute size
  let size = 4 + contentTypeBytes.length   // content_type
           + 4 + filenameBytes.length       // filename
           + 1                              // index present flag
           + (data.index !== null ? 4 : 0) // index value
           + 4                             // checksum
           + 4;                            // backlinks count

  for (const bl of data.backlinks) {
    const txHashBytes = enc.encode(bl.tx_hash);
    size += 4 + txHashBytes.length + 4 + 4; // tx_hash + index + checksum
  }

  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  let offset = 0;

  // content_type
  view.setUint32(offset, contentTypeBytes.length, true); offset += 4;
  new Uint8Array(buf).set(contentTypeBytes, offset); offset += contentTypeBytes.length;

  // filename
  view.setUint32(offset, filenameBytes.length, true); offset += 4;
  new Uint8Array(buf).set(filenameBytes, offset); offset += filenameBytes.length;

  // index
  if (data.index === null) {
    view.setUint8(offset, 0x00); offset += 1;
  } else {
    view.setUint8(offset, 0x01); offset += 1;
    view.setUint32(offset, data.index, true); offset += 4;
  }

  // checksum
  view.setUint32(offset, data.checksum >>> 0, true); offset += 4;

  // backlinks count
  view.setUint32(offset, data.backlinks.length, true); offset += 4;

  // backlinks
  for (const bl of data.backlinks) {
    const txHashBytes = enc.encode(bl.tx_hash);
    view.setUint32(offset, txHashBytes.length, true); offset += 4;
    new Uint8Array(buf).set(txHashBytes, offset); offset += txHashBytes.length;
    view.setUint32(offset, bl.index, true); offset += 4;
    view.setUint32(offset, bl.checksum >>> 0, true); offset += 4;
  }

  return new Uint8Array(buf);
}

// ─── Decode ──────────────────────────────────────────────────────────────────

/**
 * Decodes raw bytes from a CKB cell's data field into a CKBFSCellData object.
 * @throws Error if the bytes are malformed or truncated
 */
export function decodeCellData(raw: Uint8Array): CKBFSCellData {
  const dec = new TextDecoder('utf-8');
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let offset = 0;

  function readUint32(): number {
    const val = view.getUint32(offset, true);
    offset += 4;
    return val;
  }

  function readBytes(len: number): Uint8Array {
    const slice = raw.slice(offset, offset + len);
    offset += len;
    return slice;
  }

  function readString(): string {
    const len = readUint32();
    return dec.decode(readBytes(len));
  }

  const content_type = readString();
  const filename = readString();

  const indexFlag = raw[offset]; offset += 1;
  const index = indexFlag === 0x01 ? readUint32() : null;

  const checksum = readUint32();
  const backlinkCount = readUint32();

  const backlinks: BackLink[] = [];
  for (let i = 0; i < backlinkCount; i++) {
    const tx_hash = readString();
    const blIndex = readUint32();
    const blChecksum = readUint32();
    backlinks.push({ tx_hash, index: blIndex, checksum: blChecksum });
  }

  return { content_type, filename, index, checksum, backlinks };
}

// ─── Hex Conversion ──────────────────────────────────────────────────────────

export function cellDataToHex(data: CKBFSCellData): string {
  const bytes = encodeCellData(data);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToCellData(hex: string): CKBFSCellData {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return decodeCellData(bytes);
}
