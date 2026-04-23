/// ckbfs_tests.rs — Off-chain Simulation Tests for the CKBFS Type Script
///
/// These tests use `ckb-testtool` to build mock transactions and verify that
/// the Type Script accepts valid transactions and rejects invalid ones without
/// having to deploy to testnet.
///
/// Run with:
///   cargo test --features simulator

#[cfg(test)]
mod tests {
    use super::*;
    use ckb_testtool::{
        ckb_types::{
            bytes::Bytes,
            core::TransactionBuilder,
            packed::*,
            prelude::*,
        },
        context::Context,
    };

    use ckbfs_type_script::{cell_data, hash::sha256};

    // ── Helpers ───────────────────────────────────────────────────────────────

    const CURRENT_VERSION: u8 = 0x01;
    const FLAG_IMMUTABLE: u8 = 0b0000_0001;
    const FLAG_FINALIZED: u8 = 0b0000_0010;

    /// Build CKBFS cell data bytes for testing.
    fn build_cell_data(
        version: u8,
        flags: u8,
        chunk_index: u32,
        total_chunks: u32,
        content: &[u8],
    ) -> Bytes {
        let hash = sha256(content);
        let mut data = vec![version, flags];
        data.extend_from_slice(&chunk_index.to_le_bytes());
        data.extend_from_slice(&total_chunks.to_le_bytes());
        data.extend_from_slice(&hash);
        data.extend_from_slice(content);
        Bytes::from(data)
    }

    /// Build corrupted cell data with wrong hash (for rejection tests).
    fn build_cell_data_bad_hash(
        version: u8,
        flags: u8,
        chunk_index: u32,
        total_chunks: u32,
        content: &[u8],
    ) -> Bytes {
        let mut hash = sha256(content);
        hash[0] ^= 0xFF; // corrupt first byte
        let mut data = vec![version, flags];
        data.extend_from_slice(&chunk_index.to_le_bytes());
        data.extend_from_slice(&total_chunks.to_le_bytes());
        data.extend_from_slice(&hash);
        data.extend_from_slice(content);
        Bytes::from(data)
    }

    /// Build 64-byte Type Script args from owner_lock_hash and file_id.
    fn build_args(owner_lock_hash: [u8; 32], file_id: [u8; 32]) -> Bytes {
        let mut args = vec![];
        args.extend_from_slice(&owner_lock_hash);
        args.extend_from_slice(&file_id);
        Bytes::from(args)
    }

    // ── Tests: Creation Mode ──────────────────────────────────────────────────

    /// ✅ A valid single-chunk file creation should succeed.
    #[test]
    fn test_creation_single_chunk_valid() {
        let mut context = Context::default();

        // Deploy the type script binary
        let type_script_bin = include_bytes!("../../target/riscv64imac-unknown-none-elf/debug/ckbfs-type-script");
        let type_script_out_point = context.deploy_cell(Bytes::from(type_script_bin.as_ref()));

        let owner_lock_hash = [0xAAu8; 32];
        let file_id = [0x01u8; 32];
        let args = build_args(owner_lock_hash, file_id);

        let type_script = context
            .build_script(&type_script_out_point, args)
            .expect("script");

        let content = b"Hello, CKBFS! This is chunk 0 of 1.";
        let cell_data = build_cell_data(CURRENT_VERSION, 0, 0, 1, content);

        // Build output cell with our type script
        let output = CellOutputBuilder::default()
            .capacity(1000u64.pack())
            .type_(Some(type_script).pack())
            .build();

        // No inputs carry this type script → CREATION mode
        let tx = TransactionBuilder::default()
            .output(output)
            .output_data(cell_data.pack())
            .build();

        let tx = context.complete_tx(tx);
        let result = context.verify_tx(&tx, u64::MAX);
        assert!(result.is_ok(), "Expected success, got: {:?}", result);
    }

    /// ✅ A valid multi-chunk file creation (3 chunks) should succeed.
    #[test]
    fn test_creation_multi_chunk_valid() {
        let mut context = Context::default();
        let type_script_bin = include_bytes!("../../target/riscv64imac-unknown-none-elf/debug/ckbfs-type-script");
        let type_script_out_point = context.deploy_cell(Bytes::from(type_script_bin.as_ref()));

        let owner_lock_hash = [0xBBu8; 32];
        let file_id = [0x02u8; 32];
        let args = build_args(owner_lock_hash, file_id);
        let type_script = context.build_script(&type_script_out_point, args).unwrap();

        let chunks = [b"chunk 0 data".as_ref(), b"chunk 1 data", b"chunk 2 data"];
        let mut outputs = vec![];
        let mut outputs_data = vec![];

        for (i, &chunk) in chunks.iter().enumerate() {
            outputs.push(
                CellOutputBuilder::default()
                    .capacity(1000u64.pack())
                    .type_(Some(type_script.clone()).pack())
                    .build(),
            );
            outputs_data.push(build_cell_data(CURRENT_VERSION, 0, i as u32, 3, chunk));
        }

        let tx = TransactionBuilder::default()
            .outputs(outputs)
            .outputs_data(outputs_data.into_iter().map(|d| d.pack()).collect::<Vec<_>>())
            .build();

        let tx = context.complete_tx(tx);
        let result = context.verify_tx(&tx, u64::MAX);
        assert!(result.is_ok(), "Multi-chunk creation failed: {:?}", result);
    }

