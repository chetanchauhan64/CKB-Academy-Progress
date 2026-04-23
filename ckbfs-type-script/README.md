# CKBFS — CKB File Storage System

> **Week 2 Project | Nervos CKB Advanced Type Script Development**  
> An on-chain, tamper-proof file storage system built as a CKB Type Script in Rust.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-no__std%20%7C%20RISC--V-orange)](https://www.rust-lang.org/)
[![Network](https://img.shields.io/badge/Network-Nervos%20CKB%20Testnet-green)](https://explorer.nervos.org/aggron)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-blue)](.github/workflows/ci.yml)
[![Week](https://img.shields.io/badge/Progress-Week%202%20of%204-yellow)](./)

---

## What is CKBFS?

CKBFS is a **production-grade on-chain file storage system** built on Nervos CKB. It uses CKB's **Type Script** mechanism to enforce strict validation rules directly on-chain — no off-chain trust, no centralized authority.

Every file stored in CKBFS exists as one or more **cells** on the CKB blockchain. The Type Script compiled into the cell's script field acts as the **guardian** of that data — any transaction that creates, modifies, or destroys a CKBFS cell must satisfy all validation rules enforced by the RISC-V binary running inside the CKB VM.

### Why This Is Advanced

| Capability | Why It Matters |
|---|---|
| **On-Chain Validation** | Integrity checks run inside the CKB VM — not on your server |
| **Type Script Logic** | Custom state machine governing every cell lifecycle transition |
| **Multi-Cell Atomicity** | All file chunks in one transaction are validated as a group |
| **State Transition Enforcement** | Immutable cells, chunk reordering prevention, owner-gated destruction |
| **No Trusted Oracle** | SHA-256 of file content is verified on-chain — tampering is impossible |
| **Pure Rust SHA-256** | No `std`, no external hash crates — verified against NIST FIPS 180-4 vectors |

---

## Architecture

### Cell Data Layout (42-byte header)

```
 Byte  0     1     2–5          6–9          10–41        42–N
      ┌─────┬─────┬────────────┬────────────┬────────────┬──────────┐
      │ ver │flgs │chunk_index │total_chunks│ sha256[32] │ content  │
      │ 1B  │ 1B  │  4B (LE)  │  4B (LE)  │   32B      │variable  │
      └─────┴─────┴────────────┴────────────┴────────────┴──────────┘
```

| Field | Size | Description |
|---|---|---|
| `version` | 1 byte | Schema version — must be `0x01` |
| `flags` | 1 byte | Bit 0 = IMMUTABLE, Bit 1 = FINALIZED |
| `chunk_index` | 4 bytes LE | Zero-based chunk number within file |
| `total_chunks` | 4 bytes LE | Total number of chunks |
| `sha256_hash` | 32 bytes | SHA-256 of content payload |
| `content` | variable | Raw file bytes |

### Type Script Args (64 bytes)

```
[owner_lock_hash: 32 bytes][file_id: 32 bytes]
```

| Field | Description |
|---|---|
| `owner_lock_hash` | Blake2b hash of the owner's Lock Script — gates destruction |
| `file_id` | Arbitrary 32-byte file identifier — immutable after creation |

---

## Execution Modes

The Type Script detects its mode from the transaction structure:

```
┌──────────────────────────────────────────────────────────────────┐
│  Mode         │ Input group │ Output group │ Description         │
├──────────────────────────────────────────────────────────────────┤
│  CREATION     │    empty    │   has cells  │ Upload new file     │
│  UPDATE       │  has cells  │   has cells  │ Overwrite content   │
│  DESTRUCTION  │  has cells  │    empty     │ Delete file (owner) │
└──────────────────────────────────────────────────────────────────┘
```

---

## On-Chain Validation Rules

### Creation (C1–C6)

| Rule | Description |
|---|---|
| C1 | Data ≥ 42 bytes |
| C2 | Version == `0x01` |
| C3 | `chunk_index` < `total_chunks` |
| C4 | SHA-256(content) == embedded hash |
| C5 | No duplicate `chunk_index` in the group |
| C6 | If FINALIZED flag set → chunks must be contiguous `[0, N)` |

### Update (U1–U8)

| Rule | Description |
|---|---|
| U1 | All creation rules apply to outputs |
| U2 | Inputs and outputs are paired by `chunk_index` |
| U3 | `chunk_index` cannot change |
| U4 | `total_chunks` cannot change |
| U5 | `version` cannot change |
| U6 | `owner_lock_hash` cannot change (no ownership transfer) |
| U7 | `file_id` cannot change |
| U8 | If input has IMMUTABLE flag → **REJECT** |

### Destruction (D1)

| Rule | Description |
|---|---|
| D1 | At least one input's lock_hash == `owner_lock_hash` from args |

---

## How Transaction Validation Works End-to-End

```
User submits TX
      │
      ▼
CKB Node receives TX
      │
      ▼
Lock Script validation (inputs)
  → Owner's signature verified here
      │
      ▼
Type Script validation (CKBFS script — runs once per group)
  │
  ├── load_script() → read args (owner_lock_hash, file_id)
  │
  ├── collect GroupInput cell data
  ├── collect GroupOutput cell data
  │
  ├── Detect mode (CREATION / UPDATE / DESTRUCTION)
  │
  ├── CREATION → validate each output:
  │     parse() → verify_hash() → check duplicates → check contiguity
  │
  ├── UPDATE → pair input↔output by chunk_index:
  │     verify hashes, check immutability, verify field invariants
  │
  └── DESTRUCTION → scan all inputs:
        any lock_hash == owner_lock_hash? → ALLOW : REJECT
      │
      ▼
Exit 0 → TX accepted by all nodes
Exit ≠ 0 → TX rejected globally
```

### How Off-Chain and On-Chain Interact

```
Off-chain (Lumos / TypeScript)          On-chain (RISC-V / Rust)
──────────────────────────────          ────────────────────────
1. Build cell data bytes                5. CKB VM loads binary
   [ver][flags][idx][total]                from cell dep
   [sha256][content]
                                        6. Script reads group
2. Set Type Script args                    inputs/outputs via
   [owner_lock_hash][file_id]              syscalls (GroupInput,
                                           GroupOutput)
3. Sign with owner's key
   (lock script witness)                7. parse() → verify_hash()
                                           → mode rules → exit 0
4. Submit TX to RPC
```

---

## Project Structure

```
ckbfs-type-script/
│
├── 📄 Cargo.toml                    # Package manifest
├── 📄 capsule.toml                  # Capsule RISC-V build config
├── 📄 deployment.toml               # Testnet deployment config
├── 📄 README.md                     # This file
├── 📄 ARCHITECTURE.md               # 14-section deep technical design
├── 📄 CHANGELOG.md                  # Version history (Keep a Changelog)
├── 📄 LICENSE                       # MIT License
│
├── 📁 src/                          # On-chain Type Script (RISC-V Rust)
│   ├── main.rs                      # CKB binary entry point (no_std)
│   ├── lib.rs                       # Library root (for off-chain tests)
│   ├── entry.rs                     # ⭐ Core validation logic (3 modes)
│   ├── error.rs                     # Error enum → negative i8 exit codes
│   ├── cell_data.rs                 # Binary parser + SHA-256 verifier
│   └── hash.rs                      # Pure Rust SHA-256 (FIPS 180-4)
│
├── 📁 tests/src/                    # Off-chain simulation tests
│   ├── lib.rs
│   └── ckbfs_tests.rs               # 8 simulation test cases
│
├── 📁 prompts/                      # AI prompts used to build this project
│   ├── 01_initial_idea_prompt.md    # Concept generation session
│   ├── 02_upgrade_prompt.md         # Validation rule design session
│   └── 03_structure_prompt.md       # Full structure generation session
│
├── 📁 outputs/                      # Exported source artifacts (review copy)
│   ├── entry.rs
│   ├── error.rs
│   ├── cell_data.rs
│   ├── hash.rs
│   └── main.rs
│
├── 📁 docs/                         # Extended documentation
│   ├── validation-flow.md           # Step-by-step rule enforcement guide
│   ├── transaction-lifecycle.md     # End-to-end TX flow (Lumos → VM)
│   └── week3-lumos-plan.md          # Week 3 TypeScript SDK roadmap
│
└── 📁 .github/
    └── workflows/
        └── ci.yml                   # 4-job CI pipeline (lint, build, test, audit)
```

---

## Build & Run

### Prerequisites

```bash
# Rust with RISC-V target
rustup target add riscv64imac-unknown-none-elf

# Optional: Capsule for deployment
cargo install ckb-capsule
```

### Build

```bash
# Fast type-check (no binary produced)
cargo check --target riscv64imac-unknown-none-elf

# Debug build
cargo build --target riscv64imac-unknown-none-elf

# Release build (optimized for deployment — size + LTO)
cargo build --release --target riscv64imac-unknown-none-elf
```

### Test

```bash
# Unit tests: hash.rs + cell_data.rs (runs on native CPU, no RISC-V required)
cargo test --lib

# Off-chain simulation: full TX flow via ckb-testtool
# Requires debug binary to be built first (see above)
cargo test --features native-simulator
```

### Deploy (Testnet)

```bash
# Build release binary
cargo build --release --target riscv64imac-unknown-none-elf

# Deploy via Capsule (requires deployment.toml configured with your key)
capsule deploy --env testnet
```

---

## Error Code Reference

| Exit Code | Name | Trigger |
|---|---|---|
| `-10` | `DataTooShort` | `data.len() < 42` |
| `-11` | `UnsupportedVersion` | `version ≠ 0x01` |
| `-12` | `InvalidChunkIndex` | `chunk_index ≥ total_chunks` |
| `-13` | `ZeroTotalChunks` | `total_chunks == 0` |
| `-20` | `InvalidArgsLength` | `args ≠ 64 bytes` |
| `-30` | `HashMismatch` | `SHA-256(content) ≠ stored hash` |
| `-42` | `ChunkIndexChanged` | chunk reindexed during update |
| `-43` | `TotalChunksChanged` | `total_chunks` changed |
| `-44` | `ImmutableCell` | update attempted on IMMUTABLE cell |
| `-50` | `UnauthorizedDestruction` | owner lock not in inputs |
| `-60` | `DuplicateChunkIndex` | two cells share same `chunk_index` |
| `-61` | `NonContiguousChunks` | finalized file has chunk gaps |

---

## Code Statistics

| Module | Lines | Purpose |
|---|---|---|
| `entry.rs` | 294 | Core validation engine |
| `cell_data.rs` | 300 | Binary parser + 9 unit tests |
| `hash.rs` | 186 | SHA-256 + NIST test vectors |
| `error.rs` | 100 | Error codes + From impls |
| `main.rs` | 42 | Binary entry + allocator |
| `lib.rs` | 25 | Library root |
| `tests/ckbfs_tests.rs` | 368 | 8 simulation tests |
| **Total** | **1,315** | |

---

## Roadmap

| Week | Focus | Status |
|---|---|---|
| Week 1 | CKB fundamentals, live cell fetching, testnet transactions | ✅ Done |
| **Week 2** | **CKBFS Type Script — on-chain validation in Rust** | **🚧 Active** |
| Week 3 | Lumos-based TypeScript transaction builder for CKBFS | 📋 Planned |
| Week 4 | Multi-file support, upgradeable scripts, indexing strategy | 📋 Planned |

See [`docs/week3-lumos-plan.md`](docs/week3-lumos-plan.md) for the detailed Week 3 roadmap.

---

## Further Reading

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Deep technical design (14 sections)
- [`docs/validation-flow.md`](docs/validation-flow.md) — Step-by-step rule enforcement
- [`docs/transaction-lifecycle.md`](docs/transaction-lifecycle.md) — End-to-end TX flow
- [`docs/week3-lumos-plan.md`](docs/week3-lumos-plan.md) — Week 3 SDK plan
- [Nervos CKB Docs](https://docs.nervos.org/) — Official CKB documentation
- [ckb-std](https://github.com/nervosnetwork/ckb-std) — CKB Rust standard library

---

## License

MIT © 2026
