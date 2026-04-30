/**
 * app/api/tx/broadcast/route.ts
 *
 * - Validates signing integrity (inputs must not be mutated)
 * - Broadcasts via primary RPC
 * - On SUCCESS: clears lockedOutPoints so fresh cells available for next upload
 * - On FAILURE: lockedOutPoints stays locked → next rebuild uses different cells
 *
 * NOTE: The outputs integrity check is intentionally relaxed for JoyID wallet
 * compatibility. JoyID round-trips type fields as null/undefined which would
 * cause false positives in strict JSON comparison. Only the inputs (which
 * contain the UTXOs being spent) are checked strictly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { broadcastTransaction } from '@/services/indexer';
import { clearLockedOutPoints } from '@/services/txBuilder';

/** Normalize an outpoint for comparison — just tx_hash + index */
function normOutPoint(op: Record<string, unknown>) {
  return `${op.tx_hash}:${op.index}`;
}

export async function POST(req: NextRequest) {
  try {
    const { signedTx, rawTx } = await req.json() as {
      signedTx: Record<string, unknown>;
      rawTx?  : Record<string, unknown>;
    };

    if (!signedTx) {
      return NextResponse.json({ error: 'Missing signedTx' }, { status: 400 });
    }

    // ── Signing integrity check ────────────────────────────────────────────────
    if (rawTx) {
      // Check 1: Same number of inputs
      const rawInputs    = rawTx.inputs    as Array<Record<string, unknown>>;
      const signedInputs = signedTx.inputs as Array<Record<string, unknown>>;
      if (!signedInputs || rawInputs.length !== signedInputs.length) {
        return NextResponse.json(
          { error: `Signing integrity violation: input count changed (${rawInputs.length} → ${signedInputs?.length ?? 0})` },
          { status: 400 },
        );
      }

      // Check 2: Each input's outpoint unchanged (these are the UTXOs being spent)
      for (let i = 0; i < rawInputs.length; i++) {
        const rawOp    = normOutPoint(rawInputs[i].previous_output    as Record<string, unknown>);
        const signedOp = normOutPoint(signedInputs[i].previous_output as Record<string, unknown>);
        if (rawOp !== signedOp) {
          console.error(`[broadcast] ❌ Input #${i} outpoint mutated: ${rawOp} → ${signedOp}`);
          return NextResponse.json(
            { error: `Signing integrity violation: input #${i} outpoint was mutated (${rawOp} → ${signedOp})` },
            { status: 400 },
          );
        }
      }

      // Check 3: Same number of outputs
      const rawOutputs    = rawTx.outputs    as Array<Record<string, unknown>>;
      const signedOutputs = signedTx.outputs as Array<Record<string, unknown>>;
      if (!signedOutputs || rawOutputs.length !== signedOutputs.length) {
        return NextResponse.json(
          { error: `Signing integrity violation: output count changed (${rawOutputs.length} → ${signedOutputs?.length ?? 0})` },
          { status: 400 },
        );
      }

      // Check 4: Output capacities unchanged (wallet must not change amounts)
      for (let i = 0; i < rawOutputs.length; i++) {
        if (rawOutputs[i].capacity !== signedOutputs[i].capacity) {
          console.error(`[broadcast] ❌ Output #${i} capacity mutated`);
          return NextResponse.json(
            { error: `Signing integrity violation: output #${i} capacity was mutated` },
            { status: 400 },
          );
        }
      }

      console.log('[broadcast] ✅ Integrity check passed — inputs and capacities verified');
    } else {
      console.warn('[broadcast] rawTx not provided — skipping structural integrity check');
    }

    const inputs = signedTx.inputs as unknown[];
    if (!inputs || inputs.length === 0) {
      return NextResponse.json({ error: 'signedTx has no inputs' }, { status: 400 });
    }

    console.log(`[broadcast] Broadcasting tx with ${inputs.length} input(s), ${(signedTx.outputs as unknown[])?.length ?? 0} output(s)`);

    const txHash = await broadcastTransaction(signedTx);

    // ✅ SUCCESS — release all locked cells so next upload gets fresh ones
    clearLockedOutPoints();
    console.log(`[broadcast] ✅ txHash: ${txHash} — locked cells released`);

    return NextResponse.json({ txHash });

  } catch (err: unknown) {
    // ❌ FAILURE — do NOT clear locks; next rebuild attempt must use different cells
    console.error('[broadcast] ❌ Failed — locked cells retained for next rebuild attempt');
    console.error('[broadcast] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
