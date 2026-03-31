
## Week 15

**Date:** 15th - 21st Feb, 2026

---

## Tasks Completed  

### RFCs Studied  

#### 1. RFC 0003 — CKB-VM Architecture

- Studied CKB-VM’s RISC-V based execution model.
- Understood memory constraints (4MB max), page separation (writable vs executable), and W^X enforcement.
- Analyzed script lifecycle: compile → hash → deploy as code cell → reference via `cell_dep`.
- Explored how dynamic linking enables code reuse across contracts.

---

#### 2. RFC 0008 — Molecule Serialization

- Studied the Molecule serialization format used for CKB core structures.
- Understood fixed vs dynamic types and how offset tables are constructed.
- Analyzed how transaction, script, and witness data are serialized.
- Observed how serialization directly affects transaction hash calculation.

---

#### 3. RFC 0009 — VM Syscalls

- Studied how scripts interact with blockchain state via syscalls:
  - `ckb_load_transaction`
  - `ckb_load_cell`
  - `ckb_load_witness`
- Explored partial loading mechanism and data slicing.
- Understood difference between `CKB_SOURCE_INPUT` and `CKB_SOURCE_GROUP_INPUT`.

---

#### 4. RFC 0022 — Transaction Structure

- Revisited full transaction structure including:
  - Inputs
  - Outputs
  - Cell Deps
  - Header Deps
- Studied lock vs type script roles and witness separation.
- Understood fee calculation via capacity delta between inputs and outputs.

---

## Practical Work  

### 1. RISC-V Lock Script Implementation  

- Wrote a minimal RISC-V lock script returning exit code `0`:

```asm
li a0, 0
li a7, 93
ecall
```

- Compiled to ELF binary.
- Calculated Blake2b hash of the compiled binary.
- Deployed script in a devnet code cell and successfully used it as a lock script.

---

### 2. Manual Transaction Construction  

- Built raw transaction JSON manually using:
  - `ckb-cli tx init`
  - `ckb-cli tx add-input`
  - `ckb-cli tx add-output`
  - `ckb-cli tx add-cell-dep`
  - `ckb-cli tx add-witness`
- Calculated capacities in Shannon (hex format).
- Debugged malformed transactions using:

```bash
ckb-debugger --tx-file tx.json --script input.0.lock --bin script.elf
```

- Fixed witness formatting and capacity overflow issues.

---

### 3. P2PKH Signing  

### Required Arguments

- Private Key: a secp256k1 private key
- Witnesses: contain transaction signatures

### Pseudo Code

```bash
def sign_tx(pk, tx):
	# Group transaction inputs for signing
    input_groups = compute_input_groups(tx.inputs)

    # Iterate through each group of inputs
    for indexes in input_groups:
        group_index = indexes[0]

        # Create a placeholder for the lock field in the first witness of the group
        dummy_lock = [0] * 65 # Placeholder, assuming a 65-byte lock field

        # Retrieve and deserialize the first witness in the group
        witness = tx.witnesses[group_index]
        witness_args = witness.deserialize()

        # Replace the lock field with the dummy placeholder
        witness_args.lock = dummy_lock

        # Initialize a new BLAKE2b hasher for creating the signature hash
        hasher = new_blake2b()

        # Hash the transaction hash
        hasher.update(tx.hash())

        # Hash the first witness
        witness_len_bytes = len(serialize(witness_args)).to_le()
        assert(len(witness_len_bytes), 8)

        # Hash the length of witness
        hasher.update(witness_len_bytes)
        hasher.update(serialize(witness_args))

        # Hash the remaining witnesses in the group
        for i in indexes[1:]:
            witness = tx.witnesses[i]
            witness_len_bytes = len(witness).to_le()
            assert(len(witness_len_bytes), 8)
            hasher.update(witness_len_bytes)
            hasher.update(witness)

        # Hash additional witnesses not in any input group
        for witness in tx.witnesses[len(tx.inputs):]
            witness_len_bytes = len(witness).to_le()
            assert(len(witness_len_bytes), 8)
            hasher.update(witness_len_bytes)
            hasher.update(witness)

        # Finalize the hasher to get the signature hash
        sig_hash = hasher.finalize()

        # Sign the transaction with private key
        signature = pk.sign(sig_hash)

        # Replace the dummy lock field with the actual signature in the first witness
        witness_args.lock = signature

        # Serialize the updated witness_args and update the transaction's witnesses list
        tx.witnesses[group_index] = serialize(witness_args)
```

---

## Developer Environment  

- Continued using local CKB dev node and miner.
- Practiced CLI-driven transaction workflow.
- Used RISC-V toolchain for:
  - Compilation
  - ELF inspection
  - Binary hashing
    
---

### References

- [How to Sign a Transaction](https://docs.nervos.org/docs/how-tos/how-to-sign-a-tx)
- [0022 transaction structure] (https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md)
