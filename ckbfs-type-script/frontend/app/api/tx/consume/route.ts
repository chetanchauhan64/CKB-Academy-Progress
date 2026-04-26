import { NextRequest, NextResponse } from 'next/server';
import { buildConsumeTransaction } from '@/services/txBuilder';
import { toLockScript } from '@/services/ckb';

export async function POST(req: NextRequest) {
  try {
    const { address, fileId } = await req.json() as { address: string; fileId: string };
    if (!address || !fileId) return NextResponse.json({ error: 'Missing address or fileId' }, { status: 400 });
    const lockScript = toLockScript(address);
    const result = await buildConsumeTransaction({ lockScript, fileId });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
