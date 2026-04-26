/**
 * services/indexer.ts — CKB Indexer client
 * Runs in both browser (client) and Node.js (API routes).
 */

const RPC_URL = process.env.NEXT_PUBLIC_CKB_RPC_URL ?? 'https://testnet.ckbapp.dev';
const CODE_HASH = process.env.NEXT_PUBLIC_CKBFS_CODE_HASH ?? '';

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getLiveCells(lockScript: {
  codeHash: string;
  hashType: string;
  args: string;
}): Promise<unknown[]> {
  const result = (await rpc(RPC_URL, 'get_cells', [
    {
      script: lockScript,
      script_type: 'lock',
      filter: {
        script: null,
        output_data_len_range: ['0x0', '0x1'],
      },
    },
    'asc',
    '0x64',
  ])) as { objects: unknown[] };
  return result.objects ?? [];
}

export async function getCkbfsCells(
  lockScript: { codeHash: string; hashType: string; args: string },
  codeHash?: string,
): Promise<unknown[]> {
  const ch = codeHash ?? CODE_HASH;
  const result = (await rpc(RPC_URL, 'get_cells', [
    {
      script: lockScript,
      script_type: 'lock',
      filter: {
        script: {
          code_hash: ch,
          hash_type: 'data1',
          args: '0x',
        },
      },
    },
    'asc',
    '0x64',
  ])) as { objects: unknown[] };
  return result.objects ?? [];
}

export async function getTipBlockNumber(): Promise<number> {
  const result = await rpc(RPC_URL, 'get_tip_header', []);
  const tip = result as { number: string };
  return parseInt(tip.number, 16);
}

export async function getBalance(address: string): Promise<bigint> {
  const { toLockScript } = await import('./ckb');
  const lockScript = toLockScript(address);
  const cells = await getLiveCells({
    codeHash: lockScript.codeHash,
    hashType: lockScript.hashType,
    args: lockScript.args,
  });
  return (cells as Array<{ output: { capacity: string }; output_data: string }>)
    .filter(c => !c.output_data || c.output_data === '0x')
    .reduce((acc, c) => acc + BigInt(c.output.capacity), BigInt(0));
}

export async function broadcastTransaction(signedTx: Record<string, unknown>): Promise<string> {
  return rpc(RPC_URL, 'send_transaction', [signedTx, 'passthrough']) as Promise<string>;
}

export async function getTransactionStatus(txHash: string): Promise<string> {
  const result = await rpc(RPC_URL, 'get_transaction', [txHash]);
  const tx = result as { tx_status: { status: string } };
  return tx.tx_status.status;
}
