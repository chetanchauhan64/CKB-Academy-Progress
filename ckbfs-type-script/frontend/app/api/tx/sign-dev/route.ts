/**
 * app/api/tx/sign-dev/route.ts  — DEV MODE ONLY
 * Signs a CKB transaction using the server-side PRIVATE_KEY.
 * Implements CKB RFC-0024 secp256k1-blake2b signing.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: 'PRIVATE_KEY not set in .env.local' }, { status: 400 });
    }

    const { tx } = await req.json() as { tx: Record<string, unknown> };
    if (!tx) return NextResponse.json({ error: 'Missing tx' }, { status: 400 });

    // ── Imports ────────────────────────────────────────────────────────────────
    const { key }                    = await import('@ckb-lumos/hd');
    const { blockchain, utils }      = await import('@ckb-lumos/base');
    const { bytes }                  = await import('@ckb-lumos/codec');

    // ── Normalize tx fields (snake_case RPC → camelCase Molecule) ─────────────
    type RpcDepType = 'code' | 'dep_group';
    const toDepType = (d: string) => d === 'dep_group' ? 'depGroup' : 'code';

    const rawForHash = {
      version:     tx.version as string,
      cellDeps:   (tx.cell_deps as Array<{ dep_type: RpcDepType; out_point: { tx_hash: string; index: string } }>)
        .map(d => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          depType:  toDepType(d.dep_type) as any,
          outPoint: { txHash: d.out_point.tx_hash, index: d.out_point.index },
        })),
      headerDeps:  (tx.header_deps as string[] | undefined) ?? [],
      inputs:     (tx.inputs as Array<{ previous_output: { tx_hash: string; index: string }; since: string }>)
        .map(i => ({ previousOutput: { txHash: i.previous_output.tx_hash, index: i.previous_output.index }, since: i.since })),
      outputs:    (tx.outputs as Array<{ capacity: string; lock: { code_hash: string; hash_type: string; args: string }; type?: { code_hash: string; hash_type: string; args: string } | null }>)
        .map(o => ({
          capacity: o.capacity,
          lock: { codeHash: o.lock.code_hash, hashType: o.lock.hash_type as 'data' | 'type' | 'data1' | 'data2', args: o.lock.args },
          type: o.type ? { codeHash: o.type.code_hash, hashType: o.type.hash_type as 'data' | 'type' | 'data1' | 'data2', args: o.type.args } : undefined,
        })),
      outputsData: (tx.outputs_data as string[]),
    };

    // ── 1. Compute txHash ─────────────────────────────────────────────────────
    const packed  = blockchain.RawTransaction.pack(rawForHash);
    const txHash  = utils.ckbHash(bytes.hexify(packed));        // returns 0x-prefixed hex

    // ── 2. Build empty WitnessArgs placeholder (65-byte zero lock) ────────────
    const LOCK_PLACEHOLDER = new Uint8Array(65);
    const emptyWitnessArgs = blockchain.WitnessArgs.pack({
      lock: LOCK_PLACEHOLDER, inputType: undefined, outputType: undefined,
    });

    // ── 3. Compute signing message ─────────────────────────────────────────────
    // sigMsg = ckbHash(txHash_bytes || u64le(witnessLen) || witnessBytes)
    const txHashBytes = bytes.bytify(txHash);
    const lenBuf      = new Uint8Array(8);
    new DataView(lenBuf.buffer).setBigUint64(0, BigInt(emptyWitnessArgs.length), true);

    const msgInput = new Uint8Array(txHashBytes.length + lenBuf.length + emptyWitnessArgs.length);
    msgInput.set(txHashBytes, 0);
    msgInput.set(lenBuf, txHashBytes.length);
    msgInput.set(emptyWitnessArgs, txHashBytes.length + lenBuf.length);

    const signingMessage = utils.ckbHash(bytes.hexify(msgInput));

    // ── 4. Sign ────────────────────────────────────────────────────────────────
    const signature = key.signRecoverable(signingMessage, privateKey);   // 0x + 65 bytes

    // ── 5. Build signed WitnessArgs ────────────────────────────────────────────
    const signedWitnessBytes = blockchain.WitnessArgs.pack({
      lock: bytes.bytify(signature), inputType: undefined, outputType: undefined,
    });
    const signedWitnessHex = bytes.hexify(signedWitnessBytes);

    const witnesses    = tx.witnesses as string[];
    const newWitnesses = witnesses.map((w, i) => (i === 0 ? signedWitnessHex : w));

    return NextResponse.json({ signedTx: { ...tx, witnesses: newWitnesses } });
  } catch (err: unknown) {
    console.error('[sign-dev]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
