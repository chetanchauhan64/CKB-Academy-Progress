# Prompt 03 — Structure Prompt

**Date:** 2026-04-22  
**Model:** Claude Sonnet (Thinking)  
**Purpose:** Generate the complete Week 2 project structure, all source files, documentation, and GitHub-ready assets

---

## Prompt Text

> I am building an advanced CKB Type Script project called CKBFS (CKB File Storage System).
>
> Here is my full implementation plan:
> [... full plan with cell layout, args layout, validation rules C1–C6, U1–U8, D1, project structure ...]
>
> Now generate a COMPLETE Week 2 project structure.
>
> I need:
> 1. Full GitHub folder structure
> 2. Professional README.md (based on THIS project)
> 3. prompts/ folder (include: initial idea prompt, upgrade prompt, structure prompt)
> 4. outputs/ folder (Rust files: entry.rs, error.rs, etc.)
>
> Also include:
> - Detailed explanation of the system (technical but clear)
> - Why this is advanced (highlight: on-chain validation, type script logic, multi-cell validation, state transition enforcement)
> - How transaction validation works end-to-end
> - How off-chain + on-chain interact
>
> Important:
> - Do NOT make generic template
> - Make it look like real production-grade blockchain project
> - Clean GitHub-ready format

---

## Outputs Generated from This Prompt

| File | Description |
|------|-------------|
| `src/main.rs` | `no_std` + `no_main` binary entry with `default_alloc!` and `entry!` macros |
| `src/lib.rs` | Library root exposing all modules for off-chain testing |
| `src/entry.rs` | 294-line core validation engine with CREATE/UPDATE/DESTROY mode handlers |
| `src/error.rs` | Error enum with 16 variants, stable negative i8 exit codes, `From<SysError>` impl |
| `src/cell_data.rs` | 300-line binary parser with 9 unit tests covering all parse/hash/flags paths |
| `src/hash.rs` | 186-line pure Rust SHA-256 with NIST FIPS 180-4 test vectors |
| `tests/src/ckbfs_tests.rs` | 368-line off-chain simulation test suite (8 test cases) |
| `Cargo.toml` | Manifest with `ckb-std`, `ckb-testtool`, `native-simulator` feature |
| `capsule.toml` | Capsule project config for RISC-V reproducible builds |
| `deployment.toml` | Testnet deployment descriptor |
| `ARCHITECTURE.md` | 14-section deep technical design document |
| `CHANGELOG.md` | Keep-a-Changelog format version history |
| `LICENSE` | MIT License |
| `.github/workflows/ci.yml` | 4-job CI pipeline (lint, RISC-V build, simulation tests, audit) |
| `docs/validation-flow.md` | Step-by-step validation rule walkthrough |
| `docs/transaction-lifecycle.md` | End-to-end transaction flow from Lumos to VM |
| `docs/week3-lumos-plan.md` | Detailed Week 3 implementation plan |
| `prompts/01_initial_idea_prompt.md` | This archive |
| `prompts/02_upgrade_prompt.md` | Validation rule design session |
| `prompts/03_structure_prompt.md` | This document |
| `outputs/` | Exported copies of all Rust source artifacts |

---

## Total Lines of Code Generated

| Module | Lines |
|--------|-------|
| `entry.rs` | 294 |
| `cell_data.rs` | 300 |
| `hash.rs` | 186 |
| `error.rs` | 100 |
| `main.rs` | 42 |
| `lib.rs` | 25 |
| `tests/ckbfs_tests.rs` | 368 |
| **Total** | **1,315** |

---

## Why This Is Advanced

### 1. On-Chain Validation
All validation runs inside the CKB RISC-V VM — not on a server, not in a client. The Type Script binary is the single source of truth. There is no upgrade path that bypasses it. No admin key. No oracle.

### 2. Type Script State Machine
The script implements a full lifecycle state machine: CREATE → UPDATE* → DESTROY. Each transition has explicit pre-conditions enforced at the VM level. Attempting a forbidden transition returns a specific negative exit code that is surfaced to the submitter.

### 3. Multi-Cell Group Validation
CKB's script group model lets a single script execution validate multiple cells atomically. CKBFS uses this to enforce cross-chunk rules: no duplicate chunk_index, consistent total_chunks, and contiguous chunk sets when finalized. This cannot be faked — all cells sharing the same args are validated in the same pass.

### 4. State Transition Enforcement
`FLAG_IMMUTABLE` creates a one-way ratchet: once set, the cell can never be modified again. The only exit is destruction (which still requires owner authorization). This is enforced by the on-chain script — there is no off-chain workaround.
