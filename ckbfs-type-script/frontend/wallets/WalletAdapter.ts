/**
 * wallets/WalletAdapter.ts — Common wallet interface
 * Every wallet (JoyID, PrivateKey, etc.) must implement this.
 */

export interface WalletAdapter {
  /** Human-readable name shown in the selector UI */
  readonly name: string;
  /** Short description / badge text */
  readonly label: string;
  /** Icon emoji or URL */
  readonly icon: string;

  /** Connect the wallet → returns the CKB address */
  connect(): Promise<string>;

  /** Disconnect / clear session */
  disconnect(): void;

  /** Current connected address, or null if not connected */
  getAddress(): string | null;

  /**
   * Sign an unsigned CKB transaction.
   * Receives the rawTx object from our TxBuilder.
   * Returns a signed tx ready to broadcast.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signTransaction(tx: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export type WalletType = 'joyid' | 'privatekey' | 'unipass';
