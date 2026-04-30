/**
 * wallets/JoyIDAdapter.ts — @joyid/ckb v1.1.4 compatible
 *
 * KEY FIX: JoyID's signRawTransaction expects camelCase CKBTransaction format,
 * NOT the snake_case CKB RPC format our server builds.
 *
 * Required conversions:
 *   RPC → JoyID (before sign):  snake_case → camelCase + 'dep_group' → 'depGroup'
 *   JoyID → RPC (after sign):   camelCase → snake_case + 'depGroup' → 'dep_group'
 *
 * CKBTransaction shape expected by JoyID:
 *   { version, cellDeps: [{ outPoint: { txHash, index }, depType }],
 *     headerDeps, inputs: [{ previousOutput: { txHash, index }, since }],
 *     outputs: [{ capacity, lock: { codeHash, hashType, args }, type? }],
 *     outputsData, witnesses }
 */

import type { WalletAdapter } from './WalletAdapter';

const JOYID_APP_URL = process.env.NEXT_PUBLIC_JOYID_URL ?? 'https://testnet.joyid.dev';

// ─── Format converters ────────────────────────────────────────────────────────

interface JoyScript  { codeHash: string; hashType: string; args: string; }
interface JoyOutPoint { txHash: string; index: string; }
interface JoyCellDep { outPoint: JoyOutPoint; depType: 'depGroup' | 'code'; }
interface JoyInput   { previousOutput: JoyOutPoint; since: string; }
interface JoyOutput  { capacity: string; lock: JoyScript; type?: JoyScript | null; }
interface JoyCKBTx   {
  version: string;
  cellDeps: JoyCellDep[];
  headerDeps: string[];
  inputs: JoyInput[];
  outputs: JoyOutput[];
  outputsData: string[];
  witnesses: string[];
}

function toJoyScript(s: Record<string, unknown>): JoyScript {
  return {
    codeHash: s.code_hash as string,
    hashType : s.hash_type as string,
    args     : s.args as string,
  };
}

function toRpcScript(s: JoyScript): Record<string, unknown> {
  return { code_hash: s.codeHash, hash_type: s.hashType, args: s.args };
}

function toJoyOutPoint(op: Record<string, unknown>): JoyOutPoint {
  return { txHash: op.tx_hash as string, index: op.index as string };
}

function toRpcOutPoint(op: JoyOutPoint): Record<string, unknown> {
  return { tx_hash: op.txHash, index: op.index };
}

/** Convert CKB RPC snake_case tx → JoyID camelCase CKBTransaction */
function rpcToJoy(rawTx: Record<string, unknown>): JoyCKBTx {
  const cellDeps = (rawTx.cell_deps as Array<Record<string, unknown>>).map(cd => {
    const op  = cd.out_point as Record<string, unknown>;
    const dt  = cd.dep_type as string;
    return {
      outPoint: toJoyOutPoint(op),
      // 'dep_group' in RPC → 'depGroup' in JoyID; 'code' stays 'code'
      depType : (dt === 'dep_group' ? 'depGroup' : 'code') as 'depGroup' | 'code',
    };
  });

  const inputs = (rawTx.inputs as Array<Record<string, unknown>>).map(inp => ({
    previousOutput: toJoyOutPoint(inp.previous_output as Record<string, unknown>),
    since: inp.since as string,
  }));

  const outputs = (rawTx.outputs as Array<Record<string, unknown>>).map(out => {
    const type = out.type ? toJoyScript(out.type as Record<string, unknown>) : undefined;
    return {
      capacity: out.capacity as string,
      lock    : toJoyScript(out.lock as Record<string, unknown>),
      ...(type ? { type } : {}),
    };
  });

  return {
    version    : rawTx.version as string,
    cellDeps,
    headerDeps : rawTx.header_deps as string[],
    inputs,
    outputs,
    outputsData: rawTx.outputs_data as string[],
    // Normalize: '0x' (bare empty) → valid empty WitnessArgs molecule (16 bytes)
    // JoyID's molecule codec requires at minimum a 4-byte total-size header.
    witnesses  : ((rawTx.witnesses as string[]) ?? []).map(w =>
      w === '0x' || w === '' ? '0x10000000100000001000000010000000' : w
    ),
  };

}

