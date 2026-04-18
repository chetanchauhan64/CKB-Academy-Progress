## Week 17

**Date:** 11th Apr - 18th Apr, 2026

---

### Tasks Completed

- Started deep dive into **CKB Cell Model** using official documentation.
- Understood structure of a Cell:
  - Capacity (CKB stored in cell)
  - Lock Script (ownership verification)
  - Type Script (optional smart contract logic)
- Learned how **transactions consume inputs and create outputs (Cell Model flow)**.

---

### Transaction Execution (Testnet)

- Performed real transaction using JoyID wallet
- Sent CKB (self-transfer)
- Verified transaction lifecycle

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/0774b1fd-4863-43ec-b194-79c52e2bb360" width="300"/>
      <p><b>1. Transaction Creation</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/bb9c2ebe-7a57-4ed1-aa0d-9b7be8e41bb5" width="300"/>
      <p><b>2. Transaction Confirmation</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/8703ccb2-0ea7-4b89-a79d-0581106974cc" width="300"/>
      <p><b>3. Transaction Success</b></p>
    </td>
  </tr>
</table>

---

### Transaction Analysis (Explorer)

- Observed Inputs (consumed cells)
- Observed Outputs (new cells created)
- Verified real Cell Model behavior

<p align="center">
  <img width="1470" height="923" alt="Screenshot 2026-04-18 at 9 24 34 PM" src="https://github.com/user-attachments/assets/4ee7678e-d264-4286-94c3-0706f5620c07" />
</p>

---

### Advanced Cell Verification (Explorer)

- Verified transaction at **cell level (deep inspection)**  
- Observed:
  - Input = Consumed Cell  
  - Output = Live Cell  
- Confirmed:
  - Same lock script → same ownership  
  - Cell lifecycle: Input → Output  

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/f13382f4-1cf1-4540-877f-0449295c90cf" width="350"/>
      <p><b>Consumed Cell (Input)</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/cc1bc698-d6fa-4a0a-9495-c9fa28f2f28a" width="350"/>
      <p><b>Live Cell (Output)</b></p>
    </td>
  </tr>
</table>

---

### Local Implementation using Lumos

- Connected to CKB Testnet (Aggron4)
- Converted address → lock script
- Fetched live cells from blockchain

#### Enhancements:
- Converted Shannons → CKB
- Calculated total balance
- Exported data into JSON & CSV
  
<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/ccf3ebac-c209-419c-bf90-8c1a2a89d37f" width="300"/>
      <p><b>4. Terminal Output</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/f1e70ab9-bf49-44f3-b901-b30a565273a8" width="300"/>
      <p><b>5. JSON Output</b></p>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/a064fe62-5107-4ec7-86b6-4a1d9fa849e4" width="300"/>
      <p><b>6. CSV Output</b></p>
    </td>
  </tr>
</table>

---

### Code Implementation

```js
const fs = require("fs");
const { BI } = require("@ckb-lumos/bi");
const { initializeConfig, predefined } = require("@ckb-lumos/config-manager");
const { Indexer, CellCollector } = require("@ckb-lumos/lumos");
const { addressToScript } = require("@ckb-lumos/helpers");

initializeConfig(predefined.AGGRON4);

const address = "PASTE_YOUR_ADDRESS_HERE";

const script = addressToScript(address);
const indexer = new Indexer("https://testnet.ckb.dev");

async function main() {
  const collector = new CellCollector(indexer, {
    lock: script,
  });

  let total = BI.from(0);
  let results = [];

  console.log("Fetching LIVE CELLS...\n");

  for await (const cell of collector.collect()) {
    const capacity = BI.from(cell.cellOutput.capacity);
    const capacityCKB = capacity.div(100000000);

    total = total.add(capacity);

    const data = {
      txHash: cell.outPoint.txHash,
      index: cell.outPoint.index,
      capacityCKB: capacityCKB.toString(),
      type: cell.cellOutput.type ? "TYPE CELL" : "NORMAL CELL",
    };

    results.push(data);

    console.log("TX:", data.txHash);
    console.log("Capacity:", data.capacityCKB, "CKB");
    console.log("Type:", data.type);
    console.log("----------------------");
  }

  console.log("\nTotal Cells:", results.length);
  console.log(
    "Total Balance:",
    total.div(100000000).toString(),
    "CKB"
  );

  fs.writeFileSync("cells.json", JSON.stringify(results, null, 2));

  const csv =
    "txHash,index,capacityCKB,type\n" +
    results
      .map(
        (r) =>
          `${r.txHash},${r.index},${r.capacityCKB},${r.type}`
      )
      .join("\n");

  fs.writeFileSync("cells.csv", csv);
}

main();
```
---

### Observations

- Successfully executed a **real blockchain transaction** on CKB Testnet  
- Verified **Cell Model lifecycle**:
  - Inputs → consumed cells  
  - Outputs → newly created cells  

- Observed:
  - Same lock script = same ownership  
  - Capacity represents stored value inside a cell  
  - Cells act as independent state units  

- Locally validated:
  - Live blockchain data fetching using Lumos  
  - Capacity conversion (Shannons → CKB)  
  - Data export in structured formats (JSON, CSV)  

---

### Next Week Plan (Week 02)

- Implement **State Transition System using CKB Cell Model**

- Design flow:
  - Each Cell represents a state
  - Each transaction represents a state transition  

- Build:
  - Create initial state (Cell with data)
  - Update state by consuming previous cell
  - Generate new cell with updated data  

- Store structured data:
  - Encode JSON → Hex → store in Cell data field  

- Track state history:
  - Link previous transactions (txHash chaining)  
  - Reconstruct full state lifecycle  

- Extend local scripts:
  - Fetch all related cells  
  - Rebuild latest state from history  

- Goal:
  - Deep understanding of:
    - Cell lifecycle (Live → Consumed)
    - State transitions via transactions  
    - On-chain state management

---

### References

- https://docs.nervos.org/docs/tech-explanation/glossary#cell-model
- https://faucet.nervos.org/
- https://testnet.explorer.nervos.org/
- https://testnet.joyid.dev/?asset=Token



