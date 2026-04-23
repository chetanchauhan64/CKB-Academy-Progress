/// main.rs — CKBFS Type Script Binary Entry Point (no_std / RISC-V)
#![no_std]
#![no_main]

extern crate alloc;

mod cell_data;
mod entry;
mod error;
mod hash;

use ckb_std::default_alloc;
default_alloc!();

ckb_std::entry!(program_entry);

use error::Error;

fn program_entry() -> i8 {
    match entry::main() {
        Ok(_) => 0,
        Err(e) => i8::from(e),
    }
}
