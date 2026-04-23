# CKBFS — Architecture Deep Dive

> **Version:** 0.2.0 | **Status:** Week 2 Active | **Target:** Nervos CKB Mainnet / Aggron Testnet

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Why a Type Script?](#2-why-a-type-script)
3. [Cell Data Binary Layout](#3-cell-data-binary-layout)
4. [Type Script Args Layout](#4-type-script-args-layout)
5. [State Machine Model](#5-state-machine-model)
6. [Validation Rule Engine](#6-validation-rule-engine)
7. [Script Group Execution](#7-script-group-execution)
8. [SHA-256 Integrity Layer](#8-sha-256-integrity-layer)
9. [Ownership & Destruction Protocol](#9-ownership--destruction-protocol)
10. [Multi-Chunk File Protocol](#10-multi-chunk-file-protocol)
11. [Module Dependency Map](#11-module-dependency-map)
12. [Error Code Taxonomy](#12-error-code-taxonomy)
13. [Security Model](#13-security-model)
14. [Known Limitations (Week 2)](#14-known-limitations-week-2)

---

## 1. System Overview

CKBFS implements **on-chain file storage validation** by attaching a **Type Script** to every cell that holds file data. The Type Script is a RISC-V binary compiled from Rust and deployed as a cell on CKB. Any transaction involving a CKBFS cell must pass this binary's validation logic running inside the CKB VM.

```
┌─────────────────────────────────────────────────────────────┐
│                     CKB Transaction                         │
│                                                             │
│  Inputs               Outputs               Cell Deps       │
│  ┌──────────┐         ┌──────────┐         ┌────────────┐  │
│  │ CKBFS    │         │ CKBFS    │         │ CKBFS      │  │
│  │ Cell     │ ──────► │ Cell     │         │ Script     │  │
│  │ [chunk0] │         │ [chunk0] │         │ Binary     │  │
│  └──────────┘         └──────────┘         │ (RISC-V)   │  │
│                                            └────────────┘  │
│                       Type Script runs once for this group  │
└─────────────────────────────────────────────────────────────┘
```

Key design principle: **the Type Script is the only on-chain authority.** There is no admin key, no multisig committee, no oracle. If the Rust code allows it, it happens. If it rejects, it is impossible — even the original developer cannot override it.

---

## 2. Why a Type Script?

CKB cells have two script fields:

| Script | Role |
|--------|------|
| **Lock Script** | Controls *who* can spend the cell (ownership / signature) |
| **Type Script** | Controls *what* can happen to the cell (state machine / data rules) |

Lock scripts run on **inputs**. Type scripts run on **both inputs and outputs** — giving them the power to enforce state transitions: "if this cell existed before (input), and it exists after (output), the transition must be valid."

CKBFS uses the Type Script to enforce:
- **Content integrity** — SHA-256 of file content must match the embedded hash
- **Structural invariants** — chunk indexes, total chunks, version must be stable across updates
- **Ownership gates** — only the owner's lock hash can authorize destruction
- **Immutability** — cells flagged as immutable cannot be modified

---

## 3. Cell Data Binary Layout

```
 Offset   Size   Field          Encoding
 ──────   ────   ─────────────  ──────────────────────────────────
   0       1     version        u8, must equal 0x01
   1       1     flags          u8, bit-field (see below)
   2       4     chunk_index    u32, little-endian
   6       4     total_chunks   u32, little-endian
  10      32     sha256_hash    [u8; 32], SHA-256 of content field
  42      var    content        raw file bytes (may be 0 bytes)
```

**Minimum cell data size: 42 bytes.**

### Flags Byte (offset 1)

```
  Bit 7  Bit 6  Bit 5  Bit 4  Bit 3  Bit 2   Bit 1       Bit 0
  ─────  ─────  ─────  ─────  ─────  ─────  ──────────  ──────────
  (rsv)  (rsv)  (rsv)  (rsv)  (rsv)  (rsv)  FINALIZED   IMMUTABLE
```

| Bit | Flag | Meaning |
|-----|------|---------|
| 0 | `FLAG_IMMUTABLE` | Cell cannot be updated or its content changed. Update transactions are rejected. |
| 1 | `FLAG_FINALIZED` | All chunks of this file are present on-chain. Triggers contiguity validation (chunks must form a complete `[0, N)` range). |
| 2–7 | Reserved | Must be 0 in this version. |

---

## 4. Type Script Args Layout

```
 Offset   Size   Field              Encoding
 ──────   ────   ─────────────────  ──────────────────────────────────────────
   0      32     owner_lock_hash    [u8; 32] — Blake2b-256 of owner lock script
  32      32     file_id            [u8; 32] — arbitrary unique file identifier
```

**Total args size: exactly 64 bytes.**

`file_id` is chosen by the creator at creation time (e.g., Blake2b of filename + timestamp). It groups all chunk cells belonging to the same logical file and must never change across the file's lifetime.

`owner_lock_hash` is the `calc_script_hash()` result of the creator's lock script. It is embedded at creation, is immutable, and is the only way to authorize file destruction.

---

## 5. State Machine Model

CKBFS cells follow a strict state machine:

```
                  ┌──────────────────────┐
                  │     (none on-chain)   │
                  └──────────┬───────────┘
                             │ CREATE
                             │ (outputs only, type script present)
                             ▼
                  ┌──────────────────────┐
             ┌──► │      LIVE CELL       │ ◄─────┐
             │    │  (mutable, on-chain) │       │
             │    └──────────┬───────────┘       │
             │               │                   │
           UPDATE            │ UPDATE             │ (update loop)
             │               ▼                   │
             └──── (same cell, new content) ──────┘
                             │
                             │ DESTROY (owner)
                             ▼
                  ┌──────────────────────┐
                  │  (cell consumed,     │
                  │   CKByte released)   │
                  └──────────────────────┘

  Special: IMMUTABLE flag locks the cell into a read-only state.
  UPDATE attempts on an IMMUTABLE cell are REJECTED.
```

The script detects which transition is occurring by examining the **script group**:

| `GroupInput.count()` | `GroupOutput.count()` | Mode        |
|---------------------:|----------------------:|-------------|
| 0                    | > 0                   | CREATION    |
| > 0                  | > 0                   | UPDATE      |
| > 0                  | 0                     | DESTRUCTION |
| 0                    | 0                     | INVALID     |

---

## 6. Validation Rule Engine

### Creation Rules (C1–C6)

```rust
for each output cell in GroupOutput:
    C1: data.len() >= 42
    C2: data[0] == 0x01           // version
    C3: chunk_index < total_chunks
    C4: sha256(content) == stored_hash
    C5: chunk_index not already seen in this group
    C6: if FLAG_FINALIZED: chunk set == [0, 1, ..., total_chunks-1]
```

### Update Rules (U1–U8)

```rust
for each output cell in GroupOutput:
    U1:  apply C1–C4 to output
    U2:  find input with same chunk_index (pairing)
    U3:  output.chunk_index == input.chunk_index
    U4:  output.total_chunks == input.total_chunks
    U5:  output.version == input.version
    U6:  args.owner_lock_hash unchanged  (guaranteed by script group identity)
    U7:  args.file_id unchanged          (guaranteed by script group identity)
    U8:  input.flags & FLAG_IMMUTABLE == 0   → REJECT if set

// After loop: every input must have a corresponding output (no silent partials)
```

### Destruction Rule (D1)

```rust
// Scan ALL inputs in the transaction (not just the group)
D1: any(load_cell_lock_hash(i, Source::Input) == owner_lock_hash)
```

The owner proves authorization by including their identity cell as a transaction input. CKB guarantees lock scripts run before type scripts — so by the time D1 executes, the owner's signature has already been verified by their lock script.

---

## 7. Script Group Execution

CKB's VM runs each unique `(code_hash, hash_type, args)` triplet **once per transaction**, regardless of how many cells share that script. This is the "script group" model.

For CKBFS:
- All cells with **the same args** (same `file_id` + `owner_lock_hash`) form one group
- The script iterates over all cells in that group via `Source::GroupInput` / `Source::GroupOutput`
- This enables atomic multi-chunk operations — creating 3 chunks in one TX validates all 3 together

```
Transaction with 3 CKBFS outputs (same file_id):

  Output[0]  ─────┐
  Output[1]  ──── ► Script group: single execution validates all 3
  Output[2]  ─────┘
```

---

## 8. SHA-256 Integrity Layer

CKBFS ships its own SHA-256 implementation in `hash.rs`. This is deliberate:

- The CKB VM provides `ckb_vm_exec_hash` (Blake2b) as a syscall, but not SHA-256
- Using a pure Rust implementation avoids FFI and keeps the binary `no_std` clean
- The implementation follows FIPS 180-4 and is verified against NIST test vectors

The hash is embedded in the cell header (bytes 10–41) and verified on every CREATE and UPDATE. An attacker cannot modify file content without also regenerating the hash — but they cannot do so because the Type Script recomputes it from the raw content bytes.

**Why SHA-256 instead of Blake2b?**  
SHA-256 is universal — it matches what off-chain tools (browsers, OpenSSL, Python's `hashlib`) produce natively. This makes off-chain content verification trivial: `sha256sum file.txt` matches the on-chain value directly.

---

## 9. Ownership & Destruction Protocol

### Lock Script Hash as Identity

The `owner_lock_hash` embedded in args is the **Blake2b-256 hash of the entire lock script** (code_hash + hash_type + args). This means:

1. It captures the *specific* lock, not just the key.
2. Changing any part of the owner's lock script changes the hash → the proof fails.
3. The lock script is not stored on-chain in CKBFS — only its hash is. This keeps cell sizes small.

### Proving Ownership

To destroy a CKBFS cell:

```
Transaction inputs:
  [0] CKBFS file cell  (Type Script present — triggers our script)
  [1] Owner's identity cell  (Lock Script == the one whose hash is in args)

CKB execution order:
  1. Lock script of cell[1] runs → verifies owner's signature (secp256k1 etc.)
  2. Type script runs → checks that cell[1]'s lock hash == owner_lock_hash → OK
  3. Transaction accepted
```

No witness is parsed directly by the Type Script — it trusts CKB's execution ordering.

---

## 10. Multi-Chunk File Protocol

Large files are split across multiple cells. Each chunk cell carries:
- The same `file_id` and `owner_lock_hash` in args (same script group)
- A unique `chunk_index` (0-based)
- The same `total_chunks`

### Upload (3 chunks, 1 TX)

```
TX outputs:
  Cell[0]: file_id=X, chunk_index=0, total_chunks=3, content=bytes[0..N]
  Cell[1]: file_id=X, chunk_index=1, total_chunks=3, content=bytes[N..2N]
  Cell[2]: file_id=X, chunk_index=2, total_chunks=3, content=bytes[2N..3N]
```

The script validates:
- No duplicate `chunk_index` values (C5)
- All `total_chunks` values are identical across the group
- If FINALIZED: set `{0,1,2}` is contiguous (C6)

### Partial Upload (streaming large files)

A file can be uploaded in multiple transactions:

```
TX1: upload chunks 0–2  (not finalized)
TX2: upload chunks 3–5  (not finalized)
TX3: mark chunks 0–5 as finalized (set FLAG_FINALIZED via update)
```

The finalization check only triggers when `FLAG_FINALIZED` is set, so partial uploads are valid.

---

## 11. Module Dependency Map

```
main.rs
  └── entry.rs
        ├── cell_data.rs
        │     └── hash.rs
        │     └── error.rs
        └── error.rs

lib.rs  (re-exports all modules for tests)
  ├── cell_data.rs
  ├── entry.rs
  ├── error.rs
  └── hash.rs
```

**No circular dependencies.** `hash.rs` and `error.rs` are leaf nodes with no internal imports.

---

## 12. Error Code Taxonomy

| Range | Category | Codes |
|-------|----------|-------|
| 1–9 | CKB syscall / SDK errors | `IndexOutOfBound=1`, `ItemMissing=2`, `LengthNotEnough=3`, `Encoding=4` |
| 10–19 | Data structure / parsing | `DataTooShort=10`, `UnsupportedVersion=11`, `InvalidChunkIndex=12`, `ZeroTotalChunks=13` |
| 20–29 | Type Script args | `InvalidArgsLength=20` |
| 30–39 | Hash / integrity | `HashMismatch=30` |
| 40–49 | State transition / update | `FileIdMismatch=40`, `OwnerLockHashMismatch=41`, `ChunkIndexChanged=42`, `TotalChunksChanged=43`, `ImmutableCell=44`, `VersionChanged=45` |
| 50–59 | Destruction / ownership | `UnauthorizedDestruction=50` |
| 60–69 | Group integrity | `DuplicateChunkIndex=60`, `NonContiguousChunks=61` |
| 100 | Internal | `Internal=100` |

All codes are negated when returned to the CKB VM (e.g., `HashMismatch` → exit code `-30`).

---

## 13. Security Model

| Threat | Mitigation |
|--------|------------|
| **Content tampering** | SHA-256 recomputed on-chain; any change to `content` invalidates the stored hash |
| **Chunk reordering** | `chunk_index` is pinned during updates (rule U3) |
| **Chunk injection** | Duplicate `chunk_index` detection (rule C5) |
| **Unauthorized deletion** | Owner lock hash must appear in transaction inputs (rule D1) |
| **Ownership hijacking** | `owner_lock_hash` is immutable (baked into args, enforced by script group identity) |
| **Schema downgrade** | `version` cannot change during update (rule U5) |
| **Immutable bypass** | `FLAG_IMMUTABLE` check on input cell is done before any output validation |
| **Total chunk change** | `total_chunks` must be identical across input/output pairs (rule U4) |

### What CKBFS Does NOT Protect Against (Week 2)

- **Duplicate file_id** across different `owner_lock_hash` pairs (two users can claim the same file_id with different owners — Week 4 will address this via a registry cell)
- **Off-chain content availability** — cells can be destroyed, losing the data permanently
- **Script upgrade attacks** — Type ID upgradeable scripts are not yet implemented (Week 4)

---

## 14. Known Limitations (Week 2)

1. **No Lumos integration yet** — transactions must be constructed manually or via `ckb-testtool` (Week 3 addresses this)
2. **Single owner** — no multi-sig ownership or ownership transfer (planned for Week 4)
3. **No indexer queries** — retrieving all chunks of a file requires scanning cells manually (Week 4 adds indexing strategy)
4. **Fixed version** — the Type Script binary is not upgradeable; deployed code is final (Type ID pattern planned for Week 4)
5. **Content size limit** — bounded by CKB's max cell data size (~32KB per chunk in practice; split into more chunks for larger files)
