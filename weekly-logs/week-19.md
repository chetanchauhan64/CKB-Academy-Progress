## Week 19

**Date:** 20th Apr - 26th Apr, 2026

---

### Tasks Completed

- Built a **production-level CKBFS SDK (Transaction Layer)**
- Successfully deployed and executed **real transactions on CKB Testnet (Aggron4)**
- Integrated **end-to-end flow: Build → Sign → Send → Confirm**
- Developed **Frontend dApp with wallet integration and live transaction support**
- Implemented **multi-phase architecture (builder, executor, wallet, UI)**

---

### SDK Development (CKBFS Transaction System)

- Designed modular SDK structure:

  - `builder/`
    - Input selection (live cells)
    - Fee calculation (byte-accurate)
    - Change output handling
    - Raw transaction creation

  - `executor/`
    - Transaction signing (secp256k1)
    - Transaction sending (RPC)
    - Confirmation polling (with retry logic)
    - Indexer sync validation

  - `tx/`
    - Create (initial state)
    - Update (state transition)
    - Consume (cell destruction)

  - `wallet/`
    - Private key wallet (SDK-level signing)

---

### Transaction Flow Implementation

Implemented full lifecycle:

- Build transaction (inputs + outputs)
- Sign using witness (RFC-0024 compliant)
- Broadcast to CKB Testnet
- Confirm via indexer + RPC

Supported operations:

- **CREATE**
  - Create new file cell (initial state)

- **UPDATE**
  - Consume old cell
  - Create new cell with updated data

- **CONSUME**
  - Destroy cell
  - Recover locked capacity

- **MULTI-CHUNK**
  - Handle multiple cells for large file storage

---

### On-chain Execution (Testnet Verified)

- Successfully executed all transaction types on **Aggron4 Testnet**

- Verified:
  - Cell creation
  - State transition (update)
  - Cell consumption
  - Multi-cell validation

- Confirmed:
  - Type Script execution correctness
  - Data integrity validation
  - Ownership enforcement

---

### Critical Issues Resolved

- Fixed **RISC-V AMO instruction issue**
  - Disabled unsupported atomic instructions

- Fixed **CKB VM compatibility**
  - Used correct hashType (`data1`)

- Fixed **Indexer query mismatch**
  - Corrected script filtering logic

- Fixed **Capacity handling**
  - Dynamic capacity adjustment during updates

- Fixed **Transaction failures**
  - Improved error handling + retry logic

---

### Frontend dApp Development

- Built full **Next.js frontend interface**

- Features:
  - File upload (CREATE)
  - File update (UPDATE)
  - File delete (CONSUME)
  - Dashboard (file listing)

- Integrated:
  - Live transaction execution from UI
  - Real-time transaction status tracking

---

### Wallet Integration

- Implemented **Wallet Abstraction Layer**

- Supported:
  - JoyID wallet (browser-based)
  - Private key wallet (dev mode)

- Architecture:
  - Adapter pattern for extensibility
  - Server-side signing (secure handling)
  - Session persistence

---

### UI/UX Enhancements

- Upgraded to **premium dashboard UI**

- Improvements:
  - Card-based layout (file grid)
  - Transaction status component (4 states)
  - Toast notification system
  - Skeleton loaders for async states

---

### Project Structure

```bash
ckbfs-type-script/
├── sdk/
├── frontend/
├── docs/
├── scripts/
├── outputs/
├── tests/
├── Cargo.toml
├── README.md
```
---

### Observations

- CKB enables **state-based architecture using Cells**  
- Smart contracts act as **validation logic, not execution logic**  
- Transactions define **state transitions**  
- SDK abstraction simplifies complex blockchain interactions  
- Separation of concerns (builder, executor, UI) improves scalability  

---

### Challenges

- Working with **CKB VM constraints (RISC-V)**  
- Debugging **low-level script execution errors**  
- Managing **capacity and fee balancing**  
- Handling **indexer synchronization delays**  
- Designing **secure wallet abstraction**  

---

### Next Week Plan (Week 20)

- Upgrade project to **production-grade dApp**

#### Implement:
- Multi-wallet support (beyond JoyID)  
- Improved transaction UX (progress + retry states)  
- File indexing and retrieval system  
- Explorer integration (direct linking)  

#### Enhance UI:
- Advanced animations (premium feel)  
- Improved dashboard UX  
- Better loading and error states  

#### Add:
- Complete documentation (README + architecture)  
- Screenshots + demo flow  
- Deployment-ready structure  

#### Goal:
- Convert project into **portfolio-level, placement-ready product**  
- Demonstrate **real-world blockchain application development**  

---

### References

- https://docs.nervos.org/  
- https://docs.rs/ckb-std/  
- https://github.com/nervosnetwork/lumos  
- https://testnet.explorer.nervos.org/  

---
