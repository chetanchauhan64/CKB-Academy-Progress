/**
 * app/api/wallet/dev-status/route.ts
 *
 * Returns { ready: boolean, configured: boolean } so the WalletModal can
 * disable the Private Key option gracefully when PRIVATE_KEY is not set,
 * and PrivateKeyAdapter can validate before signing.
 *
 * ✅ Safe — only returns booleans, never the key itself.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const hasKey = !!process.env.PRIVATE_KEY;
  return NextResponse.json({
    ready      : hasKey,   // used by PrivateKeyAdapter before signing
    configured : hasKey,   // used by WalletModal for UI
  });
}
