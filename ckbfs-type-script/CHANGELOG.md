# Changelog

All notable changes to CKBFS (CKB File Storage System) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Lumos-based TypeScript transaction builder (Week 3)
- Multi-file indexing strategy via CKB Indexer
- Upgradeable script pattern (Type ID integration)
- CLI tool for file upload / retrieval

---

## [0.2.0] — 2026-04-22 (Week 2)

### Added
- **`src/entry.rs`** — Full Type Script validation logic with three execution modes:
  - `CREATION` — validates new file cells (rules C1–C6)
  - `UPDATE` — enforces state transition invariants (rules U1–U8)
  - `DESTRUCTION` — verifies owner authorization via lock script (rule D1)
- **`src/cell_data.rs`** — Binary header parser for the 42-byte CKBFS cell format
  - `parse()`: validates version, chunk_index range, and total_chunks
  - `verify_hash()`: SHA-256 integrity check on cell content
  - `parse_args()`: extracts `owner_lock_hash` + `file_id` from 64-byte args
- **`src/hash.rs`** — Pure Rust SHA-256 implementation (no_std, no external crates)
  - FIPS 180-4 compliant; verified against NIST test vectors
- **`src/error.rs`** — Exhaustive `Error` enum with stable negative i8 exit codes
  - Range-grouped: parsing (10–19), args (20–29), hash (30–39), state (40–49), destruction (50–59), group (60–69)
- **`src/lib.rs`** — Library root exposing all modules for off-chain test access
- **`src/main.rs`** — `no_std` / `no_main` binary entry with `default_alloc!` and `entry!` macros
- **`tests/src/ckbfs_tests.rs`** — 7 off-chain simulation tests using `ckb-testtool`:
  - `test_creation_single_chunk_valid`
  - `test_creation_multi_chunk_valid`
  - `test_creation_hash_mismatch_rejected`
  - `test_creation_duplicate_chunk_index_rejected`
  - `test_update_valid`
  - `test_update_immutable_rejected`
  - `test_destruction_by_owner_valid`
  - `test_destruction_without_owner_rejected`
- **`capsule.toml`** — Capsule project configuration for RISC-V build & deployment
- **`deployment.toml`** — Testnet deployment descriptor
- **`ARCHITECTURE.md`** — Deep technical design documentation
- **`docs/`** — Extended documentation suite
  - `validation-flow.md` — Step-by-step rule enforcement guide
  - `transaction-lifecycle.md` — End-to-end TX flow from Lumos to VM
  - `week3-lumos-plan.md` — Week 3 implementation roadmap
- **`prompts/`** — AI-assisted development prompt archive
- **`outputs/`** — Exported source artifacts for review and submission
- **`.github/workflows/ci.yml`** — GitHub Actions CI pipeline (check + test)

### Changed
- `Cargo.toml`: added `ckb-testtool = "0.13"` as dev-dependency; added `native-simulator` feature

### Security
- All cell updates are blocked if `FLAG_IMMUTABLE` is set on the input cell
- SHA-256 content integrity is enforced on every CREATE and UPDATE
- Destruction requires proof of ownership via lock script hash comparison

---

## [0.1.0] — 2026-04-15 (Week 1)

### Added
- Initial project scaffold via `cargo new`
- Basic CKB testnet interaction (live cell fetching, simple transaction construction)
- `Cargo.toml` with `ckb-std` dependency
- Placeholder `src/main.rs`
