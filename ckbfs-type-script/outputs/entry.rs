/// entry.rs — CKBFS Type Script — Core Validation Logic
///
/// This is the heart of the on-chain file storage validation system.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// HOW THE CKB VM CALLS THIS SCRIPT
/// ═══════════════════════════════════════════════════════════════════════════
///
/// When a transaction is submitted to CKB, for every cell that carries this
/// Type Script (in inputs OR outputs), the VM:
///   1. Loads and executes the script binary.
///   2. Passes context via syscalls (ckb_load_*).
///   3. Expects exit code 0 = success, any non-zero = failure.
///
/// The script is executed once per script GROUP. A script group = all cells
/// in the transaction sharing the same (code_hash, hash_type, args).
/// So all CKBFS cells with the same args are validated together in one run.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// EXECUTION MODES
/// ═══════════════════════════════════════════════════════════════════════════
///
/// ┌──────────────────────────────────────────────────────────────────┐
/// │  Mode         │ Input group │ Output group │ Description         │
/// ├──────────────────────────────────────────────────────────────────┤
/// │  CREATION     │    empty    │   has cells  │ New file upload     │
/// │  UPDATE       │  has cells  │   has cells  │ Overwrite content   │
/// │  DESTRUCTION  │  has cells  │    empty     │ Delete / consume    │
/// └──────────────────────────────────────────────────────────────────┘
///
/// ═══════════════════════════════════════════════════════════════════════════
/// VALIDATION RULES SUMMARY
/// ═══════════════════════════════════════════════════════════════════════════
///
/// CREATION:
///   [C1] Each output cell data must be ≥ MIN_DATA_SIZE bytes.
///   [C2] Version must be 0x01.
///   [C3] chunk_index < total_chunks.
///   [C4] SHA-256(content) == embedded hash.
///   [C5] No duplicate chunk_index values in the same transaction group.
///   [C6] If finalized flag is set, chunk set must be contiguous 0..total_chunks-1.
///
/// UPDATE:
///   [U1] All CREATION rules apply to output cells.
///   [U2] One-to-one pairing: input[i] ↔ output[i] by chunk_index.
///   [U3] chunk_index is identical between paired input and output.
///   [U4] total_chunks is identical between paired input and output.
///   [U5] version is identical (cannot downgrade).
///   [U6] owner_lock_hash is identical in args (cannot change owner).
///   [U7] file_id is identical in args (cannot change file identity).
///   [U8] If input cell has FLAG_IMMUTABLE set → REJECT update.
///
/// DESTRUCTION:
///   [D1] At least one input cell's lock script hash == owner_lock_hash
///        from the Type Script args. This proves the owner signed.

extern crate alloc;

#[allow(unused_imports)]
use core::prelude::rust_2021::*;

use alloc::vec::Vec;
use ckb_std::{
    ckb_constants::Source,
    high_level::{load_cell_data, load_cell_lock_hash, load_script, QueryIter},
};
use ckb_types::prelude::*;

use crate::cell_data::{parse, parse_args, verify_hash};
use crate::error::Error;

// ── Public Entry Point ────────────────────────────────────────────────────────

/// Main entry function called from `main.rs`.
///
/// Returns `Ok(())` on success. The caller converts any `Err(Error)` into
/// a non-zero exit code that CKB treats as a script failure.
pub fn main() -> Result<(), Error> {
    // ── Step 1: Load this script's args ──────────────────────────────────────
    //
    // `load_script()` returns the Type Script descriptor for THIS execution.
    // The args encode [owner_lock_hash: 32B][file_id: 32B].
    let script = load_script()?;
    let args = script.args();
    // `args.raw_data()` gives a `Bytes` (molecule bytes type) → `.as_ref()` → `&[u8]`
    let args_bytes: &[u8] = args.raw_data().as_ref();
    let (owner_lock_hash, _file_id) = parse_args(args_bytes)?;

    // ── Step 2: Collect input and output cell data for THIS script group ──────
    //
    // CKB's script group mechanism scopes GroupInput/GroupOutput to cells
    // that share our exact Type Script (same code_hash + args).
    //
    // QueryIter yields items directly (panics on non-IndexOutOfBound errors).
    // We use Source::GroupInput and Source::GroupOutput to read only our group.
    let input_data: Vec<Vec<u8>> = collect_group_data(Source::GroupInput)?;
    let output_data: Vec<Vec<u8>> = collect_group_data(Source::GroupOutput)?;

    // ── Step 3: Determine execution mode ─────────────────────────────────────
    match (input_data.is_empty(), output_data.is_empty()) {
        // CREATION: no inputs, some outputs
        (true, false) => validate_creation(&output_data)?,

        // UPDATE: both inputs and outputs exist
        (false, false) => validate_update(&input_data, &output_data)?,

        // DESTRUCTION: some inputs, no outputs
        (false, true) => validate_destruction(owner_lock_hash)?,

        // Both empty: should never happen in a valid transaction
        (true, true) => return Err(Error::Internal),
    }

    Ok(())
}

