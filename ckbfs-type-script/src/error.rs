/// error.rs — CKBFS Type Script Error Codes
///
/// Each error variant maps to a unique negative exit code that CKB surfaces
/// in transaction validation failures. The CKB VM treats any non-zero exit
/// code from a script as a failure; by convention scripts use negative i8
/// values so they don't collide with system error codes.
///
/// Range mapping: variant discriminant `N` → exit code `-N`

// In no_std without libc, the prelude is not auto-imported.
#[allow(unused_imports)]
use core::prelude::rust_2021::*;

use ckb_std::error::SysError;

/// All errors the CKBFS Type Script can produce.
#[repr(i8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    // ── System / CKB SDK errors (1–9) ──────────────────────────────────────
    IndexOutOfBound = 1,
    ItemMissing = 2,
    LengthNotEnough = 3,
    Encoding = 4,

    // ── Data structure / parsing errors (10–19) ────────────────────────────
    /// Cell data is shorter than the minimum required header (42 bytes).
    DataTooShort = 10,
    /// The version byte in cell data is not `0x01`.
    UnsupportedVersion = 11,
    /// `chunk_index` is ≥ `total_chunks` — chunk numbering is out of range.
    InvalidChunkIndex = 12,
    /// `total_chunks` is 0 — a file must have at least one chunk.
    ZeroTotalChunks = 13,

    // ── Type Script args errors (20–29) ────────────────────────────────────
    /// The Type Script args are not exactly 64 bytes.
    InvalidArgsLength = 20,

    // ── Hash / integrity errors (30–39) ───────────────────────────────────
    /// SHA-256 of the content payload does not match the embedded hash field.
    HashMismatch = 30,

    // ── State transition / update errors (40–49) ──────────────────────────
    /// The `file_id` changed between input and output cell — not allowed.
    FileIdMismatch = 40,
    /// The `owner_lock_hash` changed between input and output — not allowed.
    OwnerLockHashMismatch = 41,
    /// The `chunk_index` changed between input and output — not allowed.
    ChunkIndexChanged = 42,
    /// The `total_chunks` changed between input and output — not allowed.
    TotalChunksChanged = 43,
    /// An attempt was made to update an immutable cell (flags bit 0 is set).
    ImmutableCell = 44,
    /// The version byte changed between input and output.
    VersionChanged = 45,

    // ── Destruction / ownership errors (50–59) ────────────────────────────
    /// No input cell in the transaction has a lock script hash matching
    /// `owner_lock_hash` — the owner did not authorize destruction.
    UnauthorizedDestruction = 50,

    // ── Group integrity errors (60–69) ────────────────────────────────────
    /// Two CKBFS cells in the same transaction group share the same
    /// `chunk_index` — chunk indexes within a file_id must be unique.
    DuplicateChunkIndex = 60,
    /// When a file is marked `finalized` the chunk set must be contiguous
    /// starting from 0, but gaps were detected.
    NonContiguousChunks = 61,

    // ── Internal / unexpected errors ───────────────────────────────────────
    /// An unexpected internal error (should never happen in production).
    Internal = 100,
}

/// Convert an Error into a negative i8 exit code for the CKB VM.
///
/// CKB convention: script errors use negative exit codes to distinguish
/// them from VM/system errors (which are positive).
impl From<Error> for i8 {
    fn from(err: Error) -> i8 {
        // Safety: all variants have explicit discriminants fitting in i8.
        // We negate to produce negative exit codes.
        (err as i8).wrapping_neg()
    }
}

/// Allow propagating ckb-std SysErrors through our Error type via `?`.
impl From<SysError> for Error {
    fn from(err: SysError) -> Self {
        match err {
            SysError::IndexOutOfBound => Error::IndexOutOfBound,
            SysError::ItemMissing => Error::ItemMissing,
            SysError::LengthNotEnough(_) => Error::LengthNotEnough,
            SysError::Encoding => Error::Encoding,
            // Catch-all for Unknown and any new variants added in later ckb-std releases
            _ => Error::Internal,
        }
    }
}
