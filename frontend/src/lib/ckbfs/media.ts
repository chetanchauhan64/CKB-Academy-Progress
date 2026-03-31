import { ccc } from '@ckb-ccc/ccc';
import { encodeCellData, decodeCellData } from './cell-codec';
import { encodeWitness } from './witness';
import { computePublishChecksum, computeAppendChecksum } from './checksum';
import { CKBFSCellData, BackLink } from './types';
import { client } from './client';

const CKBFS_TX_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
const CKBFS_INDEX = 0;
const CKBFS_CODE_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

/** 150 KB — safe upper bound to stay under CKB P2P message size limits */
const MAX_CHUNK_SIZE = 150 * 1024;

/**
 * CKBFS Tx confirmation timeout (ms).
 * We wait for the previous tx to be indexed as a live cell before spending it.
 */
const TX_CONFIRM_TIMEOUT_MS = 60_000;
const TX_POLL_INTERVAL_MS   = 2_000;

// ---------------------------------------------------------------------------
// Internal helper: poll until a cell is live in the RPC indexer
// ---------------------------------------------------------------------------
async function waitForLiveCell(txHash: string, outputIndex: number): Promise<ccc.Cell> {
  const outPoint = ccc.OutPoint.from({ txHash, index: outputIndex });
  const deadline = Date.now() + TX_CONFIRM_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const cell = await client.getCell(outPoint);
    if (cell) return cell;
    await new Promise(resolve => setTimeout(resolve, TX_POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for cell ${txHash}[${outputIndex}] to appear in the RPC indexer after ${TX_CONFIRM_TIMEOUT_MS / 1000}s.`
  );
}

// ---------------------------------------------------------------------------
// 1. uploadImage — browser File → ckbfs:// URI
// ---------------------------------------------------------------------------
export async function uploadImage(file: File, signer: ccc.Signer): Promise<string> {
  const buffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(buffer);
  const contentType = file.type || 'image/png';
  return storeImageOnCKB(fileBytes, signer, contentType, file.name);
}

// ---------------------------------------------------------------------------
// 2. storeImageOnCKB — core chunking engine
// ---------------------------------------------------------------------------
export async function storeImageOnCKB(
  fileBytes: Uint8Array,
  signer: ccc.Signer,
  contentType: string,
  fileName: string,
): Promise<string> {
  // Split into ≤150 KB chunks
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < fileBytes.length; i += MAX_CHUNK_SIZE) {
    chunks.push(fileBytes.slice(i, i + MAX_CHUNK_SIZE));
  }

  // -- Genesis chunk ----------------------------------------------------------
  console.log(`[media] Publishing genesis chunk 1/${chunks.length}…`);
  let { txHash, checksum, witnessIndex, typeScript } = await publishMediaChunk(
    chunks[0], signer, contentType, fileName
  );
  const backlinks: BackLink[] = [];

  // -- Remaining chunks -------------------------------------------------------
  for (let i = 1; i < chunks.length; i++) {
    console.log(`[media] Waiting for chunk ${i}/${chunks.length} to be indexed…`);

    // FIX: Wait for the previous tx to be live before spending it.
    // This avoids the mempool-race where getCell returns undefined.
    await waitForLiveCell(txHash, 0);

    backlinks.push({ tx_hash: txHash, index: witnessIndex, checksum });

    console.log(`[media] Appending chunk ${i + 1}/${chunks.length}…`);
    const result = await appendMediaChunk(
      chunks[i], signer, txHash, backlinks, contentType, fileName, typeScript
    );

    txHash        = result.txHash;
    checksum      = result.checksum;
    witnessIndex  = result.witnessIndex;
    typeScript    = result.typeScript; // carry TYPE_ID forward — avoids re-fetching
  }

  return `ckbfs://${txHash}:${witnessIndex}`;
}

// ---------------------------------------------------------------------------
// Internal: publish genesis chunk
// ---------------------------------------------------------------------------
async function publishMediaChunk(
  chunkBytes: Uint8Array,
  signer: ccc.Signer,
  contentType: string,
  fileName: string,
): Promise<{ txHash: string; checksum: number; witnessIndex: number; typeScript: ccc.Script }> {

  // Checksum covers raw payload bytes only (not the witness header)
  const checksum = computePublishChecksum(chunkBytes);
  const witnessBytes = encodeWitness(chunkBytes); // <CKBFS><0x00><chunkBytes>

  const cellData: CKBFSCellData = {
    content_type: contentType,  // IMMUTABLE — set once here
    filename:     fileName,     // IMMUTABLE — set once here
    index:        0,            // placeholder; corrected after witness alignment
    checksum,
    backlinks:    [],
  };

  const addressStr = await signer.getRecommendedAddress();
  const lock = await ccc.Address.fromString(addressStr, signer.client);

  const tx = ccc.Transaction.from({
    cellDeps: [{ outPoint: { txHash: CKBFS_TX_HASH, index: CKBFS_INDEX }, depType: 'code' }],
    outputs:     [{ lock: lock.script }],
    outputsData: [ccc.hexFrom(encodeCellData(cellData))],
  });

  // Must complete inputs BEFORE hashTypeId so inputs[0] is deterministic
  await tx.completeInputsByCapacity(signer);
  if (tx.inputs.length === 0) throw new Error('Insufficient capacity for media publish.');

  // Bind TYPE_ID — provides stable on-chain identity for this media asset
  const typeId = ccc.hashTypeId(tx.inputs[0], 0);
  const typeScript = ccc.Script.from({ codeHash: CKBFS_CODE_HASH, hashType: 'data1', args: typeId });
  tx.outputs[0].type = typeScript;

  // Deterministic witness index: CKBFS payload sits after all input witnesses
  const witnessIndex = tx.inputs.length;
  cellData.index = witnessIndex;
  tx.outputsData[0] = ccc.hexFrom(encodeCellData(cellData));

  while (tx.witnesses.length <= witnessIndex) tx.witnesses.push('0x');
  tx.witnesses[witnessIndex] = ccc.hexFrom(witnessBytes);

  // Re-run capacity AFTER injecting the witness (accounts for byte cost increase)
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  const txHash = await signer.sendTransaction(tx);
  return { txHash, checksum, witnessIndex, typeScript };
}

// ---------------------------------------------------------------------------
// Internal: append a subsequent chunk
// FIX: accepts typeScript directly — no RPC round-trip needed, avoids mempool race
// ---------------------------------------------------------------------------
async function appendMediaChunk(
  chunkBytes: Uint8Array,
  signer: ccc.Signer,
  prevTxHash: string,
  currentBacklinks: BackLink[],  // all backlinks ALREADY including the one for prevTxHash
  contentType: string,
  fileName: string,
  typeScript: ccc.Script,        // carried forward from publishMediaChunk / previous append
): Promise<{ txHash: string; checksum: number; witnessIndex: number; typeScript: ccc.Script }> {

  // Checksum chains from last backlink checksum (CKBFS APPEND rule)
  const newChecksum = computeAppendChecksum(
    currentBacklinks.slice(0, -1), // backlinks BEFORE the new entry being added this tx
    chunkBytes
  );

  const witnessBytes = encodeWitness(chunkBytes);

  const newCellData: CKBFSCellData = {
    content_type: contentType,    // MUST match genesis — immutability enforced by caller
    filename:     fileName,       // MUST match genesis — immutability enforced by caller
    index:        0,              // placeholder; corrected after witness alignment
    checksum:     newChecksum,
    backlinks:    currentBacklinks,
  };

  const outPoint   = ccc.OutPoint.from({ txHash: prevTxHash, index: 0 });
  const addressStr = await signer.getRecommendedAddress();
  const lock       = await ccc.Address.fromString(addressStr, signer.client);

  const tx = ccc.Transaction.from({
    cellDeps: [{ outPoint: { txHash: CKBFS_TX_HASH, index: CKBFS_INDEX }, depType: 'code' }],
    inputs:      [{ previousOutput: outPoint }],
    outputs:     [{ lock: lock.script, type: typeScript }], // TYPE_ID preserved, no RPC needed
    outputsData: [ccc.hexFrom(encodeCellData(newCellData))],
  });

  // Deterministic witness index
  await tx.completeInputsByCapacity(signer);
  const witnessIndex = tx.inputs.length;

  newCellData.index    = witnessIndex;
  tx.outputsData[0]    = ccc.hexFrom(encodeCellData(newCellData));

  while (tx.witnesses.length <= witnessIndex) tx.witnesses.push('0x');
  tx.witnesses[witnessIndex] = ccc.hexFrom(witnessBytes);

  // Final capacity sweep after witness bytes are known
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  const txHash = await signer.sendTransaction(tx);
  return { txHash, checksum: newChecksum, witnessIndex, typeScript };
}

// ---------------------------------------------------------------------------
// 3. linkImageToPost
// ---------------------------------------------------------------------------
export function linkImageToPost(metadata: Record<string, unknown>, uri: string) {
  return { ...metadata, cover_image: uri };
}

// ---------------------------------------------------------------------------
// 4. isCKBFSMedia
// ---------------------------------------------------------------------------
export function isCKBFSMedia(url: string): boolean {
  return url.startsWith('ckbfs://');
}

// ---------------------------------------------------------------------------
// 5. resolveCKBFSMedia — reconstruct multi-chunk image into base64 data URI
// ---------------------------------------------------------------------------
export async function resolveCKBFSMedia(ckbfsUri: string, mimeType: string = 'image/png'): Promise<string> {
  if (!isCKBFSMedia(ckbfsUri)) return ckbfsUri;

  const uriBody = ckbfsUri.replace('ckbfs://', '');
  const [txHashHex, indexStr] = uriBody.split(':');
  const startWitnessIndex = parseInt(indexStr, 10);

  if (!txHashHex || isNaN(startWitnessIndex)) {
    throw new Error(`Invalid ckbfs:// URI: "${ckbfsUri}"`);
  }

  let currentTxHash     = txHashHex;
  let currentWitnessIdx = startWitnessIndex;

  // Walk BACKWARDS: Head → Genesis, collecting raw payload chunks
  const chunksReverse: Uint8Array[] = [];
  let headChecksum: number | undefined;

  while (currentTxHash) {
    const txResult = await client.getTransaction(currentTxHash);
    if (!txResult?.transaction) break;

    const rawHex = txResult.transaction.witnesses[currentWitnessIdx];
    if (!rawHex) break;

    const witnessBytes = ccc.bytesFrom(rawHex as string);

    // Validate CKBFS header
    if (witnessBytes.length < 6) throw new Error(`Witness too short in ${currentTxHash}`);
    const magic = String.fromCharCode(...Array.from(witnessBytes.slice(0, 5)));
    if (magic !== 'CKBFS' || witnessBytes[5] !== 0x00) {
      throw new Error(`Bad CKBFS header in ${currentTxHash}[${currentWitnessIdx}]`);
    }

    const payload = witnessBytes.slice(6);
    chunksReverse.push(payload);

    // Read cell data to get backlinks + stored checksum
    const outPoint = ccc.OutPoint.from({ txHash: currentTxHash, index: 0 });
    const cell     = await client.getCell(outPoint);
    if (!cell) break;

    const cellData = decodeCellData(ccc.bytesFrom(cell.outputData));

    // Store head checksum (first iteration = the Head cell)
    if (headChecksum === undefined) {
      headChecksum = cellData.checksum;
    }

    if (cellData.backlinks.length > 0) {
      const prev       = cellData.backlinks[cellData.backlinks.length - 1];
      currentTxHash    = prev.tx_hash;
      currentWitnessIdx = prev.index;
    } else {
      break; // Genesis reached
    }
  }

  if (chunksReverse.length === 0) {
    throw new Error(`resolveCKBFSMedia: no chunks found for ${ckbfsUri}`);
  }

  // Reassemble FORWARDS: Genesis → Head
  const totalLength    = chunksReverse.reduce((acc, c) => acc + c.length, 0);
  const fullBytes      = new Uint8Array(totalLength);
  let offset           = 0;
  for (let i = chunksReverse.length - 1; i >= 0; i--) {
    fullBytes.set(chunksReverse[i], offset);
    offset += chunksReverse[i].length;
  }

  // Validate reassembled checksum against Head cell's stored checksum
  // Rule: single-chunk → Adler32(fullBytes); multi-chunk → computed via chain
  const assembledChecksum = computePublishChecksum(fullBytes);
  if (headChecksum !== undefined && (assembledChecksum >>> 0) !== (headChecksum >>> 0)) {
    throw new Error(
      `CKBFS media checksum mismatch: expected 0x${(headChecksum >>> 0).toString(16).padStart(8, '0')}, ` +
      `got 0x${(assembledChecksum >>> 0).toString(16).padStart(8, '0')}`
    );
  }

  const base64 = Buffer.from(fullBytes).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}