/** Convert JoyID signed camelCase tx back → CKB RPC snake_case */
function joyToRpc(joyTx: JoyCKBTx): Record<string, unknown> {
  return {
    version    : joyTx.version,
    cell_deps  : joyTx.cellDeps.map(cd => ({
      out_point: toRpcOutPoint(cd.outPoint),
      dep_type : cd.depType === 'depGroup' ? 'dep_group' : 'code',
    })),
    header_deps : joyTx.headerDeps,
    inputs      : joyTx.inputs.map(inp => ({
      previous_output: toRpcOutPoint(inp.previousOutput),
      since          : inp.since,
    })),
    outputs     : joyTx.outputs.map(out => {
      const o: Record<string, unknown> = {
        capacity: out.capacity,
        lock    : toRpcScript(out.lock),
      };
      // Only include type if it exists — omitting matches original rawTx structure
      if (out.type) o.type = toRpcScript(out.type);
      return o;
    }),
    outputs_data: joyTx.outputsData,
    witnesses   : joyTx.witnesses,
  };
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class JoyIDAdapter implements WalletAdapter {
  readonly name  = 'JoyID';
  readonly label = 'Recommended';
  readonly icon  = '🔐';

  private _address: string | null = null;

  getAddress() { return this._address; }

  async connect(): Promise<string> {
    console.log('[JoyIDAdapter] Connecting via popup…', { JOYID_APP_URL });

    const { initConfig, connect } = await import('@joyid/ckb');

    initConfig({ joyidAppURL: JOYID_APP_URL, network: 'testnet' });

    console.log('[JoyIDAdapter] Calling connect()…');
    const account = await connect({});

    console.log('[JoyIDAdapter] Got account:', account);

    if (!account || !account.address) {
      throw new Error('JoyID did not return an address. Please try connecting again.');
    }

    this._address = account.address;
    console.log('[JoyIDAdapter] Connected — address:', this._address);
    return this._address;
  }

  disconnect(): void {
    console.log('[JoyIDAdapter] Disconnecting:', this._address);
    this._address = null;
  }

  async signTransaction(rawTx: Record<string, unknown>): Promise<Record<string, unknown>> {
    console.log('[JoyIDAdapter] signTransaction called — address:', this._address);

    if (!this._address) {
      console.warn('[JoyIDAdapter] No address — forcing reconnect…');
      await this.connect();
    }
    if (!this._address) {
      throw new Error('JoyID not connected — call connect() before signing');
    }

    const { initConfig, signRawTransaction } = await import('@joyid/ckb');
    initConfig({ joyidAppURL: JOYID_APP_URL, network: 'testnet' });

    // ✅ Step 1: Convert RPC snake_case → JoyID camelCase CKBTransaction
    const joyTx = rpcToJoy(rawTx);

    console.log('[JoyIDAdapter] Converted to JoyID format:',
      'inputs:', joyTx.inputs.length,
      'outputs:', joyTx.outputs.length,
      'cellDeps:', joyTx.cellDeps.length,
    );
    console.log('[JoyIDAdapter] First input previousOutput:', JSON.stringify(joyTx.inputs[0]?.previousOutput));
    console.log('[JoyIDAdapter] First cellDep:', JSON.stringify(joyTx.cellDeps[0]));

    // ✅ Step 2: Sign with JoyID (popup)
    // signRawTransaction(tx: CKBTransaction, signerAddress, config?) → signed CKBTransaction
    const signedJoy = await signRawTransaction(
      joyTx as unknown as Parameters<typeof signRawTransaction>[0],
      this._address,
      {},
    );

    console.log('[JoyIDAdapter] Signed tx — witnesses:', (signedJoy as unknown as JoyCKBTx)?.witnesses?.length);

    if (!signedJoy) {
      throw new Error('JoyID signRawTransaction returned no result');
    }

    // ✅ Step 3: Convert JoyID camelCase back → RPC snake_case for broadcast
    const signedRpc = joyToRpc(signedJoy as unknown as JoyCKBTx);
    console.log('[JoyIDAdapter] Converted back to RPC format — witnesses:', (signedRpc.witnesses as string[])?.length);

    return signedRpc;
  }
}
