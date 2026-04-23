# Transaction Lifecycle — From Lumos to CKB VM

> End-to-end flow of a CKBFS transaction: off-chain construction → RPC submission → on-chain validation.

---

## Overview

```
Developer's Machine                    CKB Network
────────────────────                   ────────────
  Lumos / CCC (TypeScript)
      │
      │  1. Build cell data bytes
      │  2. Set Type Script args
      │  3. Sign with owner's key
      │  4. Submit via RPC
      │
      └──────────────► CKB Node receives TX
                            │
                            │  5. Validate transaction structure
                            │  6. Run Lock Scripts (inputs)
                            │  7. Run Type Scripts (all groups)
                            │  8. Broadcast if all exit 0
                            │
                            └──────► Committed to blockchain
```

---

## Step 1 — Build Cell Data (Off-Chain)

```typescript
// Pseudo-code (Lumos / CCC TypeScript)
import { createHash } from 'crypto';

const content = Buffer.from("Hello, CKBFS! This is chunk 0 of 1.");

// Compute SHA-256 of content
const sha256Hash = createHash('sha256').update(content).digest();

// Encode cell data: [version][flags][chunk_index LE][total_chunks LE][sha256][content]
const cellData = Buffer.concat([
  Buffer.from([0x01]),           // version = 0x01
  Buffer.from([0x00]),           // flags = 0 (mutable, not finalized)
  Buffer.from(Uint32Array.of(0).buffer),  // chunk_index = 0, LE
  Buffer.from(Uint32Array.of(1).buffer),  // total_chunks = 1, LE
  sha256Hash,                    // 32 bytes
  content,                       // variable
]);
// Result: 42 + content.length bytes
```

---

## Step 2 — Build Type Script Args (Off-Chain)

```typescript
// owner_lock_hash = Blake2b-256 of the owner's lock script molecule encoding
const ownerLockScript = { codeHash: SECP256K1_CODE_HASH, hashType: 'type', args: ownerPubKeyHash };
const ownerLockHash = blake2b(serializeScript(ownerLockScript)); // 32 bytes

// file_id = arbitrary unique identifier (e.g., Blake2b of filename + timestamp)
const fileId = blake2b(Buffer.from(`my-file.txt:${Date.now()}`)); // 32 bytes

// args = owner_lock_hash || file_id (64 bytes total)
const typeScriptArgs = Buffer.concat([ownerLockHash, fileId]);
```

---

## Step 3 — Construct Transaction (Off-Chain)

```typescript
const tx = {
  version: '0x0',
  cellDeps: [
    {
      // Reference to the deployed CKBFS Type Script binary cell
      outPoint: CKBFS_SCRIPT_OUTPOINT,
      depType: 'code',
    },
    {
      // Reference to secp256k1 lock script (for signing)
      outPoint: SECP256K1_OUTPOINT,
      depType: 'depGroup',
    },
  ],
  inputs: [
    {
      // Capacity source cell (to pay for the new CKBFS cell)
      previousOutput: capacitySourceOutpoint,
      since: '0x0',
    },
  ],
  outputs: [
    {
      // The new CKBFS file cell
      capacity: hexify(calculateCellCapacity(cellData.length)),
      lock: ownerLockScript,
      type: {
        codeHash: CKBFS_CODE_HASH,  // Blake2b of the deployed binary
        hashType: 'data1',
        args: hexify(typeScriptArgs),
      },
    },
    {
      // Change cell back to owner
      capacity: hexify(changeCapacity),
      lock: ownerLockScript,
      type: null,
    },
  ],
  outputsData: [hexify(cellData), '0x'],
  witnesses: ['0x'],  // filled in after signing
};
```

---

## Step 4 — Sign and Submit (Off-Chain)

```typescript
// Sign the transaction hash with owner's secp256k1 key
const txHash = computeTransactionHash(tx);
const signature = secp256k1.sign(txHash, ownerPrivateKey);

// Attach signature as witness
tx.witnesses[0] = serializeWitnessArgs({ lock: signature });

// Submit via CKB RPC
const result = await rpc.sendTransaction(tx, 'passthrough');
// Returns: tx_hash (hex string) if accepted by mempool
```

---

## Step 5 — CKB Node Validates Structure

The receiving CKB node checks:
- All inputs exist in the UTXO set (live cells)
- Total input capacity ≥ total output capacity (no CKB creation)
- No double-spend within the same transaction
- Cell data and script fields are properly encoded (molecule)

**If any structural check fails → TX rejected before scripts run.**

---

## Step 6 — Lock Scripts Execute (Inputs)

For each input cell, the input's lock script runs:

```
Input[0] (capacity source):
  Lock = secp256k1-blake160
  → Verifies signature in witness[0] matches owner's pubkey
  → Exit 0 ✓

(No other inputs in CREATION mode)
```

---

## Step 7 — Type Scripts Execute (One Per Group)

```
CKBFS Type Script group (all cells sharing our code_hash + args):
  → entry::main() executes in CKB RISC-V VM
  → parse_args(): validates 64-byte args
  → collect_group_data(GroupInput)  = [] (empty — CREATION mode)
  → collect_group_data(GroupOutput) = [cell_data_bytes]
  → validate_creation([cell_data_bytes]):
      C1: 42 + content.len() >= 42 ✓
      C2: version == 0x01 ✓
      C3: chunk_index(0) < total_chunks(1) ✓
      C4: sha256(content) == stored_hash ✓
      C5: no duplicate chunk_indexes ✓
  → exit 0 ✓
```

---

## Step 8 — Broadcast and Commit

If ALL lock scripts and type scripts exit 0:
- Node adds TX to mempool
- Broadcasts to peer nodes
- After ~24 seconds (~2 CKB blocks), TX is committed on-chain
- The new CKBFS cell is now a **live cell** in the UTXO set

---

## DESTRUCTION Transaction Lifecycle

```
Off-chain:
  Build TX with:
    inputs[0] = CKBFS file cell  (type script present)
    inputs[1] = Owner identity cell  (lock = owner's lock script)
    outputs[0] = Change cell (no type script)

On-chain:
  Lock script of inputs[1] → verifies owner's signature ✓
  CKBFS Type Script:
    input_data = [file_cell_data]  (GroupInput has 1 cell)
    output_data = []               (GroupOutput is empty → DESTRUCTION)
    validate_destruction(owner_lock_hash):
      scan all inputs:
        inputs[1].lock_hash == owner_lock_hash ✓
    exit 0 ✓

  Result: CKBFS cell is consumed, CKByte released to change cell.
```
