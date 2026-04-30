/**
 * services/indexer.ts — CKB broadcast client
 *
 * Broadcast strategy (single-RPC, two attempts):
 *   1. Sleep 5000ms — blockchain propagation buffer
 *   2. Attempt 1 → PRIMARY_RPC (testnet.ckb.dev)
 *   3. If Unknown OutPoint: sleep 8000ms → retry SAME TX on SAME RPC
 *   4. FIX 3: After successful send_transaction, poll get_transaction until "committed"
 *   5. If both broadcast attempts fail → throw → client triggers full tx rebuild
 *
 * ❌ DO NOT switch RPC mid-tx (split-brain risk)
 * ❌ DO NOT retry immediately on OutPoint error
 */

const PRIMARY_RPC   = process.env.NEXT_PUBLIC_CKB_RPC_URL ?? 'https://testnet.ckb.dev';
const SECONDARY_RPC = 'https://testnet.ckbapp.dev'; // NOT used in broadcast path — single-RPC architecture
const CODE_HASH     = process.env.NEXT_PUBLIC_CKBFS_CODE_HASH ?? '';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache  : 'no-store',
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

function isOutPointError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('unknown outpoint') ||
    msg.includes('unknown out point') ||
    msg.includes('resolve failed') ||
    msg.includes('inputs not stable') ||
    msg.includes('inputs not live')
  );
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getLiveCells(lockScript: {
  codeHash: string;
  hashType: string;
  args: string;
}): Promise<unknown[]> {
  const result = (await rpc(PRIMARY_RPC, 'get_cells', [
    {
      script     : lockScript,
      script_type: 'lock',
      filter     : { script: null, output_data_len_range: ['0x0', '0x1'] },
    },
    'desc',
    '0x32',
  ])) as { objects: unknown[] };
  return result.objects ?? [];
}

export async function getCkbfsCells(
  lockScript: { codeHash: string; hashType: string; args: string },
  codeHash?: string,
): Promise<unknown[]> {
  const ch = codeHash ?? CODE_HASH;
  const result = (await rpc(PRIMARY_RPC, 'get_cells', [
    {
      script     : lockScript,
      script_type: 'lock',
      filter     : { script: { code_hash: ch, hash_type: 'data1', args: '0x' } },
    },
    'asc',
    '0x64',
  ])) as { objects: unknown[] };
  return result.objects ?? [];
}

export async function getTipBlockNumber(): Promise<number> {
  const result = await rpc(PRIMARY_RPC, 'get_tip_header', []);
  const tip = result as { number: string };
  return parseInt(tip.number, 16);
}

export async function getBalance(address: string): Promise<bigint> {
  const { toLockScript } = await import('./ckb');
  const lockScript = toLockScript(address);
  const cells = await getLiveCells({
    codeHash: lockScript.codeHash,
    hashType : lockScript.hashType,
    args     : lockScript.args,
  });
  return (cells as Array<{ output: { capacity: string }; output_data: string }>)
    .filter(c => !c.output_data || c.output_data === '0x')
    .reduce((acc, c) => acc + BigInt(c.output.capacity), BigInt(0));
}

// ─── FIX 3: Post-broadcast confirmation poll ──────────────────────────────────

/**
 * After send_transaction succeeds, poll get_transaction until status = "committed".
 * This verifies success via RPC, independent of indexer state.
 * Polls up to maxAttempts × intervalMs = ~30s total.
 */
async function waitForCommit(
  txHash     : string,
  intervalMs  = 3000,
  maxAttempts = 10,
): Promise<boolean> {
  for (let i = 1; i <= maxAttempts; i++) {
    await sleep(intervalMs);
    try {
      const result = (await rpc(PRIMARY_RPC, 'get_transaction', [txHash])) as {
        tx_status: { status: string };
      };
      const status = result?.tx_status?.status;
      console.log(`[indexer] waitForCommit poll ${i}/${maxAttempts}: status = ${status}`);
      if (status === 'committed') {
        console.log('[indexer] ✅ Transaction confirmed on-chain (committed)');
        return true;
      }
    } catch (e) {
      console.warn(`[indexer] waitForCommit poll ${i} error:`, e instanceof Error ? e.message : e);
    }
  }
  console.warn('[indexer] waitForCommit: timed out — tx may still confirm later');
  return false;
}

