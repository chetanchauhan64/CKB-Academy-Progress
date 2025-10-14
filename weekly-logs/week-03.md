# Week 03

**Date:** 8th – 14th Oct, 2025

---

## Tasks Completed

- Finished 1 Course on CKB Academy:

 <table style="width:100%; text-align:center;">
  <tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
      <img width="1919" height="970" alt="PhotoshopExtension_Image (5)" src="https://github.com/user-attachments/assets/ac3e7b62-a855-45f6-949f-0648bd45ba1a" /> 
      <p style="text-align:center;">1. <a href="https://academy.ckb.dev/courses/basic-operation">Basic Operation Course</a></p>
    </td>
  </tr>
</table>

• Covered these tech-terms by courses & docs:
• CKB Transaction structure: inputs, outputs, cellDeps, witnesses
• Learnt basic transaction flow on CKB (creating, destroying, managing cells).

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

## Related Snapshots (for notes)  
<table style="width:100%; text-align:center;">
  <tr>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
     <img width="1470" height="923" alt="Screenshot 2025-10-14 at 11 24 32 PM" src="https://github.com/user-attachments/assets/974c82ba-ff0b-4477-99b4-a6e148c7e8e0" /> 
      <p style="text-align:center;">Connected my wallet </p>
    </td>
  </tr>
</table>

<table style="width:100%; text-align:center;">
  <tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
      <img width="1470" height="956" alt="Screenshot 2025-10-14 at 10 29 51 PM" src="https://github.com/user-attachments/assets/e8c85038-6fb9-46ec-baab-d5b1c08a593f" />
      <p style="text-align:center;">CKB Address on Testnet</p>
    </td>
    <td style="width:50%; vertical-align:top; text-align:center;">
     <img width="1813" height="1031" alt="PhotoshopExtension_Image (6)" src="https://github.com/user-attachments/assets/a0a0d2c3-59e3-4b2a-b88e-c0274ae7384e" /> 
      <p style="text-align:center;">Transferred 90 CKB</p>
    </td>
  </tr>
</table>

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













