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

/// Minimum cell data length: 42 bytes (full header, no content).
pub const MIN_DATA_SIZE: usize = 42;

/// The only version byte this script version supports.
pub const CURRENT_VERSION: u8 = 0x01;

/// Bit 0 of flags: if set, this cell cannot be modified (immutable).
pub const FLAG_IMMUTABLE: u8 = 0b0000_0001;

/// Bit 1 of flags: if set, all chunks of this file are present in-chain.
pub const FLAG_FINALIZED: u8 = 0b0000_0010;

// Byte offsets within cell data
const OFFSET_VERSION: usize = 0;
const OFFSET_FLAGS: usize = 1;
const OFFSET_CHUNK_INDEX: usize = 2;
const OFFSET_TOTAL_CHUNKS: usize = 6;
const OFFSET_SHA256: usize = 10;
const OFFSET_CONTENT: usize = 42;

/// A parsed, validated representation of a CKBFS cell's data field.
#[derive(Debug, Clone, Copy)]
pub struct CkbfsData<'a> {
    pub version: u8,
    pub flags: u8,
    pub chunk_index: u32,
    pub total_chunks: u32,
    pub sha256_hash: [u8; 32],
    pub content: &'a [u8],
}

impl<'a> CkbfsData<'a> {
    #[inline]
    pub fn is_immutable(&self) -> bool {
        self.flags & FLAG_IMMUTABLE != 0
    }

    #[inline]
    pub fn is_finalized(&self) -> bool {
        self.flags & FLAG_FINALIZED != 0
    }
}

/// Parse raw cell data bytes into a `CkbfsData` struct.
pub fn parse(data: &[u8]) -> Result<CkbfsData<'_>, Error> {
    if data.len() < MIN_DATA_SIZE {
        return Err(Error::DataTooShort);
    }

    let version = data[OFFSET_VERSION];
    if version != CURRENT_VERSION {
        return Err(Error::UnsupportedVersion);
    }

    let flags = data[OFFSET_FLAGS];

    let chunk_index = u32::from_le_bytes(
        data[OFFSET_CHUNK_INDEX..OFFSET_CHUNK_INDEX + 4]
            .try_into()
            .map_err(|_| Error::Encoding)?,
    );

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

    let mut sha256_hash = [0u8; 32];
    sha256_hash.copy_from_slice(&data[OFFSET_SHA256..OFFSET_SHA256 + 32]);

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

/// Verify SHA-256(content) == stored hash.
pub fn verify_hash(cell: &CkbfsData<'_>) -> Result<(), Error> {
    let computed = sha256(cell.content);
    if computed != cell.sha256_hash {
        return Err(Error::HashMismatch);
    }
    Ok(())
}

/// Parse 64-byte Type Script args into (owner_lock_hash, file_id).
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
