#![no_std]
/// lib.rs — CKBFS Type Script Library Root
///
/// Exposes all modules for off-chain testing and provides the common prelude
/// for the no_std RISC-V CKB environment.

extern crate alloc;

pub mod cell_data;
pub mod entry;
pub mod error;
pub mod hash;

/// Common prelude for internal use within this crate.
///
/// In no_std + no libc mode, the Rust prelude is not automatically injected.
/// Each module that needs Result, Ok, Err, Some, None etc. must either import
/// this prelude module or import `core::prelude::rust_2021::*` directly.
pub mod prelude {
    pub use core::prelude::rust_2021::*;
    pub use alloc::vec::Vec;
    pub use alloc::vec;
}
