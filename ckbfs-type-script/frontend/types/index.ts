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
  fileId: string;
  chunkCount: number;
  totalSize: number;
  isComplete: boolean;
  outPoints: OutPoint[];
}
