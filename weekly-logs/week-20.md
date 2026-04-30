## Week 20

**Date:** 24th Apr - 30th Apr, 2026

---

### Tasks Completed

- Implemented **Multi-file Support system** (dashboard + chunk handling)
- Built **Upgradeable File Flow (Update same File ID)**
- Implemented **Consume Mechanism (Delete + recover locked CKB)**
- Built **File Reconstruction (Viewer system)**
- Solved **Indexer Lag issue using RPC-first validation**
- Implemented **Retry + Backoff Strategy**
- Completed **End-to-End CKBFS lifecycle**

---

### Multi-file Dashboard (Working System)

- Dashboard displays:
  - Total files
  - Total storage
  - Total locked CKB
- Each file contains:
  - Size
  - Chunks
  - Locked capacity
  - Actions (View / Update / Delete)

<table>
  <tr>
    <td align="center">
      <img width="1470" height="923" alt="Screenshot 2026-04-30 at 8 44 45 PM" src="https://github.com/user-attachments/assets/a4bb891e-9706-4a1a-ae87-33117e96c896" />
      <p><b>1. Multi-file Dashboard Overview</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/PASTE_LINK_2" width="300"/>
      <p><b>2. File Cards with Metadata</b></p>
    </td>
  </tr>
</table>

---

### File Upload (Transaction Flow)

- File uploaded successfully on-chain  
- Transaction lifecycle:
  - Build → Sign → Broadcast → Confirm  

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/PASTE_LINK_3" width="300"/>
      <p><b>3. Upload Initiated</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/PASTE_LINK_4" width="300"/>
      <p><b>4. Transaction Submitted</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/PASTE_LINK_5" width="300"/>
      <p><b>5. Transaction Confirmed</b></p>
    </td>
  </tr>
</table>

---

### Wallet Signing (JoyID Integration)

- Transaction signed using JoyID wallet  
- Verified:
  - Fee deduction  
  - Inputs / Outputs  

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/PASTE_LINK_6" width="300"/>
      <p><b>6. JoyID Signing Popup</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/PASTE_LINK_7" width="300"/>
      <p><b>7. Transaction Inputs & Outputs</b></p>
    </td>
  </tr>
</table>

---

### File Update (Upgradeable System)

- Existing file updated  
- Same File ID maintained  
- New transaction replaces old state  

<p align="center">
  <img src="https://github.com/user-attachments/assets/PASTE_LINK_8" width="500"/>
</p>

<p align="center"><b>8. File Update Confirmation</b></p>

---

### File Consume (Delete + Recover CKB)

- File consumed from blockchain  
- Locked capacity returned to wallet  

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/PASTE_LINK_9" width="300"/>
      <p><b>9. Consume Confirmation Popup</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/PASTE_LINK_10" width="300"/>
      <p><b>10. Consume Success</b></p>
    </td>
  </tr>
</table>

---

### File Viewer (Reconstruction)

- File reconstructed from on-chain chunks  
- Preview + metadata displayed  

<p align="center">
  <img src="https://github.com/user-attachments/assets/PASTE_LINK_11" width="500"/>
</p>

<p align="center"><b>11. File Viewer (Reconstructed File)</b></p>

---

### Indexing Strategy (Critical Fix)

- Implemented **Hybrid Approach**

| Component | Role |
|----------|------|
| Indexer | Find candidate cells |
| RPC | Validate live cells |

- Solved:
  - Indexer lag issue  
  - Invalid cell selection  

---

### Retry Mechanism (Robust Execution)

- Max attempts: 10  
- Delay logic:
- delay = 2000 + attempt * 500 + jitter

- Ensures:
  - Reliable transaction execution  
  - No failure due to sync delay  

---

### Architecture Overview

Frontend (Next.js)  
↓  
API Routes  
↓  
txBuilder  
↓  
Indexer → Candidate Cells  
↓  
RPC → Live Validation  
↓  
Transaction Build  
↓  
Wallet Sign (JoyID / Private Key)  
↓  
Blockchain (CKB)  
↓  
Confirmation (RPC)

---

### Code Implementation

```ts
const MAX_RETRY_ATTEMPTS = 10;

for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
  const cell = await selectInputCells();

  if (cell) break;

  const delay = 2000 + attempt * 500 + Math.random() * 500;
  await new Promise(res => setTimeout(res, delay));
}
```
---

## Observations

- Successfully built complete decentralized file storage system

### Verified

- Upload  
- Update  
- Consume  
- View  

### Problem Solved

- Indexer vs RPC inconsistency (real-world blockchain issue)

### Implemented

- Retry mechanism (progressive backoff + jitter)  
- Multi-file architecture  
- Upgradeable storage  

---

## Final Outcome

- Fully working CKBFS system  
- Multi-file support implemented  
- Upgradeable architecture complete  
- Reliable transaction execution  
- Production-ready system  

---

## Conclusion

Week 20 marks the successful completion of the **CKBFS system** with:

- Multi-file storage  
- Upgradeable file handling  
- Reliable indexing strategy  
- Full transaction lifecycle  

The system now demonstrates a **real-world decentralized storage solution on Nervos CKB**.

---

## References

- https://docs.nervos.org/  
- https://testnet.explorer.nervos.org/  
- https://testnet.ckb.dev  
- https://joyid.dev  
