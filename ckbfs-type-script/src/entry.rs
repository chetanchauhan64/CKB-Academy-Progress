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
    // Keep the raw_data() value alive long enough for the borrow to be valid
    let raw_data = args.raw_data();
    let args_bytes: &[u8] = raw_data.as_ref();
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

/// CREATION mode: validate all output cells.
///
/// Called when there are no input cells with this Type Script.
/// Enforces rules C1–C6.
fn validate_creation(output_data: &[Vec<u8>]) -> Result<(), Error> {
    let mut seen_chunk_indexes: Vec<u32> = Vec::new();
    let mut total_chunks_ref: Option<u32> = None;

    for raw in output_data {
        // C1 + C2 + C3: parse enforces MIN_DATA_SIZE, version, chunk_index range
        let cell = parse(raw)?;

        // C4: hash integrity — SHA-256(content) must match stored hash
        verify_hash(&cell)?;

        // C5: no duplicate chunk_index values in this output group
        if seen_chunk_indexes.contains(&cell.chunk_index) {
            return Err(Error::DuplicateChunkIndex);
        }
        seen_chunk_indexes.push(cell.chunk_index);

        // Enforce consistency: all cells in the group share the same total_chunks
        match total_chunks_ref {
            None => total_chunks_ref = Some(cell.total_chunks),
            Some(ref_count) if cell.total_chunks != ref_count => {
                return Err(Error::TotalChunksChanged);
            }
            _ => {}
        }
    }

    // C6: finalization check — if any output cell is finalized, verify contiguity
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

/// UPDATE mode: validate input→output state transitions.
///
/// Called when both input and output cells exist in this script group.
/// Enforces rules U1–U8.
///
/// Pairing strategy: match each output to the input with the same chunk_index.
/// This allows reordering in the transaction while enforcing 1:1 correspondence.
fn validate_update(input_data: &[Vec<u8>], output_data: &[Vec<u8>]) -> Result<(), Error> {
    // Parse all inputs (C1–C3 applied implicitly)
    let inputs: Vec<_> = input_data
        .iter()
        .map(|raw| parse(raw))
        .collect::<Result<_, _>>()?;

    // Parse all outputs (U1 = C1–C3 applied to outputs)
    let outputs: Vec<_> = output_data
        .iter()
        .map(|raw| parse(raw))
        .collect::<Result<_, _>>()?;

    // Counts must match: a pure update is a 1:1 replacement
    if inputs.len() != outputs.len() {
        return Err(Error::Internal);
    }

    // Track seen chunk_indexes in outputs for duplicate detection
    let mut seen_output_chunks: Vec<u32> = Vec::new();

    for output_cell in &outputs {
        // U1 / C4: verify the output cell's hash
        verify_hash(output_cell)?;

        // C5: no duplicate chunk_index in outputs
        if seen_output_chunks.contains(&output_cell.chunk_index) {
            return Err(Error::DuplicateChunkIndex);
        }
        seen_output_chunks.push(output_cell.chunk_index);

        // U2: find the matching input by chunk_index
        // (chunk_index cannot change during update — this is enforced by the match itself)
        let input_cell = inputs
            .iter()
            .find(|i| i.chunk_index == output_cell.chunk_index)
            .ok_or(Error::ChunkIndexChanged)?;

        // U4: total_chunks must be identical
        if input_cell.total_chunks != output_cell.total_chunks {
            return Err(Error::TotalChunksChanged);
        }

        // U5: version must be identical (no downgrade)
        if input_cell.version != output_cell.version {
            return Err(Error::VersionChanged);
        }

        // U8: if input cell is IMMUTABLE → reject all updates to it
        if input_cell.is_immutable() {
            return Err(Error::ImmutableCell);
        }
    }

    // Ensure every input has a corresponding output (no silent partial destruction)
    for input_cell in &inputs {
        if !seen_output_chunks.contains(&input_cell.chunk_index) {
            return Err(Error::ChunkIndexChanged);
        }
    }

    Ok(())
}

/// DESTRUCTION mode: verify the owner authorized this transaction.
///
/// Called when input cells exist but no output cells carry this Type Script.
/// Enforces rule D1.
///
/// Strategy: iterate ALL inputs in the transaction (not just the group) and
/// check if any input's lock script hash matches `owner_lock_hash` from args.
///
/// Why this works:
///   CKB guarantees lock scripts execute before type scripts. If the owner's
///   cell is present in inputs, their lock script already ran and verified the
///   signature. Our script just confirms the authorized party is present.
fn validate_destruction(owner_lock_hash: [u8; 32]) -> Result<(), Error> {
    // Iterate over ALL inputs in the transaction (Source::Input, not GroupInput)
    // because the owner's identity cell may carry a different type script.
    //
    // QueryIter panics on non-IndexOutOfBound errors; for our use case that's
    // acceptable — a syscall failure here would be a severe VM error anyway.
    let authorized = QueryIter::new(load_cell_lock_hash, Source::Input)
        .any(|lock_hash| lock_hash == owner_lock_hash);

    if !authorized {
        return Err(Error::UnauthorizedDestruction);
    }

    Ok(())
}

// ── Helper Functions ──────────────────────────────────────────────────────────

/// Load the raw `data` field of every cell in a script group source.
///
/// Uses `QueryIter` which automatically stops when `IndexOutOfBound` is returned,
/// giving us the clean iteration idiom that CKB-std recommends.
///
/// Returns an empty Vec if there are no cells in this group/source.
fn collect_group_data(source: Source) -> Result<Vec<Vec<u8>>, Error> {
    // QueryIter::new(load_cell_data, source) yields Vec<u8> for each cell.
    // On non-IndexOutOfBound errors it panics (by design in ckb-std 1.x).
    // We collect all results into a Vec.
    let cells: Vec<Vec<u8>> = QueryIter::new(load_cell_data, source).collect();
    Ok(cells)
}

/// Verify that a set of chunk_index values is contiguous from 0 to total-1.
///
/// Called when FLAG_FINALIZED is set to ensure the complete file is on-chain.
/// A finalized file must have ALL chunks present in this transaction.
fn validate_chunk_contiguity(chunk_indexes: &[u32], total_chunks: u32) -> Result<(), Error> {
    if chunk_indexes.len() as u32 != total_chunks {
        return Err(Error::NonContiguousChunks);
    }
    // Verify every expected index [0, total_chunks) is present
    for expected in 0..total_chunks {
        if !chunk_indexes.contains(&expected) {
            return Err(Error::NonContiguousChunks);
        }
    }
    Ok(())
}
