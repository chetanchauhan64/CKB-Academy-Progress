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
 <tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
    <img width="1470" height="923" alt="Screenshot 2025-10-30 at 3 45 57 AM" src="https://github.com/user-attachments/assets/19ec2ec8-c607-48d2-9900-9d2db5cb2bfa" />
      <p style="text-align:center;">1. <a href="https://academy.ckb.dev/courses/basic-operation">Understanding Key Terms – The CKB Glossary
</a></p>
    </td>
  </tr>
</table>

### • CKB-VM Example – Token Initialization and Transfer
```rust
#include <stdio.h>
#include <string.h>

// Define a simple token structure
struct Token {
    char name[20];
    int totalSupply;
    int balance;
};

// Initialize a token
void initToken(struct Token *token, const char *name, int supply) {
    strcpy(token->name, name);
    token->totalSupply = supply;
    token->balance = supply;
    printf("Token '%s' initialized with total supply: %d\n", name, supply);
}

// Transfer tokens between users
void transfer(struct Token *token, int *fromBalance, int *toBalance, int amount) {
    if (*fromBalance >= amount) {
        *fromBalance -= amount;
        *toBalance += amount;
        printf("Transfer successful! %d tokens transferred.\n", amount);
    } else {
        printf("Transfer failed: Insufficient balance.\n");
    }
}

int main() {
    struct Token myToken;
    int aliceBalance = 1000;
    int bobBalance = 200;

    initToken(&myToken, "NEON", 5000);

    printf("Initial Balances:\nAlice: %d\nBob: %d\n\n", aliceBalance, bobBalance);

    transfer(&myToken, &aliceBalance, &bobBalance, 300);

    printf("\nUpdated Balances:\nAlice: %d\nBob: %d\n", aliceBalance, bobBalance);
    return 0;
}
```
<tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
      <p style="text-align:center;"> <a href="https://academy.ckb.dev/courses/basic-operation">•[Exploring CKB’s Dual-Layer NFT Ecosystem](https://nervos.gitbook.io/developer-training-course/)
n</a></p>
    </td>
  </tr>
</table>


---

### • NFT Standards Overview
- **CoTA (Compact Token Aggregator)**: Off-chain data verification via **SMT proofs**, extremely low-cost.  
- **Spore**: Fully on-chain NFTs with **strong permanence** and decentralization

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

---

![Topic 3]
<tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
  <img width="1470" height="923" alt="Screenshot 2025-10-30 at 3 08 23 AM" src="https://github.com/user-attachments/assets/8218354f-ff58-456c-b55b-628c7e787e12" />
      <p style="text-align:center;"> <a href="https://academy.ckb.dev/courses/basic-operation">3. CoTA NFTs: Strengths and Practical Applications
n</a></p>
    </td>
  </tr>
</table>

---

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

---

![Topic 4]
<tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
 <img width="1470" height="923" alt="Screenshot 2025-10-30 at 3 06 19 AM" src="https://github.com/user-attachments/assets/81db1230-e8e3-44f2-a4dc-94dca6df8633" />
      <p style="text-align:center;"> <a href="https://academy.ckb.dev/courses/basic-operation">4.Spore NFTs: Fully On-Chain Storage and Use Cases
n</a></p>
    </td>
  </tr>
</table>

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

![Topic 5]
<tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
 <img width="1470" height="923" alt="Screenshot 2025-10-30 at 3 21 08 AM" src="https://github.com/user-attachments/assets/c3ceb397-226f-4cda-bfc3-38ad93abbd3e" />
      <p style="text-align:center;"> <a href="https://academy.ckb.dev/courses/basic-operation">5.Comparing CoTA and Spore NFT Standards
n</a></p>
    </td>
  </tr>
</table>

---
## 6. Next Steps – Resources
![Course Completion]
<tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
<img width="1582" height="952" alt="Screenshot 2025-10-30 at 2 43 03 AM" src="https://github.com/user-attachments/assets/be0ae850-542f-478a-bafb-806dbb5e1a08" />
      <p style="text-align:center;"> <a href="https://academy.ckb.dev/courses/basic-operation">5.Comparing CoTA and Spore NFT Standards
n</a></p>
    </td>
  </tr>
</table>

---

### • Resources

**CoTA Resources:**  
- [CoTA Website](https://cota.io) – Protocol documentation & examples  
- [CoTA SDK](https://github.com/nervina-labs/cota-sdk-js) – JavaScript SDK  

**Spore Resources:**  
- [Spore Website](https://spore.pro) – Documentation & examples  
- [Spore SDK](https://github.com/nervosnetwork/spore-sdk) – SDK Tools  

**Community Support:**  
- [Nervos Discord](https://discord.gg/nervos)  
- [Nervos Talk Forums](https://talk.nervos.org)  

---

### • References
- [CoTA Official Website](https://cota.io)  
- [CoTA SDK Documentation](https://github.com/nervina-labs/cota-sdk-js)  
- [Spore Official Website](https://spore.pro)  
- [Spore SDK Documentation](https://github.com/nervosnetwork/spore-sdk)  


<img width="1470" height="923" alt="Screenshot 2025-10-30 at 3 45 57 AM" src="https://github.com/user-attachments/assets/19ec2ec8-c607-48d2-9900-9d2db5cb2bfa" />



