import { ccc } from '@ckb-ccc/ccc';
import { ValidatedBlogPost } from './metadata';
import { encodeCellData, decodeCellData } from './cell-codec';
import { encodeWitness, stringToBytes } from './witness';
import { computeAppendChecksum } from './checksum';
import { CKBFSCellData, BackLink } from './types';

/**
 * Forks a semantic branch off a CKBFS post, reusing its backlinks.
 * 
 * 1. Places Original Cell in CellDep (Read-Only reference)
 * 2. Generates completely new cell (New TYPE_ID/Identity)
 * 3. Incorporates old backlinks + forks off new content branch
 * 
 * @param signer The CCC Signer
 * @param originalTxHash Source TX
 * @param originalOutputIndex Source Index
 * @param forkContent The divergent Blog Post metadata
 * @returns Transaction hash
 */
export async function forkPost(
  signer: ccc.Signer,
  originalTxHash: string,
  originalOutputIndex: number,
  forkContent: ValidatedBlogPost
): Promise<string> {
  // 1. Fetch Source Cell for CellDep Reference
  const outPoint = ccc.OutPoint.from({ txHash: originalTxHash, index: originalOutputIndex });
  const originalCell = await signer.client.getCell(outPoint);
  if (!originalCell) throw new Error('Live CKBFS cell not found to fork.');

  const originalData = decodeCellData(ccc.bytesFrom(originalCell.outputData));

  // 2. Prepare Fork Backlinks
  // All historical links carry over into the new fork graph
  const forkBacklink: BackLink = {
    tx_hash: originalTxHash,
    index: originalData.index ?? 0,
    checksum: originalData.checksum,
  };
  const newBacklinks = [...originalData.backlinks, forkBacklink];

  // 3. New Content preparation
  const forkContentBytes = stringToBytes(JSON.stringify(forkContent));
  const newWitnessBytes = encodeWitness(forkContentBytes);
  const newChecksum = computeAppendChecksum(newBacklinks, forkContentBytes);

  const newCellData: CKBFSCellData = {
    content_type: originalData.content_type,
    filename: originalData.filename,
    index: 0, // Default for now
    checksum: newChecksum,
    backlinks: newBacklinks,
  };

  const addressStr = await signer.getRecommendedAddress();
  const lock = await ccc.Address.fromString(addressStr, signer.client);

  // 4. Build Transaction with CellDep
  const tx = ccc.Transaction.from({
    cellDeps: [{
      outPoint,
      depType: 'code', // Read-only
    }],
    outputs: [{
      lock: lock.script,
      // Type intentionally omitted until completeInputs
    }],
    outputsData: [ccc.hexFrom(encodeCellData(newCellData))]
  });

  // 5. Complete Inputs to Generate Type ID for the Fork
  await tx.completeInputsByCapacity(signer);

  if (tx.inputs.length > 0) {
    const typeIdHash = ccc.hashTypeId(tx.inputs[0], 0);
    const typeIdScript = await signer.client.getKnownScript(ccc.KnownScript.TypeId);
    tx.outputs[0].type = ccc.Script.from({
      ...typeIdScript,
      args: typeIdHash,
    });
  }

  // 6. Align Witness
  const targetWitnessIndex = tx.inputs.length;
  newCellData.index = targetWitnessIndex;
  tx.outputsData[0] = ccc.hexFrom(encodeCellData(newCellData));

  while (tx.witnesses.length < targetWitnessIndex) {
    tx.witnesses.push("0x");
  }
  tx.witnesses[targetWitnessIndex] = ccc.hexFrom(newWitnessBytes);

  // 7. Submit
  await tx.completeFeeBy(signer, 1000);
  return await signer.sendTransaction(tx);
}
