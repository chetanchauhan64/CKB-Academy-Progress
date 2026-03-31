/**
 * CKBFS Operations — Public API
 *
 * Unified entry point for all CKBFS protocol modules.
 * All operations build real CCC transactions — no simulation.
 *
 * All operations strictly follow CKBFS immutability rules:
 *  - content_type and filename are immutable after publish
 *  - backlinks are append-only
 *  - checksums are chained Adler32
 */

// Transaction builders
export { publishPost } from './publish';
export { appendPost } from './append';
export { transferPost } from './transfer';
export { forkPost } from './fork';

// Media upload + resolver
export { uploadImage, storeImageOnCKB, linkImageToPost, isCKBFSMedia, resolveCKBFSMedia } from './media';

// Indexer
export { fetchAllPosts, fetchUserPosts, fetchCellByTxHash, parseCKBFSCell } from './indexer';

// Witness encoding
export {
  encodeWitness,
  decodeWitness,
  validateWitnessFormat,
  bytesToHex,
  hexToBytes,
  stringToBytes,
  bytesToString,
} from './witness';

// Checksum utilities
export {
  computeChecksum,
  updateChecksum,
  computePublishChecksum,
  computeAppendChecksum,
  recoverChecksumFromBacklinks,
  validateChecksum,
} from './checksum';

// Cell molecule codec
export { encodeCellData, decodeCellData, cellDataToHex, hexToCellData } from './cell-codec';

// Types
export type { CKBFSCellData, BackLink, TxResult, CKBFSWitness } from './types';
export { CKBFS_MAGIC, CKBFS_VERSION, CKBFS_HEADER_LENGTH, CKBFS_CONTENT_TYPE, CKBFS_FILENAME } from './types';

// Metadata schema
export { blogPostSchema, validateBlogPostContent } from './metadata';
export type { ValidatedBlogPost } from './metadata';

// RPC Client
export { client } from './client';
