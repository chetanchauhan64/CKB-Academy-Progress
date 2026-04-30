// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface JoyIdAccount {
  address: string;
  pubkey: string;
  keyType: string;
}

export interface LockScript {
  codeHash: string;
  hashType: string;
  args: string;
}

// ─── CKB / Lumos primitives ───────────────────────────────────────────────────

export interface OutPoint {
  txHash: string;
  index: string;
}

export interface CellOutput {
  capacity: string;
  lock: LockScript;
  type?: LockScript | null;
}

export interface LiveCell {
  outPoint: OutPoint;
  cellOutput: CellOutput;
  data: string; // hex
}

// ─── CKBFS domain ─────────────────────────────────────────────────────────────

export interface CkbfsChunk {
  outPoint: OutPoint;
  cellOutput: CellOutput;
  data: string;
  chunkIndex: number;
  totalChunks: number;
  contentLength: number;
  isFinalized: boolean;
}

export interface CkbfsFile {
  fileId: string;
  chunks: CkbfsChunk[];
  totalSize: number;
  isComplete: boolean;
}

export interface DecodedCellData {
  version: number;
  flags: number;
  chunkIndex: number;
  totalChunks: number;
  content: Uint8Array;
  isFinalized: boolean;
}

export interface TypeArgs {
  fileId: string;
  ownerLockHash: string;
}

// ─── API payloads ─────────────────────────────────────────────────────────────

export interface BuildTxRequest {
  address: string;
  fileContentBase64: string;
  filename?: string;
  mimeType?: string;
  chunkSize?: number;
}

export interface BuildUpdateTxRequest {
  address: string;
  fileId: string;
  fileContentBase64: string;
}

export interface BuildConsumeTxRequest {
  address: string;
  fileId: string;
}

export interface BuildTxResponse {
  rawTx: Record<string, unknown>;
  fileId: string;
  chunkCount: number;
  capacityNeeded: string;
  /** Week 20: human-readable name of the uploaded file */
  fileName?: string;
  /** Week 20: MIME type detected client-side */
  mimeType?: string;
  /** Week 20: script version tag stored in cell metadata */
  scriptVersion?: string;
}

export interface BroadcastRequest {
  signedTx: Record<string, unknown>;
}

export interface BroadcastResponse {
  txHash: string;
}

// ─── UI state ─────────────────────────────────────────────────────────────────

export type OperationStatus = 'idle' | 'building' | 'signing' | 'broadcasting' | 'success' | 'error';

export interface OperationState {
  status: OperationStatus;
  txHash?: string;
  error?: string;
}

export interface FileEntry {
  fileId        : string;
  chunks        : number;
  totalSize     : number;
  totalCapacity : string;
  outPoints     : OutPoint[];
  // Week 20 metadata (populated from client-side store, may be absent for old files)
  fileName      ?: string;
  mimeType      ?: string;
  scriptVersion ?: string;
  txHash        ?: string;
  uploadedAt    ?: number; // unix ms
}

/** Week 20 — Client-side file metadata persisted in localStorage */
export interface FileMetadata {
  fileId        : string;
  fileName      : string;
  mimeType      : string;
  scriptVersion : string;   // e.g. 'v1'
  txHash        : string;
  chunkOutpoints: OutPoint[]; // known at upload time — used for RPC-first reads
  uploadedAt    : number;     // Date.now() at upload
}
