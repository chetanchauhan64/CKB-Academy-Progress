# Week 3 — Lumos Transaction Builder for CKBFS

> **Status:** Planned | **Target Start:** 2026-04-29  
> **Goal:** Build a TypeScript SDK using Lumos that constructs, signs, and submits CKBFS transactions to CKB testnet.

---

## Overview

Week 2 delivered the on-chain Type Script. Week 3 delivers the **off-chain client** — a TypeScript SDK that makes it easy to CREATE, UPDATE, and DESTROY CKBFS file cells without manually building raw transaction bytes.

---

## Project Structure (Week 3)

```
ckbfs-lumos-sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public SDK exports
│   ├── config.ts             # Network config (testnet / devnet)
│   ├── ckbfs-client.ts       # Main CKBFSClient class
│   ├── cell-builder.ts       # Build CKBFS cell data bytes
│   ├── tx-builder.ts         # Construct Lumos transactions
│   ├── hash.ts               # SHA-256 (using Node.js crypto)
│   └── types.ts              # TypeScript interfaces
├── tests/
│   ├── create.test.ts
│   ├── update.test.ts
│   └── destroy.test.ts
└── examples/
    ├── upload-file.ts        # Upload a text file in chunks
    └── read-file.ts          # Fetch and reassemble file chunks
```

---

## Core SDK Interface

```typescript
// ckbfs-client.ts

export interface CKBFSConfig {
  rpcUrl: string;              // CKB node RPC endpoint
  indexerUrl: string;          // CKB Indexer endpoint
  scriptOutPoint: OutPoint;    // Deployed CKBFS script location
  codeHash: Hash;              // Blake2b of the script binary
}

export class CKBFSClient {
  constructor(config: CKBFSConfig) {}

  /**
   * Upload a file as one or more CKBFS cells.
   * Splits content into chunks, builds one TX per batch.
   */
  async createFile(params: {
    fileId: Hash;              // 32-byte unique file identifier
    content: Uint8Array;       // Full file content
    chunkSize?: number;        // Max bytes per chunk (default: 32KB)
    ownerLockScript: Script;
    privateKey: string;        // Hex-encoded secp256k1 private key
    finalize?: boolean;        // Set FLAG_FINALIZED if all chunks in one TX
  }): Promise<Hash[]>;        // Returns array of tx hashes

  /**
   * Update a specific chunk's content.
   */
  async updateChunk(params: {
    fileId: Hash;
    chunkIndex: number;
    newContent: Uint8Array;
    ownerLockScript: Script;
    privateKey: string;
  }): Promise<Hash>;

  /**
   * Destroy all chunks of a file. Requires owner's private key.
   */
  async destroyFile(params: {
    fileId: Hash;
    ownerLockScript: Script;
    privateKey: string;
  }): Promise<Hash>;

  /**
   * Fetch and reassemble file content from on-chain cells.
   */
  async readFile(params: {
    fileId: Hash;
    ownerLockHash: Hash;
  }): Promise<Uint8Array>;

  /**
   * List all CKBFS cells for a given file_id + owner.
   */
  async listChunks(params: {
    fileId: Hash;
    ownerLockHash: Hash;
  }): Promise<CKBFSCell[]>;
}
```

---

## Cell Data Builder

```typescript
// cell-builder.ts

import { createHash } from 'crypto';

export interface CKBFSCellData {
  version: number;         // 0x01
  flags: number;           // FLAG_IMMUTABLE | FLAG_FINALIZED
  chunkIndex: number;
  totalChunks: number;
  content: Uint8Array;
}

export const FLAG_IMMUTABLE = 0b00000001;
export const FLAG_FINALIZED = 0b00000010;

export function encodeCellData(cell: CKBFSCellData): Uint8Array {
  const sha256Hash = createHash('sha256').update(cell.content).digest();
  const buf = Buffer.alloc(42 + cell.content.length);

  buf.writeUInt8(cell.version, 0);
  buf.writeUInt8(cell.flags, 1);
  buf.writeUInt32LE(cell.chunkIndex, 2);
  buf.writeUInt32LE(cell.totalChunks, 6);
  sha256Hash.copy(buf, 10);
  Buffer.from(cell.content).copy(buf, 42);

  return new Uint8Array(buf);
}

export function decodeCellData(raw: Uint8Array): CKBFSCellData {
  if (raw.length < 42) throw new Error('Cell data too short');
  return {
    version: raw[0],
    flags: raw[1],
    chunkIndex: new DataView(raw.buffer).getUint32(2, true),
    totalChunks: new DataView(raw.buffer).getUint32(6, true),
    content: raw.slice(42),
  };
}

export function buildTypeScriptArgs(ownerLockHash: Uint8Array, fileId: Uint8Array): Uint8Array {
  if (ownerLockHash.length !== 32 || fileId.length !== 32) {
    throw new Error('owner_lock_hash and file_id must each be 32 bytes');
  }
  const args = new Uint8Array(64);
  args.set(ownerLockHash, 0);
  args.set(fileId, 32);
  return args;
}
```

