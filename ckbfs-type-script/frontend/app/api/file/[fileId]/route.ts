import { NextRequest, NextResponse } from 'next/server';
import { readFileFromChain } from '@/services/txBuilder';
import { toLockScript } from '@/services/ckb';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const address = req.nextUrl.searchParams.get('address');
    if (!address) return NextResponse.json({ error: 'Missing address query param' }, { status: 400 });

    const lockScript = toLockScript(address);
    const result = await readFileFromChain(lockScript, fileId);
    if (!result) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    return NextResponse.json({
      fileId,
      chunks: result.chunks,
      contentBase64: Buffer.from(result.content).toString('base64'),
      size: result.content.length,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
