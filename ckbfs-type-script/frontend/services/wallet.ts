/**
 * services/wallet.ts — JoyID wallet integration (client-side)
 */

const JOYID_URL = process.env.NEXT_PUBLIC_JOYID_URL ?? 'https://testnet.joyid.dev';
const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

export async function connectJoyId(): Promise<{ address: string; pubkey: string }> {
  const { connect } = await import('@joyid/ckb');
  const account = await connect({ joyidAppURL: JOYID_URL, redirectURL: APP_URL });
  return { address: account.address, pubkey: account.pubkey };
}

// JoyID doesn't expose a disconnect API — wallet state is cleared locally
export async function disconnectJoyId(): Promise<void> { /* no-op */ }

export async function signWithJoyId(
  rawTx: Record<string, unknown>,
  signerAddress: string,
): Promise<Record<string, unknown>> {
  const { signTransaction } = await import('@joyid/ckb');
  // Cast to any to accommodate JoyID's internal API shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signed = await (signTransaction as any)({
    tx: rawTx,
    signerAddress,
    joyidAppURL: JOYID_URL,
    redirectURL: APP_URL,
  });
  return signed as Record<string, unknown>;
}

export async function broadcastTx(signedTx: Record<string, unknown>): Promise<string> {
  const res = await fetch('/api/tx/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTx }),
  });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.error ?? 'Broadcast failed');
  }
  const { txHash } = await res.json();
  return txHash;
}
