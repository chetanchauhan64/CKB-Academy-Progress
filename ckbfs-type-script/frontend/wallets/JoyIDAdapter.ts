/**
 * wallets/JoyIDAdapter.ts
 * Wraps the @joyid/ckb SDK into the WalletAdapter interface.
 * Uses redirect-based flow (popup blocked in most browsers on mobile).
 */

import type { WalletAdapter } from './WalletAdapter';

const JOYID_APP_URL = process.env.NEXT_PUBLIC_JOYID_URL ?? 'https://testnet.joyid.dev';

export class JoyIDAdapter implements WalletAdapter {
  readonly name  = 'JoyID';
  readonly label = 'Recommended';
  readonly icon  = '🔐';

  private _address: string | null = null;

  getAddress() { return this._address; }

  async connect(): Promise<string> {
    console.log('[JoyIDAdapter] Starting connect…', { JOYID_APP_URL });

    // @joyid/ckb connect — opens JoyID in a popup/redirect
    const { connect } = await import('@joyid/ckb');

    const redirectURL = typeof window !== 'undefined'
      ? window.location.href       // return to current page after auth
      : 'http://localhost:3000';

    console.log('[JoyIDAdapter] Calling connect() with redirectURL:', redirectURL);

    const account = await connect({
      joyidAppURL: JOYID_APP_URL,
      redirectURL,
    });

    console.log('[JoyIDAdapter] Got account:', account);

    if (!account?.address) {
      throw new Error('JoyID did not return an address. Try again.');
    }

    this._address = account.address;
    return account.address;
  }

  disconnect(): void {
    console.log('[JoyIDAdapter] Disconnecting');
    this._address = null;
  }

  async signTransaction(tx: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this._address) throw new Error('JoyID: not connected');

    console.log('[JoyIDAdapter] Signing tx…');
    const { signTransaction } = await import('@joyid/ckb');

    const redirectURL = typeof window !== 'undefined'
      ? window.location.href
      : 'http://localhost:3000';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signed = await (signTransaction as any)({
      tx,
      signerAddress: this._address,
      joyidAppURL: JOYID_APP_URL,
      redirectURL,
    });

    console.log('[JoyIDAdapter] Signed tx:', signed);
    return signed as Record<string, unknown>;
  }
}
