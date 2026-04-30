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
      <img width="1468" height="633" alt="Screenshot 2026-04-30 at 11 42 51 PM" src="https://github.com/user-attachments/assets/c6233395-48a1-4e9c-aeef-d0a555c329dc" />
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
      <img width="1470" height="923" alt="Screenshot 2026-04-30 at 11 33 58 PM" src="https://github.com/user-attachments/assets/3bdbc3be-f2be-4b4c-99cc-4a6d3c683226" />
      <p><b>3. Upload Initiated</b></p>
    </td>
    <td align="center">
      <img width="1470" height="923" alt="Screenshot 2026-04-30 at 8 42 13 PM" src="https://github.com/user-attachments/assets/aeec29ab-aee0-4c36-85bf-07306ddcc46e" />
      <p><b>4. Transaction Submitted</b></p>
    </td>
    <td align="center">
      <img width="651" height="850" alt="Screenshot 2026-04-30 at 11 49 27 PM" src="https://github.com/user-attachments/assets/17d8f7d2-e626-48bc-9d9c-a364ec470cdd" />
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
      <img width="1470" height="923" alt="Screenshot 2026-04-30 at 9 27 02 PM" src="https://github.com/user-attachments/assets/90b45238-4a7d-45b1-865a-7e6f8401f9fc" />
      <p><b>6. JoyID Signing Popup</b></p>
    </td>
    <td align="center">
      <img width="1470" height="923" alt="Screenshot 2026-04-30 at 9 27 21 PM" src="https://github.com/user-attachments/assets/6af7d08c-50f8-40c1-981a-8112a0526a04" />
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
  <img width="1470" height="923" alt="Screenshot 2026-04-30 at 8 49 14 PM" src="https://github.com/user-attachments/assets/0829d93f-b529-4648-b256-0c7911a32994" />

<p align="center"><b>8. File Update Confirmation</b></p>

---

### File Consume (Delete + Recover CKB)

- File consumed from blockchain  
- Locked capacity returned to wallet  

<table>
  <tr>
    <td align="center">
      <img width="1470" height="923" alt="Screenshot 2026-04-30 at 8 51 44 PM" src="https://github.com/user-attachments/assets/921b3bc5-e60f-49d5-9f19-35a16290960b" />
      <p><b>9. Consume Confirmation Popup</b></p>
    </td>
    <td align="center">
      <img width="1470" height="923" alt="Screenshot 2026-04-30 at 8 49 23 PM" src="https://github.com/user-attachments/assets/e727f5a6-6417-4210-a649-bd2433e18ac7" />
      <p><b>10. Consume Success</b></p>
    </td>
  </tr>
</table>

---

### File Viewer (Reconstruction)

- File reconstructed from on-chain chunks  
- Preview + metadata displayed  

<p align="center">
  <img width="1470" height="923" alt="Screenshot 2026-04-30 at 8 52 11 PM" src="https://github.com/user-attachments/assets/cb9060b3-7bdf-4e63-94af-65637a6385af" />

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
