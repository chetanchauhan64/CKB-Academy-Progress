/**
 * CKBFS Type Definitions
 * Strictly follows the CKBFS protocol specification.
 */

// ─── BackLink ────────────────────────────────────────────────────────────────
// References a previous CKBFS transaction's witness content.
// Once added to a cell's backlinks array, a BackLink is IMMUTABLE.
export interface BackLink {
  tx_hash: string;   // 0x-prefixed hex, 32 bytes
  index: number;     // Uint32 — witness index in that transaction
  checksum: number;  // Uint32 (Adler32) of the content at that witness
}

// ─── CKBFS Cell Data ─────────────────────────────────────────────────────────
// The structured data stored in the cell's `data` field.
export interface CKBFSCellData {
  content_type: string;       // MIME type, e.g. "application/json" — IMMUTABLE after publish
  filename: string;           // Human-readable filename — IMMUTABLE after publish
  index: number | null;       // Uint32Opt — witness index in curr tx; null on TRANSFER
  checksum: number;           // Uint32 Adler32 — updated on APPEND
  backlinks: BackLink[];      // Append-only; NEVER modify/delete existing entries
}

// ─── CKBFS Witness ───────────────────────────────────────────────────────────
// Decoded representation of a raw CKBFS witness.
export interface CKBFSWitness {
  magic: string;          // "CKBFS"
  version: number;        // 0x00
  content: Uint8Array;    // raw content bytes (after 6-byte header)
}

// ─── Blog Post Metadata ──────────────────────────────────────────────────────
// JSON payload stored as the witness content for blog posts.
// Canonical field order must match publish.ts, append.ts, and metadata.ts:
//   title → description → author → tags → created_at → updated_at
//   → is_paid → unlock_price → content
export interface BlogPostContent {
  title:        string;
  description:  string;        // Always present (default: '')
  author:       string;        // CKB address
  tags:         string[];
  created_at:   number;        // Unix timestamp (ms)
  updated_at:   number;        // Unix timestamp (ms)
  is_paid:      boolean;       // Monetization flag
  unlock_price: number;        // CKB amount (0 = free)
  content:      string;        // Markdown body
}

// ─── Resolved Post ───────────────────────────────────────────────────────────
// Full post with all resolved data for display.
export interface ResolvedPost {
  txHash: string;
  outputIndex: number;
  cellData: CKBFSCellData;
  content: BlogPostContent;
  blockNumber?: string;
  timestamp?: number;
  versionHistory: VersionEntry[];
}

export interface VersionEntry {
  txHash: string;
  witnessIndex: number;
  checksum: number;
  content: BlogPostContent;
  timestamp?: number;
}

// ─── Transaction Result ──────────────────────────────────────────────────────
export interface TxResult {
  txHash: string;
  operation: 'publish' | 'append' | 'transfer' | 'fork';
  timestamp: number;
}

// ─── CKBFS Protocol Constants ────────────────────────────────────────────────
export const CKBFS_MAGIC = new Uint8Array([0x43, 0x4b, 0x42, 0x46, 0x53]); // "CKBFS"
export const CKBFS_VERSION = 0x00;
export const CKBFS_HEADER_LENGTH = 6; // 5 magic + 1 version
export const CKBFS_CONTENT_TYPE = 'application/json';
export const CKBFS_FILENAME = 'post.json';

// ─── Simulation Mode Cell Store ──────────────────────────────────────────────
// Used in simulation/demo mode (no real CKB node required).
export interface SimulatedCell {
  txHash: string;
  outputIndex: number;
  lockScriptHash: string;  // owner
  cellData: CKBFSCellData;
  witnesses: string[];     // hex-encoded witness bytes per tx
  blockTime: number;
}
