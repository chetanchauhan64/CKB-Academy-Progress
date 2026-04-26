'use client';
import { useState, useCallback } from 'react';
import type { OperationState } from '@/types';
import { useToast } from '@/utils/toast';
import { useWalletContext } from '@/context/WalletContext';

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res  = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

async function broadcast(signedTx: Record<string, unknown>): Promise<string> {
  const res  = await fetch('/api/tx/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedTx }) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Broadcast failed');
  return json.txHash as string;
}

export function useCkbfs(address: string | undefined) {
  const [state, setState] = useState<OperationState>({ status: 'idle' });
  const { toast }          = useToast();
  // Use the abstracted wallet context for signing — works for JoyID AND PrivateKey
  const { signTransaction } = useWalletContext();

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const run = useCallback(async (label: string, fn: () => Promise<string>) => {
    setState({ status: 'building' });
    const pendingId = toast({ type: 'pending', title: `${label}: building…`, duration: 0 });
    try {
      const txHash = await fn();
      setState({ status: 'success', txHash });
      toast({ type: 'success', title: `${label}: confirmed!`, txHash, duration: 8000 });
      return txHash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ status: 'error', error: msg });
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
      console.log('[CKBFS] createFile start — file:', file.name, 'size:', file.size, 'address:', address);
      onStatus?.('Building transaction…');
      setState(s => ({ ...s, status: 'building' }));
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

      const { rawTx, fileId } = await apiFetch<{ rawTx: Record<string, unknown>; fileId: string; chunkCount: number }>('/api/tx/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, fileContentBase64: b64 }),
      });
      console.log('[CKBFS] tx/create OK — fileId:', fileId);

      onStatus?.('Waiting for wallet signature…');
      setState(s => ({ ...s, status: 'signing' }));
      const signedTx = await signTransaction(rawTx);
      console.log('[CKBFS] signed OK');

      onStatus?.('Broadcasting to CKB network…');
      setState(s => ({ ...s, status: 'broadcasting' }));
      const txHash = await broadcast(signedTx);
      console.log('[CKBFS] tx sent:', txHash, '— fileId:', fileId);
      return txHash;
    });
  }, [address, run, signTransaction]);

  // ── UPDATE ───────────────────────────────────────────────────────────────────
  const updateFile = useCallback(async (fileId: string, file: File, onStatus?: (s: string) => void) => {
    if (!address) throw new Error('Wallet not connected');
    return run('Update', async () => {
      console.log('[CKBFS] updateFile start — fileId:', fileId, 'file:', file.name);
      onStatus?.('Building update transaction…');
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const { rawTx } = await apiFetch<{ rawTx: Record<string, unknown> }>('/api/tx/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, fileId, fileContentBase64: b64 }),
      });
      console.log('[CKBFS] tx/update raw OK');
      onStatus?.('Waiting for wallet signature…');
      setState(s => ({ ...s, status: 'signing' }));
      const signedTx = await signTransaction(rawTx);
      onStatus?.('Broadcasting to CKB network…');
      setState(s => ({ ...s, status: 'broadcasting' }));
      const txHash = await broadcast(signedTx);
      console.log('[CKBFS] UPDATE tx:', txHash);
      return txHash;
    });
  }, [address, run, signTransaction]);

  // ── CONSUME ──────────────────────────────────────────────────────────────────
  const consumeFile = useCallback(async (fileId: string, onStatus?: (s: string) => void) => {
    if (!address) throw new Error('Wallet not connected');
    return run('Consume', async () => {
      console.log('[CKBFS] consumeFile start — fileId:', fileId);
      onStatus?.('Building consume transaction…');
      const { rawTx } = await apiFetch<{ rawTx: Record<string, unknown> }>('/api/tx/consume', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, fileId }),
      });
      console.log('[CKBFS] tx/consume raw OK');
      onStatus?.('Waiting for wallet signature…');
      setState(s => ({ ...s, status: 'signing' }));
      const signedTx = await signTransaction(rawTx);
      onStatus?.('Broadcasting to CKB network…');
      setState(s => ({ ...s, status: 'broadcasting' }));
      const txHash = await broadcast(signedTx);
      console.log('[CKBFS] CONSUME tx:', txHash);
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

  return { state, reset, createFile, updateFile, consumeFile, readFile, listFiles };
}
