/// cell_data.rs — CKBFS Cell Data Parser and Validator
///
/// Parses and validates the binary layout of a CKBFS cell's `data` field.
///
/// Layout (multi-byte integers are little-endian):
/// ┌──────────┬────────┬─────────────┬──────────────┬─────────────┬────────────┐
/// │ version  │ flags  │ chunk_index │ total_chunks │ sha256_hash │  content   │
/// │  1 byte  │ 1 byte │   4 bytes   │   4 bytes    │  32 bytes   │  variable  │
/// └──────────┴────────┴─────────────┴──────────────┴─────────────┴────────────┘
/// Total header: 42 bytes. Content length: data.len() - 42.

#[allow(unused_imports)]
use core::prelude::rust_2021::*;

use crate::error::Error;
use crate::hash::sha256;

/// Minimum cell data length: 1 (version) + 1 (flags) + 4 (chunk_index)
/// + 4 (total_chunks) + 32 (sha256) = 42 bytes.
/// Content may be empty (0 bytes) for metadata-only cells.
pub const MIN_DATA_SIZE: usize = 42;

/// The only version byte this script version supports.
pub const CURRENT_VERSION: u8 = 0x01;

/// Bit 0 of flags: if set, this cell cannot be modified (immutable).
pub const FLAG_IMMUTABLE: u8 = 0b0000_0001;

/// Bit 1 of flags: if set, all chunks of this file are present in-chain (finalized).
pub const FLAG_FINALIZED: u8 = 0b0000_0010;

// Byte offsets within cell data
const OFFSET_VERSION: usize = 0;
const OFFSET_FLAGS: usize = 1;
const OFFSET_CHUNK_INDEX: usize = 2;
const OFFSET_TOTAL_CHUNKS: usize = 6;
const OFFSET_SHA256: usize = 10;
const OFFSET_CONTENT: usize = 42;

/// A parsed, validated representation of a CKBFS cell's data field.
///
/// Borrows content bytes from the underlying slice — zero allocation.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CkbfsData<'a> {
    /// Schema version — always `0x01` for this implementation.
    pub version: u8,
    /// Flags byte. Use `FLAG_IMMUTABLE` and `FLAG_FINALIZED` bit masks.
    pub flags: u8,
    /// Zero-based index of this chunk within the file.
    pub chunk_index: u32,
    /// Total number of chunks for this file.
    pub total_chunks: u32,
    /// The SHA-256 hash of the content payload embedded in the cell header.
    pub sha256_hash: [u8; 32],
    /// The raw content payload (remainder after the 42-byte header).
    pub content: &'a [u8],
}

impl<'a> CkbfsData<'a> {
    /// Returns `true` if this cell is marked immutable (cannot be updated).
    #[inline]
    pub fn is_immutable(&self) -> bool {
        self.flags & FLAG_IMMUTABLE != 0
    }

    /// Returns `true` if the file is fully stored on-chain (all chunks present).
    #[inline]
    pub fn is_finalized(&self) -> bool {
        self.flags & FLAG_FINALIZED != 0
    }
}

