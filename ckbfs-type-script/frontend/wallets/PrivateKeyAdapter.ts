/**
 * wallets/PrivateKeyAdapter.ts — DEV MODE ONLY
 *
 * Uses PRIVATE_KEY from .env.local (server-side, never exposed to browser).
 * Signing is delegated to the /api/tx/sign-dev API route.
 *
 * ⚠️  Never use in production. PRIVATE_KEY must NOT start with NEXT_PUBLIC_.
 */

import type { WalletAdapter } from './WalletAdapter';

export class PrivateKeyAdapter implements WalletAdapter {
  readonly name  = 'Private Key';
  readonly label = 'Dev Mode';
  readonly icon  = '🔑';

  private _address: string | null = null;

  getAddress() { return this._address; }

  async connect(): Promise<string> {
    console.log('[PrivateKeyAdapter] Fetching dev address from /api/wallet/dev-address…');
    const res = await fetch('/api/wallet/dev-address');
    const json = await res.json().catch(() => ({ error: 'Invalid server response' }));

    if (!res.ok) {
      const msg: string = json.error ?? 'Failed to derive dev wallet address';
      console.error('[PrivateKeyAdapter] connect() failed:', msg);
      throw new Error(msg);
    }

    const address: string = json.address;
    if (!address) throw new Error('Server returned empty address');

    console.log('[PrivateKeyAdapter] Connected with dev address:', address);
    this._address = address;
    return address;
  }

  disconnect(): void {
    console.log('[PrivateKeyAdapter] Disconnecting');
    this._address = null;
  }

  async signTransaction(tx: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this._address) throw new Error('PrivateKey: not connected — call connect() first');

    console.log('[PrivateKeyAdapter] Signing via /api/tx/sign-dev…');
    const res = await fetch('/api/tx/sign-dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx }),
    });

    const json = await res.json().catch(() => ({ error: 'Invalid sign response' }));
    if (!res.ok) {
      const msg: string = json.error ?? 'Dev signing failed';
      console.error('[PrivateKeyAdapter] sign failed:', msg);
      throw new Error(msg);
    }

    console.log('[PrivateKeyAdapter] Sign OK');
    return json.signedTx as Record<string, unknown>;
  }
}
