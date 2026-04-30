/**
 * app/api/tx/status/route.ts
 *
 * FIX 8 — Returns the on-chain status of a transaction via PRIMARY RPC.
 * Used by pollTxCommit() in useCkbfs.ts to determine when a tx is "committed".
 *
 * GET /api/tx/status?txHash=0x...
 * Response: { status: "pending" | "proposed" | "committed" | "unknown" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransactionStatus } from '@/services/indexer';

export async function GET(req: NextRequest) {
  const txHash = req.nextUrl.searchParams.get('txHash');

  if (!txHash) {
    return NextResponse.json({ error: 'Missing txHash parameter' }, { status: 400 });
  }

  try {
    const status = await getTransactionStatus(txHash);
    console.log(`[api/tx/status] txHash: ${txHash} → status: ${status}`);
    return NextResponse.json({ status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/tx/status] Error:', msg);
    // Return unknown rather than 500 so the poller can keep trying
    return NextResponse.json({ status: 'unknown', error: msg });
  }
}
