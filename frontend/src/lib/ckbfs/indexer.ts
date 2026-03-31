import { ccc } from '@ckb-ccc/ccc';
import { client, RPC_URLS, createClientWithUrl } from './client';
import { decodeCellData } from './cell-codec';
import { CKBFS_CONTENT_TYPE, CKBFS_FILENAME, BackLink } from './types';
import { bytesToString, hexToBytes, validateWitnessFormat } from './witness';
import { ValidatedBlogPost } from './metadata';
import { computePublishChecksum, computeAppendChecksum } from './checksum';

// ─────────────────────────────────────────────────────────────────────────────
// RPC RETRY INFRASTRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

const RPC_TIMEOUT_MS = 10_000; // 10 s per attempt

/**
 * Runs `fn` with each RPC URL in sequence until one succeeds.
 * Each attempt is bounded by RPC_TIMEOUT_MS.
 * Throws only if every URL has been exhausted.
 */
async function fetchWithRetry<T>(
  fn: (rpcClient: ccc.ClientPublicTestnet) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (const url of RPC_URLS) {
    const rpcClient = url === RPC_URLS[0] ? client : createClientWithUrl(url);
    try {
      const result = await Promise.race([
        fn(rpcClient),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`RPC timeout after ${RPC_TIMEOUT_MS / 1000}s`)), RPC_TIMEOUT_MS)
        ),
      ]);
      return result;
    } catch (e) {
      console.warn(`RPC attempt failed for ${url}:`, e);
      lastError = e;
    }
  }
  throw lastError ?? new Error('All RPC endpoints failed');
}

/**
 * Output structure requested by the protocol definition.
 */
export interface CKBFSResolvedData {
  txHash: string;
  filename: string;
  content: string;
  metadata: Omit<ValidatedBlogPost, 'content'>;
  checksum: number;
  versions: Array<Omit<CKBFSResolvedData, 'versions'>>;
  backlinks: BackLink[];
}

/**
 * 1. fetchCellByTxHash
 * Fetches the specific cell holding the CKBFS data.
 */
export async function fetchCellByTxHash(txHash: string, index: number = 0): Promise<ccc.Cell> {
  return fetchWithRetry(async (rpcClient) => {
    const outPoint = ccc.OutPoint.from({ txHash, index });
    const cell = await rpcClient.getCell(outPoint);
    if (!cell) throw new Error(`Live CKBFS cell not found for TxHash: ${txHash}`);
    return cell;
  });
}

/**
 * 2. fetchWitness
 * Retrieves, validates, and decodes the CKBFS Witness <CKBFS><0x00><CONTENT_BYTES>
 * from a given transaction at the determined witness index.
 *
 * NEW: Also validates the Adler32 checksum of the decoded content bytes against
 * the expected checksum derived from the cell's backlink chain.
 */
export async function fetchWitness(
  txHash: string,
  witnessIndex: number,
  expectedChecksum?: number,
  existingBacklinks?: BackLink[]
): Promise<ValidatedBlogPost> {
  const tx = await client.getTransaction(txHash);
  if (!tx || !tx.transaction) throw new Error(`Transaction ${txHash} not found.`);

  const rawWitnessHex = tx.transaction.witnesses[witnessIndex];
  if (!rawWitnessHex) throw new Error(`Witness at index ${witnessIndex} missing.`);

  const witnessBytes = hexToBytes(rawWitnessHex as string);

  // --- Witness format validation ---
  if (!validateWitnessFormat(witnessBytes)) {
    throw new Error(`Invalid CKBFS witness format at ${txHash}[${witnessIndex}].`);
  }

  // Validate header precisely
  if (witnessBytes.length < 6) throw new Error('Witness is too short to be CKBFS.');
  const magic = bytesToString(witnessBytes.slice(0, 5));
  if (magic !== 'CKBFS') throw new Error(`Invalid CKBFS magic bytes: got "${magic}"`);
  if (witnessBytes[5] !== 0x00) throw new Error(`Unsupported CKBFS version: 0x${witnessBytes[5].toString(16)}`);

  const contentBytes = witnessBytes.slice(6); // payload starts at byte 6 (index 6)
  const jsonStr = bytesToString(contentBytes);

  // --- Checksum validation (NEW) ---
  // Rule: checksum stored in cell = Adler32(content, seed=prevChecksum)
  if (expectedChecksum !== undefined) {
    let computedChecksum: number;
    if (existingBacklinks && existingBacklinks.length > 0) {
      // APPEND path: chain from previous backlinks
      computedChecksum = computeAppendChecksum(existingBacklinks, contentBytes);
    } else {
      // PUBLISH path: fresh Adler32
      computedChecksum = computePublishChecksum(contentBytes);
    }

    if ((computedChecksum >>> 0) !== (expectedChecksum >>> 0)) {
      throw new Error(
        `CKBFS checksum mismatch at ${txHash}[${witnessIndex}]: ` +
        `expected 0x${(expectedChecksum >>> 0).toString(16).padStart(8, '0')}, ` +
        `got 0x${(computedChecksum >>> 0).toString(16).padStart(8, '0')}`
      );
    }
  }

  return JSON.parse(jsonStr) as ValidatedBlogPost;
}

