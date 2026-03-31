import { NextResponse } from 'next/server';
import { fetchCellByTxHash, parseCKBFSCell, buildVersionHistory } from '@/lib/ckbfs/indexer';
import { decodeCellData } from '@/lib/ckbfs/cell-codec';
import { ccc } from '@ckb-ccc/ccc';

// CKB RPC responses exceed Next.js 2MB fetch cache limit — opt out of caching.
export const dynamic = 'force-dynamic';


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
    // Fetch the live cell and decode its on-chain cell data to extract the backlinks array
    const cell = await fetchCellByTxHash(txHash);
    const cellData = decodeCellData(ccc.bytesFrom(cell.outputData));

    // Include the current head in the response alongside historical versions
    const currentPost = await parseCKBFSCell(cell, txHash);
    const historicalVersions = await buildVersionHistory(cellData.backlinks);

    return NextResponse.json({
      success: true,
      data: {
        current: currentPost,
        versions: historicalVersions,
        totalVersions: historicalVersions.length + 1, // historical + current
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
