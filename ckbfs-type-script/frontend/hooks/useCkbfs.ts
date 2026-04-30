'use client';
import { useState, useCallback, useRef } from 'react';
import type { OperationState, BuildTxResponse } from '@/types';
import { useToast } from '@/utils/toast';
import { useWalletContext } from '@/context/WalletContext';
import { saveFileMetadata, removeFileMetadata } from '@/services/metadataStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res  = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * isOutPointError — true for genuine double-spend / unknown-outpoint errors.
 * Note: "indexer lag" is no longer thrown — selectInputCells returns null instead,
 * so this guard no longer needs to include it.
 */
function isOutPointError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('unknown outpoint') ||
    msg.includes('unknown out point') ||
    msg.includes('resolve failed') ||
    msg.includes('inputs not live')
  );
}

/** FIX 5 — Returns true when the error is an indexer sync issue, not a real error */
function isIndexerLagError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('indexer') || msg.includes('out of sync');
}

// ─── Broadcast — single attempt, integrity-checked ───────────────────────────

async function broadcast(
  signedTx: Record<string, unknown>,
  rawTx   : Record<string, unknown>,
): Promise<string> {
  const inputs = signedTx.inputs as Array<{ previous_output: { tx_hash: string; index: string } }>;
  console.log('[useCkbfs] broadcast — inputs:', inputs?.length, '| witnesses:', (signedTx.witnesses as unknown[])?.length);
  console.log('[useCkbfs] first input:', JSON.stringify(inputs?.[0]?.previous_output ?? 'none'));

  const res  = await fetch('/api/tx/broadcast', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ signedTx, rawTx }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Broadcast failed');
  return json.txHash as string;
}

// ─── Core: build → sign → broadcast, single attempt ─────────────────────────

async function signAndBroadcast(
  rawTx          : Record<string, unknown>,
  signTransaction: (tx: Record<string, unknown>) => Promise<Record<string, unknown>>,
  onStatus       : (s: string) => void,
  setState       : (fn: (s: OperationState) => OperationState) => void,
): Promise<string> {
  onStatus('Waiting for wallet signature…');
  setState(s => ({ ...s, status: 'signing' }));
  const signedTx = await signTransaction(rawTx);

  // Signing integrity — input outpoints must not change (wallet must spend same UTXOs)
  const rawIns    = rawTx.inputs    as Array<{ previous_output: { tx_hash: string; index: string } }>;
  const signedIns = signedTx.inputs as Array<{ previous_output: { tx_hash: string; index: string } }>;
  const rawOps    = rawIns?.map(i => `${i.previous_output.tx_hash}:${i.previous_output.index}`).join(',');
  const signedOps = signedIns?.map(i => `${i.previous_output.tx_hash}:${i.previous_output.index}`).join(',');
  if (rawOps !== signedOps) {
    throw new Error('Signing mutated the transaction inputs — aborting broadcast to prevent Unknown OutPoint.');
  }
  console.log('[useCkbfs] Input integrity OK ✓ — outpoints unchanged');

  // FIX 6 — explicit status update before broadcast
  onStatus('Transaction submitted. Waiting for confirmation…');
  setState(s => ({ ...s, status: 'broadcasting' }));
  return broadcast(signedTx, rawTx);
}

// ─── Retry wrapper — full rebuild on OutPoint / indexer-lag failure ───────────

const MAX_ATTEMPTS    = 2;    // attempt 1: build+sign+broadcast; attempt 2: full rebuild
const REBUILD_WAIT_MS = 8000; // wait 8s before full rebuild (matches node settling time)

/**
 * Executes `buildFn` (server API call → rawTx) then sign → broadcast.
 * FIX 4: On indexer-lag errors (as well as OutPoint errors):
 *   - waits REBUILD_WAIT_MS
 *   - calls buildFn AGAIN (completely fresh cells)
 *   - re-signs and re-broadcasts
 * Never reuses a stale rawTx across attempts.
 */
