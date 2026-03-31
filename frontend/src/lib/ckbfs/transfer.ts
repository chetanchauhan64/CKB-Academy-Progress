import { ccc } from '@ckb-ccc/ccc';
import { encodeCellData, decodeCellData } from './cell-codec';
import { CKBFSCellData } from './types';

/**
 * Transfers ownership of a CKBFS cell to a new address.
 * 
 * 1. Consumes existing cell
 * 2. Changes lock script
 * 3. Enforces index = null
 * 4. Checksum MUST NOT change
 * 
 * @param signer The CCC Signer (Current Owner)
 * @param txHash Previous TX Hash
 * @param outputIndex Previous Output Index
 * @param newOwnerAddress Destination address string format
 * @returns Transaction hash
 */
export async function transferPost(
  signer: ccc.Signer,
  txHash: string,
  outputIndex: number,
  newOwnerAddress: string
): Promise<string> {
  // 1. Fetch Previous Cell
  const outPoint = ccc.OutPoint.from({ txHash, index: outputIndex });
  const prevCell = await signer.client.getCell(outPoint);
  if (!prevCell) throw new Error('Live CKBFS cell not found for transfer.');

  const prevData = decodeCellData(ccc.bytesFrom(prevCell.outputData));

  // 2. Prepare new Owner Lock Script
  // Parse destination address string into a script
  const destinationScript = await ccc.Address.fromString(newOwnerAddress, signer.client);

  // 3. Update CKBFS Metadata
  const newCellData: CKBFSCellData = {
    ...prevData,
    index: null, // REQUIRED: Index strictly null on transfer
    // checksum UNCHANGED. Immutability maintained.
  };

  // 4. Build Transaction
  const tx = ccc.Transaction.from({
    inputs: [{
      previousOutput: outPoint,
    }],
    outputs: [{
      lock: destinationScript.script, // Ownership swap
      type: prevCell.cellOutput.type, // Identity preserved
    }],
    outputsData: [ccc.hexFrom(encodeCellData(newCellData))]
  });

  // 5. Submit
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  return await signer.sendTransaction(tx);
}
