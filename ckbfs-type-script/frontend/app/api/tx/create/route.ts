import { NextRequest, NextResponse } from 'next/server';
import { buildCreateTransaction } from '@/services/txBuilder';
import { toLockScript } from '@/services/ckb';

export async function POST(req: NextRequest) {
  try {
    const { address, fileContentBase64, chunkSize } = await req.json() as {
      address: string; fileContentBase64: string; chunkSize?: number;
    };
    if (!address || !fileContentBase64) {
      return NextResponse.json({ error: 'Missing address or fileContentBase64' }, { status: 400 });
    }
    const lockScript = toLockScript(address);
    const fileContent = new Uint8Array(Buffer.from(fileContentBase64, 'base64'));
    const result = await buildCreateTransaction({ lockScript, fileContent, chunkSize: chunkSize ?? 32 * 1024 });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
