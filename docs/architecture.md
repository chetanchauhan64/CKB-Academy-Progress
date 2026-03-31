# ChainPress Architecture

## System Layers

```
Frontend (Next.js)
        ↓
Wallet (CCC SDK — JoyID / MetaMask)
        ↓
CKB Blockchain (CKBFS storage)
        ↓
Indexer (Reconstructs posts + media)
        ↓
Frontend Rendering
```

---

## Storage Model

| Layer | What is stored | Where |
| :--- | :--- | :--- |
| **Cell Data** | `content_type`, `filename`, `checksum`, `backlinks[]` | On-chain `outputData` field |
| **Witnesses** | Full markdown payload (`<CKBFS><0x00><BYTES>`) | On-chain `witnesses[]` array |
| **Type Script** | Deterministic `TYPE_ID` — post identity | `output.type.args` |
| **Lock Script** | Wallet address / owner identity | `output.lock` |

---

## CKBFS Operation Map

```
PUBLISH   → New Cell + New Witness (genesis, backlinks=[])
APPEND    → Consume Old Cell → New Cell + New Witness + BackLink appended
TRANSFER  → Consume Old Cell → New Cell (lock changed, index=null, checksum unchanged)
FORK      → Old Cell as CellDep → Brand New Cell (new TYPE_ID, inherits backlinks + adds new one)
```

---

## Versioning via Backlinks

```
Genesis TX (v1)
   └─ backlinks: []

Append TX (v2)
   └─ backlinks: [{ tx_hash: v1, index: witnessIdx, checksum: adler32(v1) }]

Append TX (v3)
   └─ backlinks: [
        { tx_hash: v1, index: ..., checksum: adler32(v1) },
        { tx_hash: v2, index: ..., checksum: adler32(v2) }
      ]
```

Adler32 checksums are chained: `checksum_vN = Adler32(content_vN, seed=checksum_v(N-1))`

---

## Decentralized Media (`ckbfs://`)

```
Upload:
  File → Uint8Array → 150 KB Chunks → PUBLISH Genesis + APPEND chains
  Final URI: ckbfs://headTxHash:witnessIndex

Resolve:
  Parse URI → Fetch Head TX → Read backlinks → Walk backward
  → Collect all witness chunks → Reverse → Concat → Validate Adler32
  → Buffer.toString('base64') → data:image/png;base64,...
```

---

## Key Packages

| Package | Purpose |
| :--- | :--- |
| `@ckb-ccc/ccc` | Transaction building, signing, RPC |
| `@ckb-ccc/connector-react` | Wallet modal provider |
| `adler-32` | Checksum computation |
| `zod` | Metadata schema validation |
| `zustand` | Frontend state management |
