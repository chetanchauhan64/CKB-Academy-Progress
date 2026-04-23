# Validation Flow — Step-by-Step Rule Enforcement

> This document walks through each validation rule in the order the CKBFS Type Script enforces them at runtime inside the CKB RISC-V VM.

---

## Phase 0 — Script Bootstrap

```
CKB VM starts execution
  │
  ├─ ckb_std::entry!(program_entry) sets up _start symbol
  ├─ default_alloc!() installs buddy heap allocator
  └─ program_entry() calls entry::main()
```

---

## Phase 1 — Args Parsing

```rust
let script = load_script()?;           // syscall: CKB_SUCCESS or error
let args_bytes = script.args().raw_data();
let (owner_lock_hash, _file_id) = parse_args(args_bytes)?;
```

**Checked:** `InvalidArgsLength` if args ≠ 64 bytes.  
**Produces:** `owner_lock_hash: [u8; 32]` used in DESTRUCTION mode.

---

## Phase 2 — Group Data Collection

```rust
let input_data  = collect_group_data(Source::GroupInput)?;
let output_data = collect_group_data(Source::GroupOutput)?;
```

`QueryIter` iterates cells sharing this exact `(code_hash, hash_type, args)`.  
Empty Vec = no cells in that side of the group.

---

## Phase 3 — Mode Detection

| `input_data.is_empty()` | `output_data.is_empty()` | Mode |
|:-:|:-:|:--|
| true | false | **CREATION** |
| false | false | **UPDATE** |
| false | true | **DESTRUCTION** |
| true | true | `Error::Internal` (impossible) |

---

## Phase 4A — CREATION Rules

For each output cell (in order received from `GroupOutput`):

```
C1: data.len() >= 42         → DataTooShort
C2: data[0] == 0x01          → UnsupportedVersion
C3: chunk_index < total_chunks
    → ZeroTotalChunks (if total_chunks == 0)
    → InvalidChunkIndex (if chunk_index >= total_chunks)
C4: sha256(content) == stored_hash[10..42]
    → HashMismatch
C5: chunk_index not in seen_set
    → DuplicateChunkIndex
    (also: all cells must share the same total_chunks)
    → TotalChunksChanged
```

After iterating all outputs:
```
C6: if any cell has FLAG_FINALIZED set:
    seen_set.len() == total_chunks       → NonContiguousChunks
    all values [0, total_chunks) present → NonContiguousChunks
```

---

## Phase 4B — UPDATE Rules

**Step 1: Parse all inputs and outputs.**
```
parse(input)  for each input  → applies C1, C2, C3 implicitly
parse(output) for each output → same
```

**Step 2: Count must match.**
```
inputs.len() == outputs.len() → Error::Internal if not
```

**Step 3: For each output cell:**
```
U1: sha256(output.content) == output.sha256_hash   → HashMismatch
C5: output.chunk_index not duplicated in outputs   → DuplicateChunkIndex

U2: find input where input.chunk_index == output.chunk_index
    → ChunkIndexChanged if not found

U4: input.total_chunks == output.total_chunks      → TotalChunksChanged
U5: input.version == output.version                → VersionChanged
U8: input.is_immutable() == false                  → ImmutableCell
```

**Step 4: Verify no input is silently dropped.**
```
for each input:
    output_chunks.contains(input.chunk_index) → ChunkIndexChanged if missing
```

---

## Phase 4C — DESTRUCTION Rules

```
D1: scan Source::Input (ALL inputs, not just group):
    any(load_cell_lock_hash(i) == owner_lock_hash)
    → UnauthorizedDestruction if none match
```

**Note:** The owner's lock script has already been executed (and verified their signature) before our Type Script runs. We only need to confirm the authorized cell is present.

---

## Phase 5 — Exit

```
Ok(())  → program_entry returns 0 → CKB VM: ACCEPT
Err(e)  → i8::from(e) = -(e as i8) → CKB VM: REJECT with exit code
```

All nodes in the CKB network independently run this same binary.  
**Consensus = unanimous agreement on the validation result.**