    /// ❌ Creation with hash mismatch should fail with HashMismatch error.
    #[test]
    fn test_creation_hash_mismatch_rejected() {
        let mut context = Context::default();
        let type_script_bin = include_bytes!("../../target/riscv64imac-unknown-none-elf/debug/ckbfs-type-script");
        let type_script_out_point = context.deploy_cell(Bytes::from(type_script_bin.as_ref()));

        let args = build_args([0xCCu8; 32], [0x03u8; 32]);
        let type_script = context.build_script(&type_script_out_point, args).unwrap();

        // Use deliberately wrong hash
        let bad_data = build_cell_data_bad_hash(CURRENT_VERSION, 0, 0, 1, b"real content");

        let output = CellOutputBuilder::default()
            .capacity(1000u64.pack())
            .type_(Some(type_script).pack())
            .build();

        let tx = TransactionBuilder::default()
            .output(output)
            .output_data(bad_data.pack())
            .build();

        let tx = context.complete_tx(tx);
        let result = context.verify_tx(&tx, u64::MAX);
        assert!(result.is_err(), "Expected hash mismatch rejection");
        // Error code for HashMismatch = -30
        assert_eq!(result.unwrap_err().to_string().contains("-30"), true);
    }

    /// ❌ Creation with duplicate chunk_index should fail.
    #[test]
    fn test_creation_duplicate_chunk_index_rejected() {
        let mut context = Context::default();
        let type_script_bin = include_bytes!("../../target/riscv64imac-unknown-none-elf/debug/ckbfs-type-script");
        let type_script_out_point = context.deploy_cell(Bytes::from(type_script_bin.as_ref()));

        let args = build_args([0xDDu8; 32], [0x04u8; 32]);
        let type_script = context.build_script(&type_script_out_point, args).unwrap();

        // Two outputs both claiming chunk_index = 0
        let data0 = build_cell_data(CURRENT_VERSION, 0, 0, 2, b"chunk 0");
        let data1 = build_cell_data(CURRENT_VERSION, 0, 0, 2, b"also chunk 0"); // duplicate!

        let output = CellOutputBuilder::default()
            .capacity(1000u64.pack())
            .type_(Some(type_script.clone()).pack())
            .build();

        let tx = TransactionBuilder::default()
            .outputs(vec![output.clone(), output])
            .outputs_data(vec![data0.pack(), data1.pack()])
            .build();

        let tx = context.complete_tx(tx);
        let result = context.verify_tx(&tx, u64::MAX);
        assert!(result.is_err(), "Expected duplicate chunk rejection");
    }

    // ── Tests: Update Mode ────────────────────────────────────────────────────

    /// ✅ A valid content update (same chunk_index, new content + valid hash) succeeds.
    #[test]
    fn test_update_valid() {
        let mut context = Context::default();
        let type_script_bin = include_bytes!("../../target/riscv64imac-unknown-none-elf/debug/ckbfs-type-script");
        let type_script_out_point = context.deploy_cell(Bytes::from(type_script_bin.as_ref()));

        let args = build_args([0xEEu8; 32], [0x05u8; 32]);
        let type_script = context.build_script(&type_script_out_point, args).unwrap();

        // Input cell (existing on-chain file content)
        let input_data = build_cell_data(CURRENT_VERSION, 0, 0, 1, b"original content");
        let input_cell = CellOutputBuilder::default()
            .capacity(1000u64.pack())
            .type_(Some(type_script.clone()).pack())
            .build();

        let input_out_point = context.create_cell(input_cell, input_data);

        // Output cell (updated content)
        let output_data = build_cell_data(CURRENT_VERSION, 0, 0, 1, b"updated content v2");
        let output_cell = CellOutputBuilder::default()
            .capacity(1000u64.pack())
            .type_(Some(type_script).pack())
            .build();

        let tx = TransactionBuilder::default()
            .input(CellInput::new(input_out_point, 0))
            .output(output_cell)
            .output_data(output_data.pack())
            .build();

        let tx = context.complete_tx(tx);
        let result = context.verify_tx(&tx, u64::MAX);
        assert!(result.is_ok(), "Valid update should succeed: {:?}", result);
    }

