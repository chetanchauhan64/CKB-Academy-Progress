/**
 * app/api/wallet/dev-address/route.ts
 * Returns the CKB address derived from the server-side PRIVATE_KEY.
 * Private key never leaves the server.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: 'PRIVATE_KEY not set in .env.local' }, { status: 400 });
    }

    const { key }             = await import('@ckb-lumos/hd');
    const { helpers, config } = await import('@ckb-lumos/lumos');

    // Derive public key → args → lock script → address
    const pubKey = key.privateToPublic(privateKey);
    const args   = key.publicKeyToBlake160(pubKey);

    const cfg = (process.env.NEXT_PUBLIC_CKB_RPC_URL ?? '').includes('testnet')
      ? config.predefined.AGGRON4
      : config.predefined.LINA;

    const lockScript = {
      codeHash: cfg.SCRIPTS.SECP256K1_BLAKE160!.CODE_HASH,
      hashType: cfg.SCRIPTS.SECP256K1_BLAKE160!.HASH_TYPE,
      args,
    };

    const address = helpers.encodeToAddress(lockScript, { config: cfg });
    return NextResponse.json({ address });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
