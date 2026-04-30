/**
 * wallets/PrivateKeyAdapter.ts — DEV MODE ONLY
 *
 * Uses PRIVATE_KEY from .env.local (server-side, never exposed to browser).
 * Signing is delegated to the /api/tx/sign-dev API route.
 *
 * E. Private key wallet fixes:
 *  - Validates PRIVATE_KEY exists via /api/wallet/dev-status before signing
 *  - sign-dev returns { ...tx, witnesses: newWitnesses } — never mutates inputs/outputs
 *  - signTransaction returns the full signed tx (witness-only delta)
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
    const res  = await fetch('/api/wallet/dev-address');
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
    // E: Validate address is set
    if (!this._address) throw new Error('PrivateKey: not connected — call connect() first');

    // E: Validate PRIVATE_KEY exists server-side before attempting sign
    const statusRes = await fetch('/api/wallet/dev-status');
    const statusJson = await statusRes.json().catch(() => ({ ready: false }));
    if (!statusJson.ready) {
      throw new Error('PRIVATE_KEY is not set in .env.local — cannot sign in dev mode');
    }

    console.log('[PrivateKeyAdapter] Signing TX via /api/tx/sign-dev');
    console.log('  inputs  :', (tx.inputs  as unknown[])?.length);
    console.log('  outputs :', (tx.outputs as unknown[])?.length);
    console.log('  witnesses before sign:', (tx.witnesses as unknown[])?.length);

    const res = await fetch('/api/tx/sign-dev', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ tx }),
    });

    const json = await res.json().catch(() => ({ error: 'Invalid sign response' }));
    if (!res.ok) {
      const msg: string = json.error ?? 'Dev signing failed';
      console.error('[PrivateKeyAdapter] sign failed:', msg);
      throw new Error(msg);
    }

    const signedTx = json.signedTx as Record<string, unknown>;
    if (!signedTx) throw new Error('sign-dev returned no signedTx');

    // E: Verify inputs were NOT mutated by sign-dev
    if (JSON.stringify(signedTx.inputs) !== JSON.stringify(tx.inputs)) {
      throw new Error('sign-dev mutated inputs — signing integrity violation');
    }
    if (JSON.stringify(signedTx.outputs) !== JSON.stringify(tx.outputs)) {
      throw new Error('sign-dev mutated outputs — signing integrity violation');
    }

    console.log('[PrivateKeyAdapter] Sign OK ✅');
    console.log('  witnesses after sign :', (signedTx.witnesses as unknown[])?.length);
    console.log('  inputs unchanged     :', JSON.stringify(signedTx.inputs) === JSON.stringify(tx.inputs));

    return signedTx;
  }
}
