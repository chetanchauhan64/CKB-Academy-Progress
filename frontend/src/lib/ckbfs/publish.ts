import { ccc } from '@ckb-ccc/ccc';
import { ValidatedBlogPost } from './metadata';
import { encodeCellData } from './cell-codec';
import { encodeWitness } from './witness';
import { computePublishChecksum } from './checksum';
import { CKBFSCellData, CKBFS_CONTENT_TYPE, CKBFS_FILENAME } from './types';

/**
 * Publishes a new BlogPost to the CKBFS network.
 *
 * Flow:
 *   1. Encode blog content → CKBFS witness (MAGIC + VERSION + CONTENT_BYTES)
 *   2. Compute Adler32 checksum
 *   3. Build CKB transaction — NO custom CellDeps (the zero-hash placeholder was
 *      causing TransactionFailedToResolve; removed entirely)
 *   4. Assign built-in TYPE_ID type script (fetched from client, not hardcoded)
 *   5. Align CKBFS witness index in cell data
 *   6. Sign and broadcast
 *
 * @param signer  The CCC Signer (JoyID / CKB wallet)
 * @param post    Validated blog post metadata (Zod-parsed)
 * @returns       Transaction hash
 */
export async function publishPost(signer: ccc.Signer, post: ValidatedBlogPost): Promise<string> {
  // 1. Encode content → witness bytes, compute checksum
  // Canonical key order MUST match metadata.ts schema definition order so
  // JSON.stringify produces a deterministic string (JS preserves insertion order).
  // Order: title → description → author → tags → created_at → updated_at
  //        → is_paid → unlock_price → content
  const canonicalPost = {
    title:        post.title,
    description:  post.description ?? '',
    author:       post.author,
    tags:         post.tags ?? [],
    created_at:   post.created_at,
    updated_at:   post.updated_at,
    is_paid:      post.is_paid ?? false,
    unlock_price: post.unlock_price ?? 0,
    content:      post.content,
  };
  const jsonString = JSON.stringify(canonicalPost);
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(jsonString);
  const witnessBytes = encodeWitness(contentBytes);
  const checksum = computePublishChecksum(contentBytes);

  // 2. Build initial CKBFS cell data (witness index = 0, adjusted after inputs resolved)
  const cellData: CKBFSCellData = {
    content_type: CKBFS_CONTENT_TYPE,
    filename:     CKBFS_FILENAME,
    index:        0,
    checksum,
    backlinks:    [],
  };

  const addressStr = await signer.getRecommendedAddress();
  const lock = await ccc.Address.fromString(addressStr, signer.client);

  // 3. Build transaction — No cellDeps needed (no custom CKBFS on-chain contract)
  const tx = ccc.Transaction.from({
    outputs: [{
      lock: lock.script,
      // type script added below once TYPE_ID is deterministically generated
    }],
    outputsData: [ccc.hexFrom(encodeCellData(cellData))],
  });

  // 4. Complete inputs (needed before TYPE_ID hash — first input must exist)
  //    We use a minimal capacity pass here so inputs are resolved for hashTypeId.
  await tx.completeInputsByCapacity(signer);

  if (tx.inputs.length === 0) {
    throw new Error('Insufficient CKB capacity to publish post.');
  }

  // 5. Generate TYPE_ID from first input (deterministic, collision-resistant identity)
  const typeIdHash = ccc.hashTypeId(tx.inputs[0], 0);

  // Fetch the built-in TypeID script descriptor from the network (same pattern as fork.ts)
  const typeIdScript = await signer.client.getKnownScript(ccc.KnownScript.TypeId);
  tx.outputs[0].type = ccc.Script.from({
    ...typeIdScript,
    args: typeIdHash,
  });

  // 6. Align CKBFS witness index in cell data
  //    The index tells the indexer which witness slot holds the content.
  const targetWitnessIndex = tx.inputs.length;

  cellData.index = targetWitnessIndex;
  tx.outputsData[0] = ccc.hexFrom(encodeCellData(cellData));

  // Pad witnesses array so targetWitnessIndex is a valid slot
  while (tx.witnesses.length <= targetWitnessIndex) {
    tx.witnesses.push('0x');
  }
  // Inject CKBFS-formatted witness: <CKBFS><0x00><CONTENT_BYTES>
  tx.witnesses[targetWitnessIndex] = ccc.hexFrom(witnessBytes);

  // 7. Explicitly set output capacity to a safe minimum (300 CKB).
  //
  //    Why: After adding the TypeID type script and the ~1800-byte CKBFS witness,
  //    the cell's serialized size exceeds the capacity auto-assigned in step 4.
  //    CKB VM rejects the tx with InsufficientCellCapacity if capacity < cell bytes.
  //    300 CKB safely covers: lock script + TypeID type script + cell data + witness
  //    size overhead. completeInputsByCapacity will source enough inputs to meet
  //    this declared capacity and completeFeeBy will compute the correct miner fee.
  tx.outputs[0].capacity = ccc.fixedPointFrom(300);

  // 8. Re-run capacity after witness injection so inputs cover the declared 300 CKB
  //    output + miner fee. CCC will add more inputs if the first pass undershot.
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  // 8. Sign and broadcast
  return await signer.sendTransaction(tx);
}
