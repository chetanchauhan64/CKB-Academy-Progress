/* ckb.ld — CKB Contract Linker Script
 *
 * W^X (write XOR execute) layout required by CKB VM v1 (hashType: 'data1').
 *
 * LOAD_RX (flags=0x5, R+X): .text, .rodata    — executable, NOT writable
 * LOAD_RW (flags=0x6, R+W): .data, .bss       — writable, NOT executable
 *
 * Segments must be page-aligned (0x1000 = 4KB) so no page is both R+X and R+W.
 *
 * WHY data1 / VM v1:
 *   VM v0 (data) has two conflicting requirements:
 *     - Rejects W+X segments (ElfSegmentWritableAndExecutable)
 *     - MemWriteOnExecutablePage when our code writes ARGV to a miscomputed
 *       register that ends up pointing at address 0x0 (in the R+X segment).
 *   VM v1 (data1) handles ELF loading correctly and supports W^X properly.
 *
 * Stack: CKB VM places the initial SP near top of 4 MB (0x400000).
 *        We extend LOAD_RW memsz to (4MB - RW_start) via patch_elf.py.
 */

ENTRY(_start)

PHDRS {
    LOAD_RX PT_LOAD FLAGS(0x5);   /* R + X */
    LOAD_RW PT_LOAD FLAGS(0x6);   /* R + W */
}

SECTIONS {
    . = 0;

    /* ── Executable, read-only ──────────────────────────────────────────────── */
    .text : {
        KEEP(*(.text._start))
        *(.text .text.*)
    } :LOAD_RX

    .rodata : {
        *(.rodata .rodata.*)
        *(.srodata .srodata.*)
    } :LOAD_RX

    /* ── Writeable data (page-aligned boundary) ────────────────────────────── */
    . = ALIGN(0x1000);

    .data : {
        *(.data .data.*)
        *(.sdata .sdata.*)
    } :LOAD_RW

    .bss (NOLOAD) : {
        _sbss = .;
        *(.bss .bss.*)
        *(.sbss .sbss.*)
        _ebss = .;
    } :LOAD_RW

    /* Discard toolchain metadata */
    /DISCARD/ : {
        *(.eh_frame*)
        *(.note*)
        *(.comment)
        *(.gnu*)
        *(.ARM.*)
        *(.riscv.attributes)
    }
}
