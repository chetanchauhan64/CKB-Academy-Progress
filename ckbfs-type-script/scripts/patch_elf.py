#!/usr/bin/env python3
"""
patch_elf.py — Post-process CKBFS binary for CKB VM compatibility

Two fixes applied:
1. PT_RISCV_ATTRIBUTES (type=0x70000003) has vaddr=0x0 — CKB VM writes its
   content to the R+X page → MemWriteOnExecutablePage. Fix: set type to PT_NULL.

2. LOAD_RW p_memsz is tiny (just the .data section). CKB VM's stack lives at
   the top of RISCV_MAX_MEMORY (4MB=0x400000). Without R+W coverage there,
   sp ends up in an unmapped or R+X page → MemWriteOnExecutablePage.
   Fix: extend LOAD_RW p_memsz to cover 4MB - LOAD_RW.vaddr.

Usage: python3 scripts/patch_elf.py build/release/ckbfs-type-script
"""
import struct
import sys

RISCV_MAX_MEMORY = 0x400000  # 4MB — ckb-vm's flat memory size

def patch_elf(path):
    with open(path, 'rb') as f:
        data = bytearray(f.read())

    if data[:4] != b'\x7fELF':
        print(f"ERROR: Not an ELF file: {path}")
        sys.exit(1)

    e_phoff     = struct.unpack_from('<Q', data, 32)[0]
    e_phentsize = struct.unpack_from('<H', data, 54)[0]
    e_phnum     = struct.unpack_from('<H', data, 56)[0]

    PT_NULL             = 0x00000000
    PT_LOAD             = 0x00000001
    PT_RISCV_ATTRIBUTES = 0x70000003
    FLAG_W = 0x2  # writeable

    for i in range(e_phnum):
        off     = e_phoff + i * e_phentsize
        p_type  = struct.unpack_from('<I', data, off)[0]
        p_flags = struct.unpack_from('<I', data, off+4)[0]
        p_vaddr = struct.unpack_from('<Q', data, off+16)[0]
        p_memsz = struct.unpack_from('<Q', data, off+40)[0]

        # Fix 1: zero out the ENTIRE PT_RISCV_ATTRIBUTES phdr (all 56 bytes).
        # Setting only p_type=PT_NULL is insufficient — ckb-vm may still read
        # vaddr=0x0 and memsz=0x34 and write into the R+X page.
        if p_type == PT_RISCV_ATTRIBUTES:
            print(f"  [fix1] phdr[{i}]: zero out entire PT_RISCV_ATTRIBUTES entry")
            data[off:off+e_phentsize] = bytes(e_phentsize)

        # Fix 2: extend LOAD_RW p_memsz to (RISCV_MAX_MEMORY - p_vaddr) so
        # that the CKB VM's stack (placed near 4MB) is in a valid R+W range.
        elif p_type == PT_LOAD and (p_flags & FLAG_W):
            new_memsz = RISCV_MAX_MEMORY - p_vaddr
            if new_memsz > p_memsz:
                print(f"  [fix2] phdr[{i}]: LOAD_RW memsz 0x{p_memsz:x} → 0x{new_memsz:x} "
                      f"(covers stack at 4MB)")
                struct.pack_into('<Q', data, off+40, new_memsz)

    with open(path, 'wb') as f:
        f.write(data)
    print(f"  [ok] {path}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <elf-binary>")
        sys.exit(1)
    for p in sys.argv[1:]:
        patch_elf(p)
