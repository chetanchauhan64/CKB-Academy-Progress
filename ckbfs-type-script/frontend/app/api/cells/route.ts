import { NextRequest, NextResponse } from 'next/server';
import { listUserFiles } from '@/services/txBuilder';
import { toLockScript } from '@/services/ckb';

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address');
    if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    const lockScript = toLockScript(address);
    const files = await listUserFiles(lockScript);
    return NextResponse.json({ files });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