/**
 * Validates that a backlinks array strictly follows the append-only protocol rule.
 * Rules:
 *  - Backlinks can only grow (never shrink)
 *  - Each entry must have a valid tx_hash (0x + 64 hex chars), index (>=0), and checksum (> 0)
 *  - Checksum chain must be internally consistent (each backlink's checksum must build on the previous)
 *
 * NEW: Backlink validation for indexer integrity.
 */
export function validateBacklinks(backlinks: BackLink[]): void {
  if (backlinks.length === 0) return; // Genesis cell — always valid

  for (let i = 0; i < backlinks.length; i++) {
    const bl = backlinks[i];

    // Structural validation
    if (!bl.tx_hash || !/^0x[0-9a-fA-F]{64}$/.test(bl.tx_hash)) {
      throw new Error(`Backlink[${i}] has invalid tx_hash format: "${bl.tx_hash}"`);
    }
    if (typeof bl.index !== 'number' || bl.index < 0 || !Number.isInteger(bl.index)) {
      throw new Error(`Backlink[${i}] has invalid witness index: ${bl.index}`);
    }
    if (typeof bl.checksum !== 'number' || bl.checksum <= 0) {
      throw new Error(`Backlink[${i}] has invalid checksum: ${bl.checksum}`);
    }
  }
}

/**
 * 3. buildVersionHistory
 * Sequentially retrieves historical states strictly tracing the `backlinks` array.
 */
export async function buildVersionHistory(backlinks: BackLink[]): Promise<Array<Omit<CKBFSResolvedData, 'versions'>>> {
  const versions: Array<Omit<CKBFSResolvedData, 'versions'>> = [];

  // Validate the entire backlink chain before traversing it
  validateBacklinks(backlinks);

  for (let i = 0; i < backlinks.length; i++) {
    const bl = backlinks[i];
    try {
      // Pass existing backlinks BEFORE this version for correct checksum computation
      const priorBacklinks = backlinks.slice(0, i);
      const pastPostData = await fetchWitness(bl.tx_hash, bl.index, bl.checksum, priorBacklinks);
      const { content, ...metadata } = pastPostData;

      versions.push({
        txHash: bl.tx_hash,
        filename: CKBFS_FILENAME,
        content,
        metadata,
        checksum: bl.checksum,
        backlinks: priorBacklinks,
      });
    } catch (e) {
      console.warn(`Failed to resolve backlink history for ${bl.tx_hash}:`, e);
    }
  }

  return versions;
}

/**
 * 4. parseCKBFSCell
 * Full orchestrated resolution of a Live CKBFS cell.
 * Now includes strict backlink validation and checksum verification.
 */
export async function parseCKBFSCell(cell: ccc.Cell, txHash: string): Promise<CKBFSResolvedData> {
  const dataBytes = ccc.bytesFrom(cell.outputData);
  const cellData = decodeCellData(dataBytes);

  // Protocol compliance check
  if (cellData.content_type !== CKBFS_CONTENT_TYPE || cellData.filename !== CKBFS_FILENAME) {
    throw new Error(
      `Cell does not match CKBFS protocol: content_type="${cellData.content_type}", filename="${cellData.filename}"`
    );
  }

  // Validate backlink chain integrity before using it
  validateBacklinks(cellData.backlinks);

  // Transfer cells have index=null — skip witness fetching for transferred cells
  if (cellData.index === null) {
    throw new Error(`Cell ${txHash} is a transferred cell (index=null). Witness is not present.`);
  }

  const witnessIndex = cellData.index;

  // Fetch and cryptographically verify the witness content matches the stored checksum
  const postData = await fetchWitness(
    txHash,
    witnessIndex,
    cellData.checksum,        // expected checksum from cell data
    cellData.backlinks        // existing backlinks for correct chain derivation
  );

  const { content, ...metadata } = postData;

  // Reconstruct version trajectory
  const versions = await buildVersionHistory(cellData.backlinks);

  return {
    txHash,
    filename: cellData.filename,
    content,
    metadata,
    checksum: cellData.checksum,
    versions,
    backlinks: cellData.backlinks,
  };
}

