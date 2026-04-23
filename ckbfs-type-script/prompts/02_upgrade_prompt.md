# Prompt 02 — Upgrade Prompt

**Date:** 2026-04-20  
**Model:** Claude Sonnet (Thinking)  
**Purpose:** Evolve the initial design into a production-grade Type Script with complete validation rules

---

## Prompt Text

> I have a basic CKBFS idea. Now I need to make it production-grade.
>
> Current state:
> - Cell layout is defined (42-byte header)
> - args layout is defined (64 bytes)
> - Three execution modes identified (CREATE, UPDATE, DESTROY)
>
> Problems to solve:
>
> 1. **Validation gaps**: The create mode has no duplicate chunk detection. The update mode doesn't pair inputs to outputs by chunk_index. Destruction has no ownership check.
>
> 2. **Immutability**: How do I make some files permanently read-only on-chain?
>
> 3. **Finalization**: How do I signal that ALL chunks of a file are present?
>
> 4. **Multi-chunk atomicity**: If I upload 5 chunks in one transaction, how does the script validate them all as a group?
>
> 5. **Error codes**: I need stable error codes so off-chain tools can interpret failures.
>
> Design complete validation rules for all three modes with specific rule IDs (C1, C2, U1, D1, etc.) that I can implement in Rust.

---

## AI Response Summary

The AI produced the complete **validation rule taxonomy** used in this implementation:

### Creation Rules (C1–C6)
- C1: Minimum data size (42 bytes)
- C2: Version must be `0x01`
- C3: `chunk_index < total_chunks`
- C4: `SHA-256(content) == stored_hash`
- C5: No duplicate `chunk_index` in the output group
- C6: If `FLAG_FINALIZED` set → chunk set must be contiguous `[0, N)`

### Update Rules (U1–U8)
- U1: Apply C1–C4 to output cells
- U2: Pair input ↔ output by `chunk_index`
- U3: `chunk_index` cannot change
- U4: `total_chunks` cannot change
- U5: `version` cannot change
- U6: `owner_lock_hash` preserved in args (enforced by script group identity)
- U7: `file_id` preserved in args (enforced by script group identity)
- U8: If input `FLAG_IMMUTABLE` set → **REJECT**

### Destruction Rule (D1)
- D1: At least one input's `lock_hash == owner_lock_hash` from args

---

## Architectural Decisions Made at This Stage

| Decision | Detail |
|----------|--------|
| Flags byte split | `FLAG_IMMUTABLE = 0b01`, `FLAG_FINALIZED = 0b10` — independent, composable |
| Update pairing by chunk_index | More flexible than positional pairing; allows reordering in TX inputs/outputs |
| Contiguity check as optional | Only triggered by `FLAG_FINALIZED` so partial uploads are valid |
| Error range grouping | Grouped by category (10s=parse, 20s=args, 30s=hash, 40s=update, 50s=destroy, 60s=group) for debuggability |
| `Source::Input` for D1 | Check ALL inputs (not just GroupInput) because owner's identity cell may have a different type script |

---

## Notable Insight: Why Script Group Identity Handles U6 and U7

The user asked: *"How do I enforce that `file_id` doesn't change during an update?"*

The AI explained: Since `file_id` is part of the **Type Script args**, and the script group is defined by identical `(code_hash, hash_type, args)`, all cells in the group *automatically* share the same `file_id`. A cell with different args would be in a different script group, executed by a different script run. **U6 and U7 are enforced for free by the CKB VM's grouping mechanism.**
