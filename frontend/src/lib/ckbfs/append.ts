import { ccc } from '@ckb-ccc/ccc';
import { ValidatedBlogPost } from './metadata';
import { encodeCellData, decodeCellData } from './cell-codec';
import { encodeWitness, toCanonicalBytes } from './witness';
import { computeAppendChecksum } from './checksum';
import { CKBFSCellData, BackLink } from './types';


/**
 * Appends a new version to an existing CKBFS cell on-chain.
 * 
 * Protocol Rules enforced:
 * 1. content_type & filename MUST NOT change (Immutable)
 * 2. previous backlinks MUST NOT change, only append new ones
 * 3. new Backlink points to specific tx_hash, index, and Adler32 checksum
 * 4. checksum is recovered from last state and updated with new content
 * 
 * @param signer The CCC Signer
 * @param txHash The transaction hash of the previous CKBFS cell
 * @param outputIndex The output index of the previous cell
 * @param updatedPost The upgraded post content metadata
 * @returns Built Transaction hash mapping to the new appended state
 */
export async function appendPost(
  signer: ccc.Signer, 
  txHash: string, 
  outputIndex: number, 
  updatedPost: ValidatedBlogPost
): Promise<string> {
  // 1. Fetch Previous Cell State
  const outPoint = ccc.OutPoint.from({
    txHash,
    index: outputIndex
  });
  
  const prevCell = await signer.client.getCell(outPoint);
  if (!prevCell) throw new Error('Live CKBFS cell not found for appending.');

  // Parse existing data directly from the cell
  const prevData = decodeCellData(ccc.bytesFrom(prevCell.outputData));
  const prevWitnessIndex = prevData.index ?? 0;
  const prevChecksum = prevData.checksum;

  const addressStr = await signer.getRecommendedAddress();
  const lock = await ccc.Address.fromString(addressStr, signer.client);

  // 2. Encode content: delegate to toCanonicalBytes() — same as publish.ts.
  //    Format Witness: <CKBFS><0x00><CONTENT_BYTES>
  const newContentBytes = toCanonicalBytes(updatedPost);
  const newWitnessBytes = encodeWitness(newContentBytes);

  // 3. Chain the backlink and re-compute Adler32 Checksum
  const newChecksum = computeAppendChecksum(prevData.backlinks, newContentBytes);
  
  const newBacklink: BackLink = {
    tx_hash: txHash,
    index: prevWitnessIndex,
    checksum: prevChecksum,
  };

  // 4. Construct updated CKBFS Cell Data
  const newCellData: CKBFSCellData = {
    content_type: prevData.content_type, // Enforce Immutability
    filename: prevData.filename,         // Enforce Immutability
    index: 0,                            // Placeholder for witness alignment
    checksum: newChecksum,               // Update checksum to Adler32 matching new content
    backlinks: [...prevData.backlinks, newBacklink], // Append only
  };

  // 5. Build Transaction — no custom cellDeps (matches publish.ts pattern)
  const tx = ccc.Transaction.from({
    inputs: [{
      previousOutput: outPoint,
    }],
    outputs: [{
      lock: lock.script,
      type: prevCell.cellOutput.type, // Persist identity of the CKBFS cell
    }],
    outputsData: [ccc.hexFrom(encodeCellData(newCellData))]
  });

  // Calculate Capacity required for extending cell size (due to array growth)
  await tx.completeInputsByCapacity(signer);
  
  // 6. Align Witness Index
  // Witnesses directly correlate to elements in inputs. Wait until capacity completes to map correctly.
  const targetWitnessIndex = tx.inputs.length; 
  
  newCellData.index = targetWitnessIndex;
  tx.outputsData[0] = ccc.hexFrom(encodeCellData(newCellData));

  while (tx.witnesses.length <= targetWitnessIndex) {
    tx.witnesses.push("0x");
  }
  
  // Insert strictly formatted CKBFS payload
  tx.witnesses[targetWitnessIndex] = ccc.hexFrom(newWitnessBytes);

  // 7. Complete fees & sign & send
  await tx.completeInputsByCapacity(signer); // Recalculate capacity given the witness injection size
  await tx.completeFeeBy(signer, 1000);
  
  return await signer.sendTransaction(tx);
}