// ── Mode Handlers ─────────────────────────────────────────────────────────────

fn validate_creation(output_data: &[Vec<u8>]) -> Result<(), Error> {
    let mut seen_chunk_indexes: Vec<u32> = Vec::new();
    let mut total_chunks_ref: Option<u32> = None;

    for raw in output_data {
        let cell = parse(raw)?;
        verify_hash(&cell)?;

        if seen_chunk_indexes.contains(&cell.chunk_index) {
            return Err(Error::DuplicateChunkIndex);
        }
        seen_chunk_indexes.push(cell.chunk_index);

        match total_chunks_ref {
            None => total_chunks_ref = Some(cell.total_chunks),
            Some(ref_count) if cell.total_chunks != ref_count => {
                return Err(Error::TotalChunksChanged);
            }
            _ => {}
        }
    }

    if let Some(total) = total_chunks_ref {
        let any_finalized = output_data.iter().any(|raw| {
            parse(raw).map(|c| c.is_finalized()).unwrap_or(false)
        });
        if any_finalized {
            validate_chunk_contiguity(&seen_chunk_indexes, total)?;
        }
    }

    Ok(())
}

fn validate_update(input_data: &[Vec<u8>], output_data: &[Vec<u8>]) -> Result<(), Error> {
    let inputs: Vec<_> = input_data
        .iter()
        .map(|raw| parse(raw))
        .collect::<Result<_, _>>()?;

    let outputs: Vec<_> = output_data
        .iter()
        .map(|raw| parse(raw))
        .collect::<Result<_, _>>()?;

    if inputs.len() != outputs.len() {
        return Err(Error::Internal);
    }

    let mut seen_output_chunks: Vec<u32> = Vec::new();

    for output_cell in &outputs {
        verify_hash(output_cell)?;

        if seen_output_chunks.contains(&output_cell.chunk_index) {
            return Err(Error::DuplicateChunkIndex);
        }
        seen_output_chunks.push(output_cell.chunk_index);

        let input_cell = inputs
            .iter()
            .find(|i| i.chunk_index == output_cell.chunk_index)
            .ok_or(Error::ChunkIndexChanged)?;

        if input_cell.total_chunks != output_cell.total_chunks {
            return Err(Error::TotalChunksChanged);
        }

        if input_cell.version != output_cell.version {
            return Err(Error::VersionChanged);
        }

        if input_cell.is_immutable() {
            return Err(Error::ImmutableCell);
        }
    }

    for input_cell in &inputs {
        if !seen_output_chunks.contains(&input_cell.chunk_index) {
            return Err(Error::ChunkIndexChanged);
        }
    }

    Ok(())
}

fn validate_destruction(owner_lock_hash: [u8; 32]) -> Result<(), Error> {
    let authorized = QueryIter::new(load_cell_lock_hash, Source::Input)
        .any(|lock_hash| lock_hash == owner_lock_hash);

    if !authorized {
        return Err(Error::UnauthorizedDestruction);
    }

    Ok(())
}

// ── Helper Functions ──────────────────────────────────────────────────────────

fn collect_group_data(source: Source) -> Result<Vec<Vec<u8>>, Error> {
    let cells: Vec<Vec<u8>> = QueryIter::new(load_cell_data, source).collect();
    Ok(cells)
}

fn validate_chunk_contiguity(chunk_indexes: &[u32], total_chunks: u32) -> Result<(), Error> {
    if chunk_indexes.len() as u32 != total_chunks {
        return Err(Error::NonContiguousChunks);
    }
    for expected in 0..total_chunks {
        if !chunk_indexes.contains(&expected) {
            return Err(Error::NonContiguousChunks);
        }
    }
    Ok(())
}