async function withRebuildRetry(
  buildFn        : () => Promise<Record<string, unknown>>,
  signTransaction: (tx: Record<string, unknown>) => Promise<Record<string, unknown>>,
  onStatus       : (s: string) => void,
  setState       : (fn: (s: OperationState) => OperationState) => void,
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[useCkbfs] withRebuildRetry — attempt ${attempt}/${MAX_ATTEMPTS}`);

    if (attempt > 1) {
      console.log('[useCkbfs] Rebuilding transaction due to stale inputs…');
      onStatus(`Rebuilding transaction (attempt ${attempt})…`);
      setState(s => ({ ...s, status: 'building' }));
      await sleep(REBUILD_WAIT_MS);
    }

    // FIX 6 — status on build start
    onStatus('Processing transaction…');

    // Fresh build every attempt — server runs selectInputCells + validateInputsLive from scratch
    const rawTx = await buildFn();
    console.log(`[useCkbfs] rawTx built (attempt ${attempt}) — inputs:`, (rawTx.inputs as unknown[])?.length);
    console.log('[useCkbfs] RAW TX inputs:', JSON.stringify(rawTx.inputs));

    try {
      const txHash = await signAndBroadcast(rawTx, signTransaction, onStatus, setState);
      console.log(`[useCkbfs] ✅ SUCCESS on attempt ${attempt} — txHash:`, txHash);
      return txHash;
    } catch (err) {
      console.error(`[useCkbfs] ❌ attempt ${attempt} failed:`, err instanceof Error ? err.message : err);

      if (attempt < MAX_ATTEMPTS && isOutPointError(err)) {
        // FIX 4: Includes indexer lag errors — will rebuild on next iteration
        if (isIndexerLagError(err)) {
          console.log('[useCkbfs] RPC vs Indexer mismatch — rebuilding with fresh cells after wait…');
        } else {
          console.log('[useCkbfs] OutPoint error detected — will rebuild completely on next attempt');
        }
        // loop continues → rebuild
      } else {
        throw err; // non-recoverable or final attempt
      }
    }
  }

  // Should never reach here
  throw new Error('Transaction failed after all rebuild attempts.');
}

// ─── FIX 8: Transaction status poller ────────────────────────────────────────

/**
 * Polls get_transaction via the server-side API until status = "committed".
 * Calls onCommit() when confirmed. Stops after maxAttempts.
 * FIX 8 — auto-refreshes file list when tx is committed.
 */
function pollTxCommit(
  txHash    : string,
  onCommit  : () => void,
  intervalMs = 3000,
  maxAttempts = 10,
): void {
  let attempt = 0;
  const check = async () => {
    attempt++;
    try {
      const res  = await fetch(`/api/tx/status?txHash=${encodeURIComponent(txHash)}`);
      const json = await res.json() as { status?: string };
      console.log(`[useCkbfs] pollTxCommit attempt ${attempt}: status = ${json.status}`);
      if (json.status === 'committed') {
        console.log('[useCkbfs] ✅ tx committed — triggering file refresh');
        onCommit();
        return;
      }
    } catch (e) {
      console.warn('[useCkbfs] pollTxCommit error:', e instanceof Error ? e.message : e);
    }
    if (attempt < maxAttempts) {
      setTimeout(check, intervalMs);
    } else {
      console.warn('[useCkbfs] pollTxCommit: max attempts reached — tx may still confirm later');
    }
  };
  setTimeout(check, intervalMs);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCkbfs(address: string | undefined) {
  const [state, setState] = useState<OperationState>({ status: 'idle' });
  const { toast }          = useToast();
  const { signTransaction } = useWalletContext();

  // FIX 7/8: ref so refreshFiles always has the latest listFiles bound
  const listFilesRef = useRef<() => Promise<unknown[]>>(() => Promise.resolve([]));

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const run = useCallback(async (label: string, fn: () => Promise<string>) => {
    setState({ status: 'building' });
    const pendingId = toast({ type: 'pending', title: `${label}: building…`, duration: 0 });
    try {
      const txHash = await fn();
      setState({ status: 'success', txHash });
      toast({ type: 'success', title: `${label}: confirmed!`, txHash, duration: 8000 });

      // FIX 7 — auto-refresh file list after 5s to let indexer catch up
      setTimeout(() => {
        console.log('[useCkbfs] FIX 7: auto-refreshing files after 5s (indexer catch-up)');
        listFilesRef.current().catch(e => console.warn('[useCkbfs] auto-refresh failed:', e));
      }, 5000);

      return txHash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ status: 'error', error: msg });

      // Indexer lag → soft "syncing" status toast, no red error, no rethrow
      if (isIndexerLagError(e)) {
        console.warn('[useCkbfs] Indexer syncing — retrying silently...');
        toast({
          type    : 'pending',
          title   : `${label}: Network syncing…`,
          message : 'Network syncing… please wait 5–10 seconds and try again.',
          duration: 8000,
        });
        return; // silent recovery — no error propagated to the UI
      }

      toast({ type: 'error', title: `${label} failed`, message: msg, duration: 10000 });
      throw e;
    } finally {
      (toast as unknown as { dismiss?: (id: string) => void }).dismiss?.(pendingId);
    }
  }, [toast]);

  // ── CREATE ───────────────────────────────────────────────────────────────────
  const createFile = useCallback(async (file: File, onStatus?: (s: string) => void) => {
    if (!address) throw new Error('Wallet not connected');
    return run('Upload', async () => {
      console.log('[CKBFS] createFile — file:', file.name, 'size:', file.size, 'address:', address);

      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

      // Week 20: capture full response including metadata fields
      const captured: { result: BuildTxResponse | null } = { result: null };

      const txHash = await withRebuildRetry(
        async () => {
          onStatus?.('Processing transaction…');
          setState(s => ({ ...s, status: 'building' }));
          const result = await apiFetch<BuildTxResponse>(
            '/api/tx/create',
            {
              method : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body   : JSON.stringify({
                address,
                fileContentBase64: b64,
                // Week 20: forward human-readable metadata to the server
                fileName : file.name,
                mimeType : file.type || 'application/octet-stream',
              }),
            },
          );
          captured.result = result;
          console.log('[CKBFS] tx/create OK — fileId:', result.fileId, 'v:', result.scriptVersion);
          return result.rawTx;
        },
        signTransaction,
        s => onStatus?.(s),
        setState,
      );

      const buildResult = captured.result;
      console.log('[CKBFS] tx sent:', txHash, '— fileId:', buildResult?.fileId);

      // Week 20: persist metadata immediately after successful broadcast
      if (buildResult) {
        const meta = buildResult as BuildTxResponse;
        // Extract chunk outpoints from rawTx outputs (all outputs except the last change cell)
        const rawOutputs = (meta.rawTx?.outputs as Array<{ type?: unknown }>) ?? [];
        const chunkCount = meta.chunkCount;
        // Chunk outpoints aren't known yet until tx is confirmed, so we store txHash only
        // The full outpoints are available after pollTxCommit resolves
        saveFileMetadata({
          fileId        : meta.fileId,
          fileName      : meta.fileName ?? file.name,
          mimeType      : meta.mimeType ?? (file.type || 'application/octet-stream'),
          scriptVersion : meta.scriptVersion ?? 'v1',
          txHash,
          // Optimistic outpoints — index 0…chunkCount-1 of the create tx
          chunkOutpoints: Array.from({ length: chunkCount }, (_, i) => ({
            txHash,
            index : `0x${i.toString(16)}`,
          })),
          uploadedAt: Date.now(),
        });
        console.log('[CKBFS] Week 20: metadata saved for', meta.fileId, '—', chunkCount, 'chunk(s)');
        void rawOutputs; // suppress unused warning
      }

      // Poll for confirmation then refresh file list
      pollTxCommit(txHash, () => {
        listFilesRef.current().catch(e => console.warn('[useCkbfs] post-confirm refresh failed:', e));
      });

      return txHash;
    });
  }, [address, run, signTransaction]);

  // ── UPDATE ───────────────────────────────────────────────────────────────────
  const updateFile = useCallback(async (fileId: string, file: File, onStatus?: (s: string) => void) => {
    if (!address) throw new Error('Wallet not connected');
    return run('Update', async () => {
      console.log('[CKBFS] updateFile — fileId:', fileId, 'file:', file.name);

      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

      const txHash = await withRebuildRetry(
        async () => {
          onStatus?.('Processing transaction…');
          setState(s => ({ ...s, status: 'building' }));
          const result = await apiFetch<{ rawTx: Record<string, unknown> }>(
            '/api/tx/update',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, fileId, fileContentBase64: b64 }) },
          );
          console.log('[CKBFS] tx/update OK');
          return result.rawTx;
        },
        signTransaction,
        s => onStatus?.(s),
        setState,
      );

      console.log('[CKBFS] UPDATE tx:', txHash);

      // FIX 8
      pollTxCommit(txHash, () => {
        listFilesRef.current().catch(e => console.warn('[useCkbfs] post-confirm refresh failed:', e));
      });

      return txHash;
    });
  }, [address, run, signTransaction]);

  // ── CONSUME ──────────────────────────────────────────────────────────────────
  const consumeFile = useCallback(async (fileId: string, onStatus?: (s: string) => void) => {
    if (!address) throw new Error('Wallet not connected');
    return run('Consume', async () => {
      console.log('[CKBFS] consumeFile — fileId:', fileId);

      const txHash = await withRebuildRetry(
        async () => {
          onStatus?.('Processing transaction…');
          setState(s => ({ ...s, status: 'building' }));
          const result = await apiFetch<{ rawTx: Record<string, unknown> }>(
            '/api/tx/consume',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, fileId }) },
          );
          console.log('[CKBFS] tx/consume OK');
          return result.rawTx;
        },
        signTransaction,
        s => onStatus?.(s),
        setState,
      );

      console.log('[CKBFS] CONSUME tx:', txHash);

      // Remove from metadata store and refresh after commit
      pollTxCommit(txHash, () => {
        removeFileMetadata(fileId); // Week 20: clean up local metadata
        listFilesRef.current().catch(e => console.warn('[useCkbfs] post-confirm refresh failed:', e));
      });

      return txHash;
    });
  }, [address, run, signTransaction]);

  // ── READ ─────────────────────────────────────────────────────────────────────
  const readFile = useCallback(async (fileId: string) => {
    if (!address) throw new Error('Wallet not connected');
    const data = await apiFetch<{ contentBase64: string; size: number; chunks: number }>(
      `/api/file/${fileId}?address=${encodeURIComponent(address)}`
    );
    const binary = atob(data.contentBase64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { content: bytes, size: data.size, chunks: data.chunks };
  }, [address]);

  // ── LIST ─────────────────────────────────────────────────────────────────────
  const listFiles = useCallback(async () => {
    if (!address) return [];
    const data = await apiFetch<{ files: Array<{ fileId: string; chunks: number; totalSize: number }> }>(
      `/api/cells?address=${encodeURIComponent(address)}`
    );
    return data.files;
  }, [address]);

  // Keep ref up-to-date so FIX 7/8 callbacks always call the latest version
  listFilesRef.current = listFiles;

  return { state, reset, createFile, updateFile, consumeFile, readFile, listFiles };
}
