/**
 * utils/errors.js — CKBFS SDK Typed Error Hierarchy
 *
 * Every error thrown by the SDK is an instance of CkbfsError (or a subclass).
 * This lets callers do precise catch-and-handle without string matching:
 *
 *   try { ... }
 *   catch (err) {
 *     if (err instanceof InsufficientCapacityError) { ... }
 *     if (err instanceof TransactionRejectedError)  { ... }
 *   }
 */

// ── Base ──────────────────────────────────────────────────────────────────────

/**
 * Base class for all CKBFS SDK errors.
 * Always includes `cause` (original error if re-thrown) and a structured `context`.
 */
export class CkbfsError extends Error {
  /**
   * @param {string} message   - Human-readable description.
   * @param {object} [context] - Structured data relevant to the error.
   * @param {Error}  [cause]   - Original error that triggered this one.
   */
  constructor(message, context = {}, cause = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.cause = cause;
    // Capture proper stack in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ── Balance / Capacity ────────────────────────────────────────────────────────

/**
 * Thrown when the wallet does not have enough CKB to cover outputs + fee.
 *
 * Context keys:
 *   required  {bigint} — minimum shannons needed
 *   available {bigint} — total shannons in live cells
 *   shortfall {bigint} — required - available
 */
export class InsufficientCapacityError extends CkbfsError {
  constructor(required, available, cause) {
    const shortfall = required - available;
    const toKb = (n) => (Number(n) / 1e8).toFixed(4);
    super(
      `Insufficient CKB: need ${toKb(required)} CKB, have ${toKb(available)} CKB ` +
        `(short by ${toKb(shortfall)} CKB)`,
      { required, available, shortfall },
      cause
    );
  }
}

// ── Cell Validation ────────────────────────────────────────────────────────────

/**
 * Thrown when a cell's binary data cannot be parsed or violates the CKBFS spec.
 *
 * Context keys:
 *   outPoint {object} — { txHash, index } of the offending cell (if known)
 *   reason   {string} — short machine-readable code
 */
export class InvalidCellError extends CkbfsError {
  constructor(message, outPoint = null, cause = undefined) {
    super(message, { outPoint }, cause);
  }
}

/**
 * Thrown when SHA-256(content) ≠ stored hash field in a cell.
 *
 * Context keys:
 *   outPoint   {object} — cell out-point (if known)
 *   stored     {string} — 0x-prefixed stored hash
 *   computed   {string} — 0x-prefixed computed hash
 */
export class HashMismatchError extends CkbfsError {
  constructor(stored, computed, outPoint = null, cause = undefined) {
    super(
      `SHA-256 hash mismatch in cell ${JSON.stringify(outPoint)}: ` +
        `stored=${stored} computed=${computed}`,
      { outPoint, stored, computed },
      cause
    );
  }
}

/**
 * Thrown when an update is attempted on a cell that has FLAG_IMMUTABLE set.
 *
 * Context keys:
 *   chunkIndex {number} — the immutable chunk's index
 *   outPoint   {object} — cell out-point
 */
export class ImmutableCellError extends CkbfsError {
  constructor(chunkIndex, outPoint = null, cause = undefined) {
    super(
      `Cannot update chunk ${chunkIndex}: cell has FLAG_IMMUTABLE set`,
      { chunkIndex, outPoint },
      cause
    );
  }
}

// ── Network ────────────────────────────────────────────────────────────────────

/**
 * Thrown when an RPC or indexer network call fails (connection error, timeout, etc.).
 *
 * Context keys:
 *   url    {string} — endpoint that was called
 *   method {string} — RPC method name (if applicable)
 */
export class NetworkError extends CkbfsError {
  constructor(message, url, method = null, cause = undefined) {
    super(message, { url, method }, cause);
  }
}

/**
 * Thrown when the CKB indexer is lagging too far behind the chain tip.
 * Querying stale data may return incorrect cell sets.
 *
 * Context keys:
 *   chainTip   {bigint} — latest block number on chain
 *   indexerTip {bigint} — latest block number indexed
 *   lag        {bigint} — chainTip - indexerTip
 *   maxLag     {number} — configured maximum tolerated lag
 */
export class IndexerNotSyncedError extends CkbfsError {
  constructor(chainTip, indexerTip, maxLag, cause = undefined) {
    const lag = chainTip - indexerTip;
    super(
      `Indexer is ${lag} blocks behind chain tip (max tolerated: ${maxLag}). ` +
        `Wait for indexer to sync and retry.`,
      { chainTip, indexerTip, lag, maxLag },
      cause
    );
  }
}

// ── Transaction ────────────────────────────────────────────────────────────────

/**
 * Thrown when the CKB node rejects a submitted transaction.
 *
 * Context keys:
 *   txHash {string} — the rejected tx hash
 *   reason {string} — node rejection reason string
 */
export class TransactionRejectedError extends CkbfsError {
  constructor(txHash, reason, cause = undefined) {
    super(`Transaction ${txHash} was rejected: ${reason}`, { txHash, reason }, cause);
  }
}

/**
 * Thrown when a transaction is not confirmed within the timeout window.
 *
 * Context keys:
 *   txHash    {string} — the unconfirmed tx hash
 *   timeoutMs {number} — how long we waited (ms)
 *   lastStatus {string} — last observed tx status
 */
export class ConfirmationTimeoutError extends CkbfsError {
  constructor(txHash, timeoutMs, lastStatus, cause = undefined) {
    super(
      `Transaction ${txHash} not confirmed within ${timeoutMs / 1000}s ` +
        `(last status: ${lastStatus})`,
      { txHash, timeoutMs, lastStatus },
      cause
    );
  }
}

/**
 * Thrown when a file_id has no associated live cells on-chain.
 *
 * Context keys:
 *   fileId  {string}
 *   address {string}
 */
export class FileNotFoundError extends CkbfsError {
  constructor(fileId, address, cause = undefined) {
    super(
      `No live CKBFS cells found for fileId=${fileId} at address ${address}`,
      { fileId, address },
      cause
    );
  }
}
