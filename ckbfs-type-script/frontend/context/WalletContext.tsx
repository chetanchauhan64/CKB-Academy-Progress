'use client';
/**
 * context/WalletContext.tsx
 * Central wallet state — supports JoyID, UniPass, and PrivateKey (dev).
 * connect() ALWAYS re-throws so callers (WalletModal) can show per-option errors.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { WalletAdapter, WalletType } from '@/wallets/WalletAdapter';

interface WalletState {
  walletType:  WalletType | null;
  address:     string | null;
  connecting:  boolean;
  error:       string | null;
}

interface WalletCtx extends WalletState {
  adapter:         WalletAdapter | null;
  connect:         (type: WalletType) => Promise<void>;
  disconnect:      () => void;
  signTransaction: (tx: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const Ctx = createContext<WalletCtx>({
  walletType: null, address: null, connecting: false, error: null,
  adapter: null,
  connect: async () => {},
  disconnect: () => {},
  signTransaction: async () => ({}),
});

const STORAGE_KEY = 'ckbfs_wallet_type';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [adapter, setAdapter] = useState<WalletAdapter | null>(null);
  const [state,   setState]   = useState<WalletState>({
    walletType: null, address: null, connecting: false, error: null,
  });

  // ── Build the right adapter for each wallet type ────────────────────────────
  const buildAdapter = useCallback(async (type: WalletType): Promise<WalletAdapter> => {
    console.log('[WalletContext] buildAdapter:', type);
    if (type === 'joyid') {
      const { JoyIDAdapter }     = await import('@/wallets/JoyIDAdapter');
      return new JoyIDAdapter();
    }
    if (type === 'unipass') {
      const { UniPassAdapter }   = await import('@/wallets/UniPassAdapter');
      return new UniPassAdapter();
    }
    const { PrivateKeyAdapter }  = await import('@/wallets/PrivateKeyAdapter');
    return new PrivateKeyAdapter();
  }, []);

  // ── Silent reconnect on page load (session persistence) ─────────────────────
  const reconnect = useCallback(async (type: WalletType) => {
    console.log('[WalletContext] Attempting session restore for:', type);
    try {
      const adp     = await buildAdapter(type);
      const address = await adp.connect();
      if (!address) throw new Error('No address returned');
      setAdapter(adp);
      setState({ walletType: type, address, connecting: false, error: null });
      console.log('[WalletContext] Session restored:', address);
    } catch (e) {
      console.warn('[WalletContext] Session restore failed:', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [buildAdapter]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as WalletType | null;
    if (saved) reconnect(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── User-initiated connect — MUST rethrow so modal can catch ────────────────
  const connect = useCallback(async (type: WalletType) => {
    console.log('[WalletContext] connect() called with:', type);
    setState(s => ({ ...s, connecting: true, error: null }));
    try {
      const adp     = await buildAdapter(type);
      const address = await adp.connect();

      if (!address) throw new Error(`${type} returned an empty address`);

      console.log('[WalletContext] Connected:', type, address);
      setAdapter(adp);
      setState({ walletType: type, address, connecting: false, error: null });
      localStorage.setItem(STORAGE_KEY, type);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[WalletContext] connect() failed:', type, msg);
      setState(s => ({ ...s, connecting: false, error: msg }));
      throw e;   // ← CRITICAL: rethrow so WalletModal can show per-option error
    }
  }, [buildAdapter]);

  // ── Disconnect ───────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    console.log('[WalletContext] disconnecting');
    adapter?.disconnect();
    setAdapter(null);
    setState({ walletType: null, address: null, connecting: false, error: null });
    localStorage.removeItem(STORAGE_KEY);
  }, [adapter]);

  // ── Sign ─────────────────────────────────────────────────────────────────────
  const signTransaction = useCallback(async (tx: Record<string, unknown>) => {
    if (!adapter) throw new Error('No wallet connected — please connect first');
    console.log('[WalletContext] signTransaction via adapter:', adapter.name);
    return adapter.signTransaction(tx);
  }, [adapter]);

  return (
    <Ctx.Provider value={{ ...state, adapter, connect, disconnect, signTransaction }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWalletContext() { return useContext(Ctx); }
