# Week 03

**Date:** 8th – 14th Oct, 2025

---

## Tasks Completed

- Worked through **Lesson 2: CKB Basic Practical Operation** on CKB Academy.
- Completed the hands-on sections:
  - Connect Wallet
  - What is a Transaction?
  - Send a Transaction (manual tx construction & signing)
- Practiced building a raw transaction JSON and examined testnet blocks & live cells.

---

## Courses Completed

1. CKB Basic Practical Operation — **Connect wallet**  
2. CKB Basic Practical Operation — **What is Transaction?**  
3. CKB Basic Practical Operation — **Send a Transaction** (manual flow)

---

## What I did (practical steps)

- Connected my wallet to the **CKB testnet** playground and confirmed the testnet address.
- Checked the **Live Cells** assigned to my wallet (10 cells, each 100 CKB in the playground).
- Inspected recent **testnet blocks** and transactions to see how transactions appear on-chain.
- Manually built a transfer transaction JSON:
  - Selected input live cells (each input points to a previous `tx_hash` + `index`).
  - Created outputs (new cells) and set capacities / lock scripts.
  - Added `cell_deps` (SECP256K1_BLAKE160 + OMNILOCK) as required by the playground.
- Generated the transaction hash locally, then created the witness (signature) with the connected wallet, serialized witnessArgs and inserted it into `witnesses`.
- Sent the signed transaction to CKB testnet and checked the returned `tx_hash` / status.

---

## Main ideas I learned (plain language)

- **Transaction = spend some cells + create new cells.**  
  Everything in CKB is a cell. A transaction destroys (consumes) live cells and makes new ones.

- **Off-chain computing, on-chain verifying.**  
  You can prepare the whole transaction offline (choose inputs/outputs, sign it) and then submit only the final thing to chain — CKB will verify the signature and inputs.

- **Inputs are pointers.**  
  Each input points to a previous output (an `out_point` made of `tx_hash` + `index`) — that’s how the chain knows which cell you’re spending.

- **cell_deps are required code references.**  
  You must include dependency cells (like SECP256K1_BLAKE160, OMNILOCK) in `cell_deps` so validators can load the lock/type code used by your inputs/outputs.

- **Outputs and outputs_data.**  
  Outputs contain new cell info (capacity, lock, type). The binary or textual data for those outputs is kept in `outputs_data` (for performance).

- **Signing → witnesses.**  
  After assembling the raw transaction, you sign it. The signature goes into `witnesses` (usually inside `witnessArgs.lock`) and proves you own the inputs.

---

## Example transaction templates (used in the playground)

Here’s the basic raw transaction template I used / experimented with:

```json
{
  "version": "0x0",
  "headerDeps": [],
  "cellDeps": [
    {
      "outPoint": {
        "txHash": "0xec18bf0d857c981c3d1f4e17999b9b90c484b303378e94de1a57b0872f5d4602",
        "index": "0x0"
      },
      "depType": "code"
    },
    {
      "outPoint": {
        "txHash": "0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37",
        "index": "0x0"
      },
      "depType": "depGroup"
    }
  ],
  "inputs": [],
  "outputs": [],
  "outputsData": [
    "0x"
  ],
  "witnesses": [
    "0x"
  ]
}

