import { NextRequest, NextResponse } from 'next/server';
import { broadcastTransaction } from '@/services/indexer';

export async function POST(req: NextRequest) {
  try {
    const { signedTx } = await req.json() as { signedTx: Record<string, unknown> };
    if (!signedTx) return NextResponse.json({ error: 'Missing signedTx' }, { status: 400 });
    const txHash = await broadcastTransaction(signedTx);
    return NextResponse.json({ txHash });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