    /// ❌ Updating an immutable cell must be rejected.
    #[test]
    fn test_update_immutable_rejected() {
        let mut context = Context::default();
        let type_script_bin = include_bytes!("../../target/riscv64imac-unknown-none-elf/debug/ckbfs-type-script");
        let type_script_out_point = context.deploy_cell(Bytes::from(type_script_bin.as_ref()));

        let args = build_args([0xFFu8; 32], [0x06u8; 32]);
        let type_script = context.build_script(&type_script_out_point, args).unwrap();

        // Input cell with FLAG_IMMUTABLE set
        let input_data = build_cell_data(CURRENT_VERSION, FLAG_IMMUTABLE, 0, 1, b"immutable data");
        let input_cell = CellOutputBuilder::default()
            .capacity(1000u64.pack())
            .type_(Some(type_script.clone()).pack())
            .build();

        let input_out_point = context.create_cell(input_cell, input_data);

        // Attempt to update it
        let output_data = build_cell_data(CURRENT_VERSION, 0, 0, 1, b"trying to change immutable");
        let output_cell = CellOutputBuilder::default()
            .capacity(1000u64.pack())
            .type_(Some(type_script).pack())
            .build();

        let tx = TransactionBuilder::default()
            .input(CellInput::new(input_out_point, 0))
            .output(output_cell)
            .output_data(output_data.pack())
            .build();

        let tx = context.complete_tx(tx);
        let result = context.verify_tx(&tx, u64::MAX);
        assert!(result.is_err(), "Immutable cell update should be rejected");
    }

    // ── Tests: Destruction Mode ───────────────────────────────────────────────

    /// ✅ Destruction with owner's lock script in inputs should succeed.
    #[test]
    fn test_destruction_by_owner_valid() {
        let mut context = Context::default();
        let type_script_bin = include_bytes!("../../target/riscv64imac-unknown-none-elf/debug/ckbfs-type-script");
        let type_script_out_point = context.deploy_cell(Bytes::from(type_script_bin.as_ref()));

        // Build owner lock script
        let owner_lock = context.build_script(&type_script_out_point, Bytes::new()).unwrap();
        let owner_lock_hash: [u8; 32] = owner_lock.calc_script_hash().unpack();

        let args = build_args(owner_lock_hash, [0x07u8; 32]);
        let type_script = context.build_script(&type_script_out_point, args).unwrap();

        // Input cell (the file cell to destroy)
        let cell_data = build_cell_data(CURRENT_VERSION, 0, 0, 1, b"file to delete");
        let file_cell = CellOutputBuilder::default()
            .capacity(1000u64.pack())
            .type_(Some(type_script).pack())
            .build();
        let file_out_point = context.create_cell(file_cell, cell_data);

        // Owner cell — its presence in inputs proves ownership
        let owner_cell = CellOutputBuilder::default()
            .capacity(500u64.pack())
            .lock(owner_lock)
            .build();
        let owner_out_point = context.create_cell(owner_cell, Bytes::new());

        // Transaction: spend both — no CKBFS type outputs (pure destruction)
        let tx = TransactionBuilder::default()
            .inputs(vec![
                CellInput::new(file_out_point, 0),
                CellInput::new(owner_out_point, 0),
            ])
            .output(
                CellOutputBuilder::default()
                    .capacity(1500u64.pack())
                    .build(),
            )
            .output_data(Bytes::new().pack())
            .build();

        let tx = context.complete_tx(tx);
        let result = context.verify_tx(&tx, u64::MAX);
        assert!(result.is_ok(), "Owner-authorized destruction should succeed: {:?}", result);
    }

    /// ❌ Destruction without owner's lock script should fail.
    #[test]
    fn test_destruction_without_owner_rejected() {
        let mut context = Context::default();
        let type_script_bin = include_bytes!("../../target/riscv64imac-unknown-none-elf/debug/ckbfs-type-script");
        let type_script_out_point = context.deploy_cell(Bytes::from(type_script_bin.as_ref()));

        let owner_lock_hash = [0xAAu8; 32]; // owner's lock hash — not in inputs
        let args = build_args(owner_lock_hash, [0x08u8; 32]);
        let type_script = context.build_script(&type_script_out_point, args).unwrap();

        let cell_data = build_cell_data(CURRENT_VERSION, 0, 0, 1, b"file to steal");
        let file_cell = CellOutputBuilder::default()
            .capacity(1000u64.pack())
            .type_(Some(type_script).pack())
            .build();
        let file_out_point = context.create_cell(file_cell, cell_data);

        // Transaction WITHOUT the owner cell — should be rejected
        let tx = TransactionBuilder::default()
            .input(CellInput::new(file_out_point, 0))
            .output(
                CellOutputBuilder::default()
                    .capacity(1000u64.pack())
                    .build(),
            )
            .output_data(Bytes::new().pack())
            .build();

        let tx = context.complete_tx(tx);
        let result = context.verify_tx(&tx, u64::MAX);
        assert!(result.is_err(), "Unauthorized destruction should be rejected");
    }
}
