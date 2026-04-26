/**
 * wallets/UniPassAdapter.ts — UniPass wallet (testnet demo mode)
 *
 * UniPass is a smart-contract email wallet on CKB.
 * In this demo build, we use manual ckt1… address entry + server-side signing.
 * To upgrade to full UniPass SDK, install @unipassid/up-js and update this file.
 */

import type { WalletAdapter } from './WalletAdapter';

export class UniPassAdapter implements WalletAdapter {
  readonly name  = 'UniPass';
  readonly label = 'Email Wallet';
  readonly icon  = '✉️';

  private _address: string | null = null;

  getAddress() { return this._address; }

  async connect(): Promise<string> {
    console.log('[UniPassAdapter] Starting manual address entry…');

    // Prompt user for their CKB testnet address
    const raw = window.prompt(
      'UniPass — CKB Testnet Demo\n\n' +
      'Enter your CKB Aggron4 testnet address\n' +
      '(must start with "ckt1")',
      ''
    );

    // User cancelled the prompt
    if (raw === null) {
      throw new Error('UniPass: connection cancelled');
    }

    const address = raw.trim();

    // Validation
    if (!address) {
      throw new Error('UniPass: no address entered — please paste your ckt1… address');
    }
    if (!address.startsWith('ckt1')) {
      throw new Error(
        `UniPass: address must start with "ckt1" — got "${address.slice(0, 14)}…"\n` +
        'Tip: find your address in the CKB testnet faucet or your wallet app.'
      );
    }
    if (address.length < 46) {
      throw new Error('UniPass: address looks too short — check for copy/paste errors');
    }

    this._address = address;
    console.log('[UniPassAdapter] Connected with address:', address);
    return address;
  }

  disconnect(): void {
    console.log('[UniPassAdapter] Disconnecting');
    this._address = null;
  }

  async signTransaction(tx: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this._address) throw new Error('UniPass: not connected');

    console.log('[UniPassAdapter] Delegating sign to /api/tx/sign-dev…');

    const res = await fetch('/api/tx/sign-dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx }),
    });

    if (res.ok) {
      const { signedTx } = await res.json();
      console.log('[UniPassAdapter] Sign OK');
      return signedTx as Record<string, unknown>;
    }

    const err = await res.json().catch(() => ({ error: 'Sign request failed' }));
    const msg: string = err.error ?? 'Unknown sign error';

    if (msg.includes('PRIVATE_KEY')) {
      throw new Error(
        'UniPass demo signing needs PRIVATE_KEY in frontend/.env.local\n' +
        'Add: PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY and restart the dev server.'
      );
    }
    throw new Error(`UniPass signing failed: ${msg}`);
  }
}