/// Parse raw cell data bytes into a `CkbfsData` struct.
///
/// Validates: minimum length, version byte, chunk_index range, total_chunks > 0.
/// Does NOT verify the SHA-256 hash — call `verify_hash()` separately.
///
/// # Errors
/// - `DataTooShort`       — data.len() < 42
/// - `UnsupportedVersion` — version byte ≠ 0x01
/// - `ZeroTotalChunks`    — total_chunks == 0
/// - `InvalidChunkIndex`  — chunk_index >= total_chunks
/// - `Encoding`           — byte slice conversion failed (should never occur)
pub fn parse(data: &[u8]) -> Result<CkbfsData<'_>, Error> {
    // ── 1. Length guard ───────────────────────────────────────────────────
    if data.len() < MIN_DATA_SIZE {
        return Err(Error::DataTooShort);
    }

    // ── 2. Version check ─────────────────────────────────────────────────
    let version = data[OFFSET_VERSION];
    if version != CURRENT_VERSION {
        return Err(Error::UnsupportedVersion);
    }

    // ── 3. Flags byte (no restrictions on combinations) ───────────────────
    let flags = data[OFFSET_FLAGS];

    // ── 4. chunk_index — 4 bytes little-endian u32 ───────────────────────
    let chunk_index = u32::from_le_bytes(
        data[OFFSET_CHUNK_INDEX..OFFSET_CHUNK_INDEX + 4]
            .try_into()
            .map_err(|_| Error::Encoding)?,
    );

    // ── 5. total_chunks — 4 bytes little-endian u32 ──────────────────────
    let total_chunks = u32::from_le_bytes(
        data[OFFSET_TOTAL_CHUNKS..OFFSET_TOTAL_CHUNKS + 4]
            .try_into()
            .map_err(|_| Error::Encoding)?,
    );

    if total_chunks == 0 {
        return Err(Error::ZeroTotalChunks);
    }
    if chunk_index >= total_chunks {
        return Err(Error::InvalidChunkIndex);
    }

    // ── 6. sha256_hash — 32 bytes ─────────────────────────────────────────
    let mut sha256_hash = [0u8; 32];
    sha256_hash.copy_from_slice(&data[OFFSET_SHA256..OFFSET_SHA256 + 32]);

    // ── 7. content — all bytes after the header ───────────────────────────
    let content = &data[OFFSET_CONTENT..];

    Ok(CkbfsData {
        version,
        flags,
        chunk_index,
        total_chunks,
        sha256_hash,
        content,
    })
}

/// Verify that SHA-256(content) == the hash embedded in the cell header.
///
/// This is the core data-integrity rule (C4 / U1).
///
/// # Errors
/// - `HashMismatch` — computed hash ≠ stored hash field
pub fn verify_hash(cell: &CkbfsData<'_>) -> Result<(), Error> {
    let computed = sha256(cell.content);
    if computed != cell.sha256_hash {
        return Err(Error::HashMismatch);
    }
    Ok(())
}

