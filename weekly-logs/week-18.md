## Week 18

**Date:** 16th Apr - 23rd Apr, 2026

---

### Tasks Completed

- Built an advanced **CKB Type Script project (CKBFS - CKB File Storage System)**
- Implemented on-chain validation logic using Rust + ckb-std
- Designed custom **Cell data structure for file storage**
- Understood:
  - Type Script execution
  - Script group validation
  - State transition via transactions

---

### Project Overview (CKBFS)

- Each Cell stores:
  - File chunk data
  - Metadata (chunk index, total chunks)
  - SHA-256 hash (data integrity)

- Type Script enforces:
  - Data correctness
  - Ownership validation
  - Controlled state transitions

---

### System Design

- Cell Data Structure:
  - `[version][flags][chunk_index][total_chunks][hash][content]`

- Features:
  - Version control
  - Immutable flag support
  - Chunk-based file storage
  - Cryptographic validation

---

### Validation Logic (On-chain)

- **Creation Mode**
  - Validates new cell structure and hash

- **Update Mode**
  - Ensures:
    - Same owner
    - Same file_id
    - Same chunk_index
  - Prevents tampering

- **Destruction Mode**
  - Only owner can consume the cell

---

### Local Implementation

- Built RISC-V binary for CKB VM

```bash
cargo build --release --target riscv64imac-unknown-none-elf
```
- Successfully validated complete on-chain logic for all state transitions

---

### Testing

- Ran test suite:

```bash
cargo test
```
---
- Result:
  - 16/16 tests passed  

- Verified:
  - Data parsing  
  - Hash validation  
  - Edge cases  
---
### Terminal Output

<table>
  <tr>
    <td align="center">
      <img width="1470" height="923" alt="RISC-V Build Success" src="https://github.com/user-attachments/assets/d77afec7-7808-4778-8b08-1b676f1c8eaf" />
      <p><b>1. RISC-V Build Success</b></p>
    </td>
    <td align="center">
      <img width="1470" height="923" alt="Test Execution (16:16 Passed)" src="https://github.com/user-attachments/assets/b4209903-4326-4e40-b317-d7705bab0e1d" />
      <p><b>2. Test Execution (16/16 Passed)</b></p>
    </td>
    <td align="center">
      <img width="1470" height="923" alt="Binary Generated (CKB VM)" src="https://github.com/user-attachments/assets/579270da-df59-4003-b51a-172baeeb58bf" />
      <p><b>3. Binary Generated (CKB VM)</b></p>
    </td>
  </tr>
</table>

---

### Project Structure

```bash
ckbfs-type-script/
├── src/
├── tests/
├── docs/
├── prompts/
├── outputs/
├── Cargo.toml
├── README.md
```

---

### Observations

- CKB uses **Cell Model (state-based system)** instead of accounts  
- Transactions = state transitions  
- Cells = independent state units  
- Type Scripts = validation rules  

---

### Challenges

- Working with `no_std` Rust  
- Understanding CKB VM constraints  
- RISC-V compilation setup  
- Script group validation logic  

---

### Next Week Plan (Week 19)

- Build **Lumos-based transaction system**

- Implement:
  - Create cell (initial state)  
  - Update cell (state transition)  
  - Consume cell  

- Extend:
  - Transaction building (inputs/outputs)  
  - Witness handling  
  - Signing flow  

---

### References

- https://docs.nervos.org/  
- https://docs.rs/ckb-std/  
- https://github.com/nervosnetwork/lumos  
- https://testnet.explorer.nervos.org/  