---

## Transaction Builder — CREATE

```typescript
// tx-builder.ts (CREATE mode)

import { commons, helpers, config, RPC } from '@ckb-lumos/lumos';

export async function buildCreateTransaction(params: {
  cellsData: Uint8Array[];
  typeScriptArgs: Uint8Array;
  ownerLockScript: Script;
  ckbfsCodeHash: Hash;
  rpc: RPC;
}): Promise<TransactionSkeletonType> {
  let txSkeleton = helpers.TransactionSkeleton({ cellProvider: ... });

  // Add cell deps
  txSkeleton = addCKBFSCellDep(txSkeleton, params.ckbfsOutPoint);
  txSkeleton = addSecp256k1CellDep(txSkeleton);

  // Add one output cell per chunk
  for (const cellData of params.cellsData) {
    const capacity = helpers.minimalCellCapacityCompatible({
      cellOutput: { lock: params.ownerLockScript, type: ckbfsTypeScript },
      data: cellData,
    });

    txSkeleton = txSkeleton.update('outputs', (outputs) =>
      outputs.push({
        cellOutput: {
          capacity: `0x${capacity.toString(16)}`,
          lock: params.ownerLockScript,
          type: {
            codeHash: params.ckbfsCodeHash,
            hashType: 'data1',
            args: hexify(params.typeScriptArgs),
          },
        },
        data: hexify(cellData),
      })
    );
  }

  // Inject capacity from owner's cells
  txSkeleton = await commons.injectCapacity(
    txSkeleton,
    [params.ownerLockScript],
    BigInt(0),
    undefined,
    undefined,
    { config: config.TESTNET }
  );

  return txSkeleton;
}
```

---

## Implementation Milestones

| Week 3 Milestone | Target Date | Description |
|------------------|-------------|-------------|
| M1: Project setup | Day 1 | `npm init`, Lumos deps, tsconfig |
| M2: `encodeCellData` + `decodeCellData` | Day 2 | Match exact on-chain binary layout |
| M3: `buildCreateTransaction` | Day 3 | Single-chunk creation TX, tested on devnet |
| M4: `buildUpdateTransaction` | Day 4 | Chunk update TX with input fetching |
| M5: `buildDestroyTransaction` | Day 5 | Destruction with owner signing |
| M6: `readFile` (indexer queries) | Day 6 | Fetch + sort + concat all chunks |
| M7: Integration tests (testnet) | Day 7 | Real TXs on Aggron testnet |

---

## Key Dependencies

```json
{
  "dependencies": {
    "@ckb-lumos/lumos": "^0.21.0",
    "@ckb-lumos/base": "^0.21.0",
    "@ckb-lumos/common-scripts": "^0.21.0",
    "@ckb-lumos/helpers": "^0.21.0",
    "@ckb-lumos/rpc": "^0.21.0",
    "@ckb-lumos/ckb-indexer": "^0.21.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "ts-node": "^10.9.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

---

## Testing Strategy

```bash
# Unit tests (no network required)
npm test

# Devnet integration test (requires ckb devnet running locally)
CKB_RPC=http://localhost:8114 npm run test:integration

# Testnet integration test (requires testnet CKB + faucet funds)
CKB_RPC=https://testnet.ckbapp.dev npm run test:testnet
```

---

## Week 4 Preview (After Lumos SDK)

- **Multi-file registry cell**: A separate Type Script that maps `file_id → owner_lock_hash` globally, preventing duplicate file IDs across owners
- **Upgradeable script**: Integrate Type ID pattern so the CKBFS script binary can be upgraded without changing deployed cell references  
- **Indexing strategy**: Use CKB Indexer's `get_cells` API with script filter `{code_hash: CKBFS_CODE_HASH, args: [owner_lock_hash]}` to enumerate all files for a given owner  
- **CLI tool**: `ckbfs upload <file>`, `ckbfs read <file-id>`, `ckbfs delete <file-id>`