/// Parse the Type Script args into (owner_lock_hash, file_id).
///
/// Args layout:
///   [0..32]  = owner_lock_hash  (Blake2b hash of owner's lock script)
///   [32..64] = file_id          (arbitrary unique file identifier)
///
/// # Errors
/// - `InvalidArgsLength` — args ≠ 64 bytes
pub fn parse_args(args: &[u8]) -> Result<([u8; 32], [u8; 32]), Error> {
    if args.len() != 64 {
        return Err(Error::InvalidArgsLength);
    }
    let mut owner_lock_hash = [0u8; 32];
    let mut file_id = [0u8; 32];
    owner_lock_hash.copy_from_slice(&args[0..32]);
    file_id.copy_from_slice(&args[32..64]);
    Ok((owner_lock_hash, file_id))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hash::sha256;

    extern crate alloc;
    use alloc::vec::Vec;

    /// Build a minimal valid cell data byte string with the given content.
    fn build_cell_data(
        version: u8,
        flags: u8,
        chunk_index: u32,
        total_chunks: u32,
        content: &[u8],
    ) -> Vec<u8> {
        let hash = sha256(content);
        let mut data = Vec::with_capacity(MIN_DATA_SIZE + content.len());
        data.push(version);
        data.push(flags);
        data.extend_from_slice(&chunk_index.to_le_bytes());
        data.extend_from_slice(&total_chunks.to_le_bytes());
        data.extend_from_slice(&hash);
        data.extend_from_slice(content);
        data
    }

    #[test]
    fn parse_valid_cell() {
        let content = b"Hello, CKBFS!";
        let raw = build_cell_data(CURRENT_VERSION, 0, 0, 1, content);
        let cell = parse(&raw).expect("should parse successfully");
        assert_eq!(cell.version, CURRENT_VERSION);
        assert_eq!(cell.chunk_index, 0);
        assert_eq!(cell.total_chunks, 1);
        assert_eq!(cell.content, content);
        verify_hash(&cell).expect("hash should match");
    }

    #[test]
    fn reject_too_short_data() {
        let raw = [0x01u8; 10]; // Only 10 bytes, need 42
        assert_eq!(parse(&raw), Err(Error::DataTooShort));
    }

    #[test]
    fn reject_wrong_version() {
        let content = b"test";
        let mut raw = build_cell_data(CURRENT_VERSION, 0, 0, 1, content);
        raw[OFFSET_VERSION] = 0x99; // corrupt version
        assert_eq!(parse(&raw), Err(Error::UnsupportedVersion));
    }

    #[test]
    fn reject_zero_total_chunks() {
        let content = b"test";
        let mut raw = build_cell_data(CURRENT_VERSION, 0, 0, 1, content);
        // Override total_chunks field to 0
        raw[OFFSET_TOTAL_CHUNKS..OFFSET_TOTAL_CHUNKS + 4]
            .copy_from_slice(&0u32.to_le_bytes());
        assert_eq!(parse(&raw), Err(Error::ZeroTotalChunks));
    }

    #[test]
    fn reject_chunk_index_out_of_range() {
        let content = b"test";
        let mut raw = build_cell_data(CURRENT_VERSION, 0, 0, 1, content);
        // Set chunk_index=5, total_chunks=3 → invalid
        raw[OFFSET_CHUNK_INDEX..OFFSET_CHUNK_INDEX + 4]
            .copy_from_slice(&5u32.to_le_bytes());
        raw[OFFSET_TOTAL_CHUNKS..OFFSET_TOTAL_CHUNKS + 4]
            .copy_from_slice(&3u32.to_le_bytes());
        assert_eq!(parse(&raw), Err(Error::InvalidChunkIndex));
    }

    #[test]
    fn reject_hash_mismatch() {
        let content = b"Hello, CKBFS!";
        let mut raw = build_cell_data(CURRENT_VERSION, 0, 0, 1, content);
        // Corrupt the last byte of content (after the 42-byte header)
        let last = raw.len() - 1;
        raw[last] ^= 0xFF;
        let cell = parse(&raw).expect("should still parse structurally");
        assert_eq!(verify_hash(&cell), Err(Error::HashMismatch));
    }

    #[test]
    fn immutable_flag_detection() {
        let content = b"immutable file";
        let raw = build_cell_data(CURRENT_VERSION, FLAG_IMMUTABLE, 0, 1, content);
        let cell = parse(&raw).expect("should parse");
        assert!(cell.is_immutable());
        assert!(!cell.is_finalized());
    }

    #[test]
    fn finalized_flag_detection() {
        let content = b"finalized file";
        let raw = build_cell_data(CURRENT_VERSION, FLAG_FINALIZED, 0, 1, content);
        let cell = parse(&raw).expect("should parse");
        assert!(!cell.is_immutable());
        assert!(cell.is_finalized());
    }

    #[test]
    fn parse_args_valid() {
        let args = [0xABu8; 64];
        let (owner, file_id) = parse_args(&args).expect("should parse args");
        assert_eq!(owner, [0xABu8; 32]);
        assert_eq!(file_id, [0xABu8; 32]);
    }

    #[test]
    fn parse_args_wrong_length() {
        let args = [0u8; 32]; // wrong: 32 bytes, need 64
        assert_eq!(parse_args(&args), Err(Error::InvalidArgsLength));
    }

    #[test]
    fn parse_args_split_correctly() {
        let mut args = [0u8; 64];
        args[..32].fill(0xAA); // owner_lock_hash
        args[32..].fill(0xBB); // file_id
        let (owner, file_id) = parse_args(&args).unwrap();
        assert_eq!(owner, [0xAAu8; 32]);
        assert_eq!(file_id, [0xBBu8; 32]);
    }
}
