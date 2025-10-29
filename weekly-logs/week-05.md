# Week 05 Report  
**Date:** 22nd - 28th Oct, 2025  

---

## Tasks Completed

### • Introduction to NFTs on Nervos CKB
- NFTs (Non-Fungible Tokens) are implemented as **first-class assets** on CKB.  
- Each NFT contains **ownership info, data, and token logic** secured by CKB’s consensus.

![Topic 1]<table style="width:100%; text-align:center;">
  <tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
    <img width="1582" height="952" alt="Screenshot 2025-10-30 at 2 36 23 AM" src="https://github.com/user-attachments/assets/e6bbfb0f-11ab-419a-9f72-8b55db4fe089" />
      <p style="text-align:center;">1. <a href="https://academy.ckb.dev/courses/basic-operation">Introduction</a></p>
    </td>
  </tr>
</table>

---

### • NFT Standards Overview
- **CoTA (Compact Token Aggregator)**: Off-chain data verification via **SMT proofs**, extremely low-cost.  
- **Spore**: Fully on-chain NFTs with **strong permanence** and decentralization.

![Topic 2] 
<tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
   <img width="1582" height="952" alt="Screenshot 2025-10-30 at 2 52 00 AM" src="https://github.com/user-attachments/assets/bfa7a59e-ad17-4aef-ab17-2a8d946b783d" />
      <p style="text-align:center;"> <a href="https://academy.ckb.dev/courses/basic-operation">2. Exploring CKB’s Dual-Layer NFT Ecosystem
n</a></p>
    </td>
  </tr>
</table>


---

### • CoTA NFTs – Strengths and Use Cases

**About CoTA:**  
- Verifies structured off-chain data with **Sparse Merkle Tree (SMT)** proofs.  
- Reduces on-chain storage and costs significantly.  
- **32-byte root hash** stored on-chain per NFT.  
- Ownership proofs are handled off-chain via CoTA framework.  
- Creating a CoTA cell costs **< $0.50 USD**; transfer fees **< $0.01 USD** per NFT.

**Use Cases:**  
- Digital art, music, and collectibles  
- In-game items  
- Event tickets (POAPs)  
- Tokenization of real-world assets  

![Topic 3]<tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
  <img width="1470" height="923" alt="Screenshot 2025-10-30 at 3 08 23 AM" src="https://github.com/user-attachments/assets/8218354f-ff58-456c-b55b-628c7e787e12" />
      <p style="text-align:center;"> <a href="https://academy.ckb.dev/courses/basic-operation">3. CoTA NFTs: Strengths and Practical Applications
n</a></p>
    </td>
  </tr>
</table>

### • Spore NFTs – Strengths and Use Cases

**About Spore:**  
- Fully on-chain content, storing images/music directly on-chain.  
- Each NFT has a separate cell; data is **replicated across nodes** for permanence.  
- Storage cost: **1 CKB per byte** (refundable upon burning).  
- Guarantees **availability, decentralization, and sustainability**.

**Use Cases:**  
- High-value artwork and collectibles  
- Pixel art or low-data artwork  
- Tokenized real estate, stocks, or loans  

![Topic 4](./screenshots/topic4.png)

---

### • Comparing NFT Standards

| **Attribute** | **CoTA NFT Standard** | **Spore NFT Standard** |
|---------------|----------------------|------------------------|
| One-Time Setup Cost | < $0.50 USD | N/A¹ |
| Minting Cost | < $0.01 USD | Depends on content² |
| Transfer Cost | < $0.01 USD | < $0.01 USD |
| Smart Contract Deploy Cost | N/A³ | N/A³ |
| Account / UTXO Model | Account Model | Cell Model (UTXO) |
| Refundable State Rent Deposit | ✅ Yes | ✅ Yes |
| First-Class Assets | ✅ Yes | ✅ Yes |
| SMT-Based | ✅ Yes | ⛔ No |
| Full On-Chain Content | ⛔ No | ✅ Yes |
| SDK Available | ✅ Yes | ✅ Yes |
| Primary Benefit | Low Cost | Strong Permanence |

¹ Spore uses new cells per NFT.  
² Requires 1 CKB per byte of data.  
³ Template contracts reduce deployment cost.

**Summary:**  
- **CoTA** → Best for *low-cost, scalable NFTs*.  
- **Spore** → Best for *NFTs requiring full on-chain permanence*.  

![Topic 5](./screenshots/topic5.png)

---

### • Next Steps – Resources

**CoTA Resources:**  
- [CoTA Website](https://cota.io) – Protocol documentation & examples  
- [CoTA SDK](https://github.com/nervina-labs/cota-sdk-js) – JavaScript SDK  

**Spore Resources:**  
- [Spore Website](https://spore.pro) – Documentation & examples  
- [Spore SDK](https://github.com/nervosnetwork/spore-sdk) – SDK Tools  

**Community Support:**  
- [Nervos Discord](https://discord.gg/nervos)  
- [Nervos Talk Forums](https://talk.nervos.org)  

![Topic 6](./screenshots/topic6.png)

---

### • References
- [CoTA Official Website](https://cota.io)  
- [CoTA SDK Documentation](https://github.com/nervina-labs/cota-sdk-js)  
- [Spore Official Website](https://spore.pro)  
- [Spore SDK Documentation](https://github.com/nervosnetwork/spore-sdk)  






