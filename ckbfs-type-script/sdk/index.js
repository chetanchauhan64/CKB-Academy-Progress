/**
 * index.js — CKBFS SDK Public API (Phase 2)
 *
 * Single entry point for the CKBFS production SDK.
 *
 * Usage:
 *   import { createFileCells, updateFileCells, consumeFileCells } from './sdk/index.js';
 *   import { Wallet } from './sdk/wallet/Wallet.js';
 */

// ── Network config ─────────────────────────────────────────────────────────────
export {
  CKB_RPC_URL,
  CKB_INDEXER_URL,
  CKBFS_CODE_HASH,
  CKBFS_CELL_DEP,
  CKBFS_BINARY_OUT_POINT,
  MIN_CELL_CAPACITY,
  DEFAULT_TX_FEE,
  TX_FEE_RATE,
  initLumosConfig,
} from './config.js';

// ── Transaction orchestrators ──────────────────────────────────────────────────
export { createFileCells } from './tx/createFile.js';
export { updateFileCells } from './tx/updateFile.js';
export { consumeFileCells } from './tx/consumeFile.js';

// ── Wallet ─────────────────────────────────────────────────────────────────────
export { Wallet } from './wallet/Wallet.js';

// ── Builder layer ──────────────────────────────────────────────────────────────
export { buildCreateTx, buildUpdateTx, buildConsumeTx } from './builder/TxBuilder.js';
export {
  selectInputCells,
  findCkbfsCells,
  findCkbfsCellsByFileId,
  getBalance,
  getIndexer,
} from './builder/InputSelector.js';
export {
  estimateTxSize,
  computeFee,
  computeCkbfsCellMinCapacity,
  computeChangeCellMinCapacity,
  DEFAULT_FEE_RATE,
  MIN_CHANGE_CAPACITY,
} from './builder/FeeCalculator.js';
export {
  computeChange,
  sumOutputCapacity,
  sumInputCapacity,
} from './builder/ChangeOutput.js';

// ── Executor layer ─────────────────────────────────────────────────────────────
export { signTransaction } from './executor/Signer.js';
export { sendTransaction, getRpc } from './executor/Sender.js';
export { waitForCommit } from './executor/Confirmer.js';
export { assertSynced, getSyncStatus } from './executor/IndexerSync.js';

// ── Encoding / decoding utilities ─────────────────────────────────────────────
export {
  encodeCellData,
  decodeCellData,
  verifyHash,
  encodeTypeArgs,
  decodeTypeArgs,
  chunkFile,
  sha256,
  hexToBytes,
  bytesToHex,
  generateFileId,
  CURRENT_VERSION,
  FLAG_IMMUTABLE,
  FLAG_FINALIZED,
  MIN_DATA_SIZE,
  OFFSET_CONTENT,
} from './utils/encoding.js';

// ── Typed errors ───────────────────────────────────────────────────────────────
export {
  CkbfsError,
  InsufficientCapacityError,
  InvalidCellError,
  HashMismatchError,
  ImmutableCellError,
  NetworkError,
  IndexerNotSyncedError,
  TransactionRejectedError,
  ConfirmationTimeoutError,
  FileNotFoundError,
} from './utils/errors.js';
