import { NextResponse } from 'next/server';
import { fetchCellByTxHash, parseCKBFSCell } from '@/lib/ckbfs/indexer';

// CKB RPC responses exceed Next.js 2MB fetch cache limit — opt out of caching.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';


type RouteParams = { params: Promise<{ txHash: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { txHash } = await params;

  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json(
      { success: false, error: 'Invalid txHash format. Expected 0x-prefixed 64-char hex string.' },
      { status: 400 }
    );
  }

  try {
    const cell = await fetchCellByTxHash(txHash);
    const post = await parseCKBFSCell(cell, txHash);
    return NextResponse.json({ success: true, data: post });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