/**
 * Broadcast a signed transaction — single-RPC, two attempts.
 * FIX 3: After successful send_transaction, verify commitment via get_transaction.
 *
 * Attempt 1:
 *   - Sleep 5000ms (propagation buffer)
 *   - send_transaction → PRIMARY_RPC
 *   - If success → waitForCommit → return txHash
 *
 * On Unknown OutPoint / Resolve failed:
 *   - Sleep 8000ms (node settling time)
 *   - Retry SAME TX on SAME PRIMARY_RPC
 *
 * On structural errors (bad sig, duplicate) → throw immediately, no retry.
 * If both attempts fail → throw → useCkbfs.ts triggers full tx rebuild with fresh cells.
 */
export async function broadcastTransaction(signedTx: Record<string, unknown>): Promise<string> {
  const inputs = signedTx.inputs as Array<{ previous_output: { tx_hash: string; index: string } }>;
  console.log(`[indexer] broadcastTransaction: ${inputs?.length ?? 0} input(s)`);
  inputs?.forEach((inp, i) => {
    console.log(`[indexer]   input[${i}]: ${inp.previous_output.tx_hash}:${parseInt(inp.previous_output.index, 16)}`);
  });

  // ── Attempt 1: 5s buffer then broadcast ────────────────────────────────────
  console.log('[indexer] Sleeping 5000ms before broadcast (propagation buffer)…');
  await sleep(5000);

  console.log(`[indexer] Attempt 1 — PRIMARY: ${PRIMARY_RPC}`);
  try {
    const txHash = (await rpc(PRIMARY_RPC, 'send_transaction', [signedTx, 'passthrough'])) as string;
    console.log(`[indexer] ✅ Broadcast accepted by PRIMARY — txHash: ${txHash}`);

    // FIX 3: Post-broadcast confirmation check via RPC (not indexer)
    console.log('[indexer] Verifying on-chain commitment via get_transaction…');
    await waitForCommit(txHash);

    return txHash;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[indexer] Attempt 1 failed: ${msg}`);

    // FIX 4: Don't throw immediately on OutPoint — give the node time to settle
    if (!isOutPointError(err)) {
      console.error('[indexer] ❌ Non-OutPoint error — not retrying');
      throw err;
    }

    // OutPoint error: node hasn't propagated inputs yet — wait longer, retry same RPC
    console.warn('[indexer] Unknown OutPoint — sleeping 8000ms then retrying on same RPC…');
    await sleep(8000);
  }

  // ── Attempt 2: same TX, same RPC, after longer wait ───────────────────────
  console.log(`[indexer] Attempt 2 — PRIMARY (retry): ${PRIMARY_RPC}`);
  try {
    const txHash = (await rpc(PRIMARY_RPC, 'send_transaction', [signedTx, 'passthrough'])) as string;
    console.log(`[indexer] ✅ Broadcast success on attempt 2 — txHash: ${txHash}`);

    // FIX 3: Confirm second attempt too
    console.log('[indexer] Verifying on-chain commitment via get_transaction…');
    await waitForCommit(txHash);

    return txHash;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[indexer] ❌ Both attempts failed: ${msg}`);
    throw new Error(
      `Transaction broadcast failed after 2 attempts (5s + 8s wait). ` +
      `Last error: ${msg}. ` +
      'A full transaction rebuild with fresh cells will be attempted.',
    );
  }
}

export async function getTransactionStatus(txHash: string): Promise<string> {
  const result = await rpc(PRIMARY_RPC, 'get_transaction', [txHash]);
  const tx = result as { tx_status: { status: string } };
  return tx.tx_status.status;
}

// SECONDARY_RPC available for future query fallback if needed
export { SECONDARY_RPC };
