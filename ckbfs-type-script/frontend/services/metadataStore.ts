/**
 * services/metadataStore.ts
 *
 * Week 20 — Client-side file metadata store.
 *
 * Stores per-file metadata in localStorage so it survives page refreshes:
 *   - fileName, mimeType, scriptVersion
 *   - txHash of the CREATE transaction
 *   - chunkOutpoints known at upload time (used for RPC-first reads)
 *   - uploadedAt timestamp
 *
 * This enables:
 *   1. Multi-file display with human-readable names (not just truncated fileId)
 *   2. Metadata-based indexing: fileId → chunkOutpoints → RPC get_live_cell
 *      (no indexer scan needed for files we uploaded ourselves)
 *   3. Script version tracking for backward-compatible upgrades
 *
 * Design: indexer is for DISCOVERY of files uploaded on other devices.
 *         For files we uploaded, this store is the source of truth.
 */

import type { FileMetadata, OutPoint } from '@/types';

const STORAGE_KEY = 'ckbfs_file_metadata_v1';

// ─── Internal persistence ──────────────────────────────────────────────────────

function readStore(): Record<string, FileMetadata> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, FileMetadata>) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, FileMetadata>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[metadataStore] Failed to write localStorage:', e);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save metadata for a newly uploaded file.
 * Called immediately after a successful broadcast so the data is durable.
 */
export function saveFileMetadata(meta: FileMetadata): void {
  const store = readStore();
  store[meta.fileId] = meta;
  writeStore(store);
  console.log('[metadataStore] Saved metadata for fileId:', meta.fileId);
}

/** Retrieve metadata for a specific fileId. Returns undefined if not found. */
export function getFileMetadata(fileId: string): FileMetadata | undefined {
  return readStore()[fileId];
}

/** All stored file metadata entries, newest-first. */
export function getAllFileMetadata(): FileMetadata[] {
  const store = readStore();
  return Object.values(store).sort((a, b) => b.uploadedAt - a.uploadedAt);
}

/** Remove metadata when a file is consumed (cells deleted). */
export function removeFileMetadata(fileId: string): void {
  const store = readStore();
  delete store[fileId];
  writeStore(store);
  console.log('[metadataStore] Removed metadata for fileId:', fileId);
}

/**
 * Enrich an array of FileEntry objects from the indexer with locally stored
 * metadata (fileName, mimeType, scriptVersion, txHash, uploadedAt).
 *
 * Files we've uploaded ourselves will be fully enriched.
 * Files discovered via indexer scan on a different device stay as-is.
 */
export function enrichFileEntries<T extends { fileId: string }>(
  entries: T[],
): (T & Partial<FileMetadata>)[] {
  const store = readStore();
  return entries.map(e => {
    const meta = store[e.fileId];
    if (!meta) return e;
    return {
      ...e,
      fileName      : meta.fileName,
      mimeType      : meta.mimeType,
      scriptVersion : meta.scriptVersion,
      txHash        : meta.txHash,
      uploadedAt    : meta.uploadedAt,
    };
  });
}

/**
 * Week 20 — Metadata-based indexing.
 *
 * Returns the chunk outpoints for a fileId if we have them locally.
 * These can be fed directly into RPC get_live_cell without touching the indexer.
 *
 * Returns null if the file was not uploaded from this device.
 */
export function getChunkOutpoints(fileId: string): OutPoint[] | null {
  const meta = readStore()[fileId];
  return meta?.chunkOutpoints ?? null;
}