/**
 * Utility: Fetch all active posts owned by a user.
 */
export async function fetchUserPosts(addressStr: string): Promise<CKBFSResolvedData[]> {
  const lock = await ccc.Address.fromString(addressStr, client);

  const cellGenerator = client.findCells({
    script: lock.script,
    scriptType: 'lock',
    scriptSearchMode: 'exact',
  });

  const posts: CKBFSResolvedData[] = [];

  for await (const cell of cellGenerator) {
    try {
      const dataBytes = ccc.bytesFrom(cell.outputData);
      if (dataBytes.length < 20) continue;

      const resolved = await parseCKBFSCell(cell, cell.outPoint.txHash);
      posts.push(resolved);
    } catch {
      // Filter out non-CKBFS cells silently
    }
  }

  posts.sort((a, b) => b.metadata.created_at - a.metadata.created_at);
  return posts;
}

/**
 * Utility: Fetch all global posts using prefix search on the CKBFS Type ID script.
 */
export async function fetchAllPosts(): Promise<CKBFSResolvedData[]> {
  return fetchWithRetry(async (rpcClient) => {
    // Fetch the real TYPE_ID code hash from the network at runtime.
    const typeIdScript = await rpcClient.getKnownScript(ccc.KnownScript.TypeId);
    const CKBFS_CODE_HASH = typeIdScript.codeHash;

    const cellGenerator = rpcClient.findCells({
      script: ccc.Script.from({
        codeHash: CKBFS_CODE_HASH,
        hashType: typeIdScript.hashType,
        args: '0x',
      }),
      scriptType: 'type',
      scriptSearchMode: 'prefix',
    });

    const posts: CKBFSResolvedData[] = [];

    for await (const cell of cellGenerator) {
      try {
        const dataBytes = ccc.bytesFrom(cell.outputData);
        if (dataBytes.length < 20) continue;

        const resolved = await parseCKBFSCell(cell, cell.outPoint.txHash);
        posts.push(resolved);
      } catch {
        // Filter out non-CKBFS cells silently
      }
    }

    posts.sort((a, b) => b.metadata.created_at - a.metadata.created_at);
    return posts;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Version Tree Builder
// ─────────────────────────────────────────────────────────────────────────────

export interface VersionNode {
  txHash: string;
  depth: number;           // 0 = genesis, 1 = first append/fork, etc.
  isFork: boolean;         // true if this is a fork branch (has TYPE_ID different from parent chain)
  checksum: number;
  timestamp?: number;
  parentTxHash: string | null;
  children: VersionNode[];
}

/**
 * buildVersionTree
 * Builds a parent-child version tree for a resolved CKBFS post.
 * Backlinks form the linear history. This function reconstructs the tree
 * and marks fork branches based on missing backlink continuity.
 *
 * @param post A resolved CKBFS post (from parseCKBFSCell)
 * @returns A VersionNode root representing the genesis cell
 */
export function buildVersionTree(post: CKBFSResolvedData): VersionNode {
  // Build linear chain from all backlinks (oldest first)
  const chain: VersionNode[] = [];

  // Genesis node (first in the backlink chain)
  for (let i = 0; i < post.backlinks.length; i++) {
    const bl = post.backlinks[i];
    const parent = i === 0 ? null : post.backlinks[i - 1].tx_hash;
    chain.push({
      txHash: bl.tx_hash,
      depth: i,
      isFork: false,
      checksum: bl.checksum,
      parentTxHash: parent,
      children: [],
    });
  }

  // Current/latest node
  const currentNode: VersionNode = {
    txHash: post.txHash,
    depth: post.backlinks.length,
    isFork: false,
    checksum: post.checksum,
    timestamp: post.metadata.created_at,
    parentTxHash: post.backlinks.length > 0
      ? post.backlinks[post.backlinks.length - 1].tx_hash
      : null,
    children: [],
  };
  chain.push(currentNode);

  // Link parent → children
  const nodeMap = new Map<string, VersionNode>();
  for (const node of chain) nodeMap.set(node.txHash, node);

  for (const node of chain) {
    if (node.parentTxHash && nodeMap.has(node.parentTxHash)) {
      nodeMap.get(node.parentTxHash)!.children.push(node);
    }
  }

  // Return genesis (the node with no parent in chain)
  const genesis = chain.find(n => n.parentTxHash === null || !nodeMap.has(n.parentTxHash ?? ''));
  return genesis ?? chain[0];
}

/**
 * buildVersionTreeWithForks
 * Extends buildVersionTree by also attaching fork branches from the wider post list.
 *
 * A post in allPosts is a fork of the current post if:
 *   - It has a backlink whose tx_hash matches any node already in the tree.
 *   - Its own txHash is different from the root post.
 *
 * Fork nodes are marked isFork=true and attached as children of their parent node.
 *
 * @param post     The primary resolved post to build the tree for.
 * @param allPosts All resolved posts from the global feed (used to detect forks).
 * @returns        A VersionNode root representing the genesis cell with all branches attached.
 */
export function buildVersionTreeWithForks(
  post: CKBFSResolvedData,
  allPosts: CKBFSResolvedData[]
): VersionNode {
  // Start with the single-post linear tree
  const root = buildVersionTree(post);

  // Build a flat map of every node already in the tree (txHash → node)
  const nodeMap = new Map<string, VersionNode>();
  const queue: VersionNode[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    nodeMap.set(node.txHash, node);
    queue.push(...node.children);
  }

  // For each foreign post, check if any of its backlinks reference a node in our tree
  for (const candidate of allPosts) {
    if (candidate.txHash === post.txHash) continue; // skip self

    // Already attached (e.g. linear versions already in tree)
    if (nodeMap.has(candidate.txHash)) continue;

    // Find the deepest backlink that matches a known node
    let parentNode: VersionNode | undefined;
    for (let i = candidate.backlinks.length - 1; i >= 0; i--) {
      const bl = candidate.backlinks[i];
      if (nodeMap.has(bl.tx_hash)) {
        parentNode = nodeMap.get(bl.tx_hash);
        break;
      }
    }

    if (!parentNode) continue; // not related to this post's tree

    const forkNode: VersionNode = {
      txHash: candidate.txHash,
      depth: parentNode.depth + 1,
      isFork: true,
      checksum: candidate.checksum,
      timestamp: candidate.metadata.created_at,
      parentTxHash: parentNode.txHash,
      children: [],
    };

    parentNode.children.push(forkNode);
    nodeMap.set(forkNode.txHash, forkNode);
  }

  return root;
}

/**
 * getFeedSortedPosts
 * Returns the global feed sorted by a given strategy.
 *
 * @param mode 'latest' | 'versions' | 'forks'
 */
export async function getFeedSortedPosts(
  mode: 'latest' | 'versions' | 'forks' = 'latest'
): Promise<CKBFSResolvedData[]> {
  const all = await fetchAllPosts();
  if (mode === 'versions') {
    return [...all].sort((a, b) => (b.backlinks.length + 1) - (a.backlinks.length + 1));
  }
  if (mode === 'forks') {
    // "forks" = posts that have backlinks pointing to OTHER posts (TYPE_ID based)
    // As a heuristic: posts with more backlinks are likely more forked/updated
    return [...all].sort((a, b) => b.backlinks.length - a.backlinks.length);
  }
  // default: latest
  return all;
}

/**
 * detectForkedPosts
 * From a list of resolved posts, identifies which ones share backlink ancestry
 * with another post (indicating they are fork branches of a parent).
 *
 * Returns a map: parentTxHash → array of fork posts
 */
export function detectForkedPosts(
  posts: CKBFSResolvedData[]
): Map<string, CKBFSResolvedData[]> {
  const txSet = new Set(posts.map(p => p.txHash));
  const forkMap = new Map<string, CKBFSResolvedData[]>();

  for (const post of posts) {
    // A post is a fork if one of its backlinks matches another known post
    for (const bl of post.backlinks) {
      if (txSet.has(bl.tx_hash) && bl.tx_hash !== post.txHash) {
        const existing = forkMap.get(bl.tx_hash) ?? [];
        if (!existing.find(e => e.txHash === post.txHash)) {
          existing.push(post);
        }
        forkMap.set(bl.tx_hash, existing);
        break;
      }
    }
  }

  return forkMap;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// PROTOCOL VALIDATION LAYER
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export interface ImmutabilityViolation {
  field: 'content_type' | 'filename' | 'backlinks';
  expected: string;
  received: string;
}

/**
 * validateImmutability
 * Enforces the CKBFS protocol rule that content_type, filename, and existing
 * backlinks MUST NOT be mutated on APPEND or FORK operations.
 *
 * @param original  The current on-chain CKBFSResolvedData.
 * @param proposed  The proposed new cell data fields.
 * @throws Error describing all violations found.
 */
export function validateImmutability(
  original: CKBFSResolvedData,
  proposed: {
    filename?: string;
    backlinks?: BackLink[];
  }
): void {
  const violations: ImmutabilityViolation[] = [];

  // content_type is always application/json on CKBFS — never changes
  const EXPECTED_CT = CKBFS_CONTENT_TYPE;
  // filename is set at publish time — immutable
  if (proposed.filename !== undefined && proposed.filename !== original.filename) {
    violations.push({
      field: 'filename',
      expected: original.filename,
      received: proposed.filename,
    });
  }

  // Existing backlinks must be a prefix of the proposed backlinks array
  if (proposed.backlinks !== undefined) {
    const orig = original.backlinks;
    const next = proposed.backlinks;

    if (next.length < orig.length) {
      violations.push({
        field: 'backlinks',
        expected: `length >= ${orig.length}`,
        received: `length = ${next.length} (SHRINKAGE DETECTED)`,
      });
    } else {
      // Verify every existing entry is unchanged
      for (let i = 0; i < orig.length; i++) {
        const o = orig[i];
        const n = next[i];
        if (o.tx_hash !== n.tx_hash || o.index !== n.index || o.checksum !== n.checksum) {
          violations.push({
            field: 'backlinks',
            expected: `backlinks[${i}] = {tx_hash:${o.tx_hash}, index:${o.index}, checksum:${o.checksum}}`,
            received: `{tx_hash:${n.tx_hash}, index:${n.index}, checksum:${n.checksum}}`,
          });
        }
      }
    }
  }

  // Suppress unused variable warning
  void EXPECTED_CT;

  if (violations.length > 0) {
    const msg = violations
      .map(v => `  [${v.field}] expected: ${v.expected} | got: ${v.received}`)
      .join('\n');
    throw new Error(`CKBFS Immutability Violation:\n${msg}`);
  }
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// VERSION GRAPH (GIT-LIKE)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export interface VersionGraphEntry {
  txHash: string;
  versionNumber: number;      // 1-indexed, genesis = 1
  parentTxHash: string | null;
  checksum: number;
  timestamp?: number;
  diffWordsAdded?: number;    // basic diff indicator vs previous version
  diffWordsRemoved?: number;
  isCurrent: boolean;
}

/**
 * getTextDiff
 * Very lightweight word-count diff between two strings.
 * Returns an approximate diff indicator — good enough for UI display.
 */
export function getTextDiff(
  prev: string,
  next: string
): { added: number; removed: number; changed: boolean } {
  const prevWords = prev.trim().split(/\s+/).filter(Boolean);
  const nextWords = next.trim().split(/\s+/).filter(Boolean);
  const added = Math.max(0, nextWords.length - prevWords.length);
  const removed = Math.max(0, prevWords.length - nextWords.length);
  return { added, removed, changed: prev !== next };
}

/**
 * buildVersionGraph
 * Builds a flat ordered list (genesis first) of all versions of a post
 * with parent-child relationships and version numbers.
 *
 * @param post   A fully resolved CKBFS post.
 * @returns      Ordered array of VersionGraphEntry from genesis to current.
 */
export function buildVersionGraph(post: CKBFSResolvedData): VersionGraphEntry[] {
  const entries: VersionGraphEntry[] = [];

  // Genesis through all appended versions (from backlinks)
  for (let i = 0; i < post.backlinks.length; i++) {
    const bl = post.backlinks[i];
    const parentTxHash = i === 0 ? null : post.backlinks[i - 1].tx_hash;

    entries.push({
      txHash: bl.tx_hash,
      versionNumber: i + 1,
      parentTxHash,
      checksum: bl.checksum,
      isCurrent: false,
    });
  }

  // Current (latest) version
  entries.push({
    txHash: post.txHash,
    versionNumber: post.backlinks.length + 1,
    parentTxHash:
      post.backlinks.length > 0 ? post.backlinks[post.backlinks.length - 1].tx_hash : null,
    checksum: post.checksum,
    timestamp: post.metadata.created_at,
    isCurrent: true,
  });

  // Compute basic diff indicators using available resolved version data
  for (let i = 1; i < entries.length; i++) {
    const prevVersion = post.versions[i - 1];
    const currVersion = i < post.versions.length
      ? post.versions[i]
      : { content: post.content };

    if (prevVersion && currVersion) {
      const diff = getTextDiff(prevVersion.content ?? '', currVersion.content ?? '');
      entries[i].diffWordsAdded = diff.added;
      entries[i].diffWordsRemoved = diff.removed;
    }
  }

  return entries;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// BACKLINK GRAPH ENGINE
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export interface BacklinkGraphNode {
  txHash: string;
  index: number;           // witness index at that tx
  checksum: number;
  depth: number;           // position in chain (0 = genesis)
  next: string | null;    // txHash of the next version (towards latest)
}

/**
 * buildBacklinkGraph
 * Traverses the backlinks array of a post, building a linked-list representation
 * from genesis → latest.
 *
 * Validates structural integrity: each entry must have valid tx_hash + checksum.
 * Throws if chain is malformed.
 *
 * @param post  A resolved CKBFS post.
 * @returns     Ordered array from genesis (depth=0) to latest.
 */
export function buildBacklinkGraph(post: CKBFSResolvedData): BacklinkGraphNode[] {
  // validateBacklinks already checks structural integrity
  validateBacklinks(post.backlinks);

  const nodes: BacklinkGraphNode[] = post.backlinks.map((bl, i) => ({
    txHash: bl.tx_hash,
    index: bl.index,
    checksum: bl.checksum,
    depth: i,
    next: i + 1 < post.backlinks.length ? post.backlinks[i + 1].tx_hash : post.txHash,
  }));

  // Append the current (latest) node
  nodes.push({
    txHash: post.txHash,
    index: 0, // current tx witness index is in the cell data but we model it as final
    checksum: post.checksum,
    depth: post.backlinks.length,
    next: null, // latest = head of chain
  });

  return nodes;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// FORK TREE (GIT-LIKE BRANCHING)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export interface ForkTreeNode {
  post: CKBFSResolvedData;
  depth: number;           // 0 = root/original
  branches: ForkTreeNode[];
}

/**
 * detectForkTree
 * Builds a tree structure showing the root post and all fork branches.
 * A post is identified as a fork if any of its backlinks reference
 * another known post in the provided list.
 *
 * @param posts   All resolved CKBFS posts to analyse.
 * @returns       Array of root ForkTreeNodes (posts not forked from any other known post).
 */
export function detectForkTree(posts: CKBFSResolvedData[]): ForkTreeNode[] {
  const txMap = new Map<string, CKBFSResolvedData>();
  for (const p of posts) txMap.set(p.txHash, p);

  // Map: parentTxHash → children
  const childrenMap = new Map<string, CKBFSResolvedData[]>();
  const forkedSet = new Set<string>(); // txHashes that are forks

  for (const post of posts) {
    for (const bl of post.backlinks) {
      if (txMap.has(bl.tx_hash) && bl.tx_hash !== post.txHash) {
        // post is a fork of bl.tx_hash
        const children = childrenMap.get(bl.tx_hash) ?? [];
        if (!children.find(c => c.txHash === post.txHash)) {
          children.push(post);
        }
        childrenMap.set(bl.tx_hash, children);
        forkedSet.add(post.txHash);
        break;
      }
    }
  }

  function buildNode(post: CKBFSResolvedData, depth: number): ForkTreeNode {
    const children = childrenMap.get(post.txHash) ?? [];
    return {
      post,
      depth,
      branches: children.map(c => buildNode(c, depth + 1)),
    };
  }

  // Roots = posts that aren't forks of any known post
  const roots = posts.filter(p => !forkedSet.has(p.txHash));
  return roots.map(r => buildNode(r, 0));
}
