// main.rs — CKBFS Type Script Binary Entry Point
//
// Sets up the no_std CKB RISC-V execution environment:
//   1. Installs the buddy heap allocator (via ckb-std's `default_alloc!`).
//   2. Registers the entry point via `ckb_std::entry!`.
//   3. Calls core validation logic in `entry::main()`.
//   4. Converts any Error into a negative i8 exit code for the VM.
//
// NOTE: #![no_std] and #![no_main] must be the very first items in the file.
// NOTE: Do NOT declare `extern crate alloc` here — `ckb_std::entry!` does it
//       internally and a second declaration causes E0259.

#![no_std]
#![no_main]

mod cell_data;
mod entry;
mod error;
mod hash;

// Install the default heap allocator (buddy allocator from ckb-std).
// This enables Vec, Box, etc. in the no_std environment.
use ckb_std::default_alloc;
default_alloc!();

// Register program_entry as the script's main function.
// The `entry!` macro generates a `_start` symbol, declares `extern crate alloc`,
// calls `program_entry()`, and passes the i8 return value to the CKB VM.
ckb_std::entry!(program_entry);

// Primary entry point invoked by the CKB `entry!` macro.
// Returns 0 on validation success, or a negative error code on failure.
fn program_entry() -> i8 {
    match entry::main() {
        Ok(_) => 0,
        Err(e) => {
            let code: i8 = e.into();
            code
        }
    }
}
