# Prompt 01 — Initial Idea Prompt

**Date:** 2026-04-15 (Week 1 → Week 2 transition)  
**Model:** Claude Sonnet (Thinking)  
**Purpose:** Generate the initial concept and high-level design for CKBFS

---

## Prompt Text

> I want to build an advanced CKB (Nervos blockchain) project for Week 2 of my learning journey.
>
> Week 1 was basic: live cell fetching, testnet transactions, CKB fundamentals.
>
> For Week 2 I want something genuinely production-grade. Not a toy. Something that demonstrates deep understanding of:
> - CKB's Cell Model and how data is stored on-chain
> - Type Scripts as on-chain state machines
> - The CKB VM (RISC-V) and what it can and cannot do
> - Real-world use cases for blockchain-native storage
>
> Give me an idea for a project that:
> 1. Is unique and technically impressive
> 2. Uses a Type Script written in Rust (compiled to RISC-V)
> 3. Has clear, enforceable validation rules
> 4. Could realistically ship on mainnet
>
> Don't give me a generic NFT or token. Think about what CKB's cell model uniquely enables.

---

## AI Response Summary

The AI proposed **CKBFS — CKB File Storage System**, reasoning that:

- CKB's UTXO-style cell model is uniquely suited to representing file chunks as discrete, independently addressable units
- Unlike EVM contracts, Type Scripts can validate data *layout* and *integrity* without storing state in a mapping
- SHA-256 content hashing can be computed inside the RISC-V VM using pure Rust (no syscalls needed)
- The system naturally decomposes into three lifecycle modes: CREATE, UPDATE, DESTROY — a clean state machine

**Core insight:** Because CKB runs the script on every cell transition, we get **free content integrity verification** — the blockchain itself becomes the notary.

---

## Key Decisions Made at This Stage

| Decision | Rationale |
|----------|-----------|
| Pure Rust SHA-256 (no crate dependency) | Avoid `no_std` compatibility issues; full control over RISC-V binary size |
| 42-byte fixed header | Minimal overhead; all fields have known offsets → zero-copy parsing |
| `file_id` in args (not data) | Grouping by args means CKB's script group mechanism does the work of finding all chunks automatically |
| `owner_lock_hash` in args | Standard CKB pattern for ownership; avoids storing the full lock script on-chain |
| Destruction via lock hash presence | Piggybacks on CKB's guaranteed lock-before-type execution order |
