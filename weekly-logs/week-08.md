## Week 05

**Date:** 19th - 24th Nov, 2025

### Tasks Completed

### CKB Development Progress

Completed two core Nervos CKB dApp tutorials from the official documentation:

1. [Transfer CKB](https://docs.nervos.org/docs/dapp/transfer-ckb)
2. [Store Data on Cell](https://docs.nervos.org/docs/dapp/store-data-on-cell)

---

#### 1. Transfer CKB:

- Set up the local devnet environment and started it using `offckb node`.
- Generated devnet-funded accounts using `offckb accounts` in a separate terminal session.
- Successfully transferred CKB on the local devnet.
- Switched environment to testnet by creating an `.env` file and setting `NETWORK=testnet`.
- Re-ran the dApp using faucet-funded testnet accounts.
- Reproduced the same transfer process on the testnet for complete understanding.

> _Screenshots (optional):_
<table style="width:100%; text-align:center;">
<tr>
<td style="width:33.3%; vertical-align:top; text-align:center;">
<img width="1470" height="956" alt="simple transfer" src="https://github.com/user-attachments/assets/11da4af1-3f2d-4f21-a2c0-3a075d079191" />
<p style="text-align:center;">1. <a href="https://docs.nervos.org/docs/dapp/transfer-ckb">Transfer dApp - Local Setup</a></p>
</td>
<td style="width:33.3%; vertical-align:top; text-align:center;">
<img width="1470" height="956" alt="Screenshot 2025-11-24 at 11 53 42 PM" src="https://github.com/user-attachments/assets/1790c8d5-69cd-4508-821f-135308f20713" />
<p style="text-align:center;">2. Transferred Funds on Testnet</p>
</td>
<td style="width:33.3%; vertical-align:top; text-align:center;">
<img width="1470" height="956" alt="Screenshot 2025-11-25 at 2 35 21 AM" src="https://github.com/user-attachments/assets/1c76ca9f-4e34-4f67-857d-fb98e789c73a" />
<p style="text-align:center;">3. <a href="https://testnet.explorer.nervos.org/">Explorer Link</a></p>
</td>
</tr>
</table>

---

#### 2. Store Data on Cell:

- Started the devnet again using `offckb node`.
- Generated new accounts on devnet using `offckb accounts`.
- Successfully stored on-chain data on the local devnet using the tutorial dApp.
- Switched to testnet by setting `NETWORK=testnet`.
- Encoded, stored, and retrieved a custom on-chain message:
  
  **“Chetan storing values on CKB Testnet”**

- Understood how CKB stores raw data in a Cell’s `data` field and how to decode hex back to readable text.

> _Screenshots (optional):_
<table style="width:100%; text-align:center;">
<tr>
<td style="width:33.3%; vertical-align:top; text-align:center;">
<img src="../assets/store-data-in-a-cell-tutorial-dapp-local-setup.png" alt="Store Data on Cell - Local Setup" width="100%">
<p style="text-align:center;">1. <a href="https://docs.nervos.org/docs/dapp/store-data-on-cell">Store Data on Cell - Local Setup</a></p>
</td>
<td style="width:33.3%; vertical-align:top; text-align:center;">
<img src="../assets/store-data-on-cell-tutorial-dapp.png" alt="Stored Data on Cell" width="100%">
<p style="text-align:center;">2. Stored Message on Cell</p>
</td>
<td style="width:33.3%; vertical-align:top; text-align:center;">
<img src="../assets/read-data-stored-on-a-cell.png" alt="Read Data Stored on a Cell" width="100%">
<p style="text-align:center;">3. Read Data & <a href="https://testnet.explorer.nervos.org/">Explorer Link</a></p>
</td>
</tr>
</table>

---

### References

- [Transfer CKB](https://docs.nervos.org/docs/dapp/transfer-ckb)  
- [Store Data on Cell](https://docs.nervos.org/docs/dapp/store-data-on-cell)  
- [Faucet](https://faucet.nervos.org/)  
- [Testnet Explorer](https://testnet.explorer.nervos.org/)




<img width="1470" height="956" alt="Screenshot 2025-11-25 at 2 35 21 AM" src="https://github.com/user-attachments/assets/1c76ca9f-4e34-4f67-857d-fb98e789c73a" />



