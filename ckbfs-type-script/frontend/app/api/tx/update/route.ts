import { NextRequest, NextResponse } from 'next/server';
import { buildUpdateTransaction } from '@/services/txBuilder';
import { toLockScript } from '@/services/ckb';

export async function POST(req: NextRequest) {
  try {
    const { address, fileId, fileContentBase64 } = await req.json() as {
      address: string; fileId: string; fileContentBase64: string;
    };
    if (!address || !fileId || !fileContentBase64) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const lockScript = toLockScript(address);
    const newContent = new Uint8Array(Buffer.from(fileContentBase64, 'base64'));
    const result = await buildUpdateTransaction({ lockScript, fileId, newContent });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
