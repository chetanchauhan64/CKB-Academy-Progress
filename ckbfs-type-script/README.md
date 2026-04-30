# CKBFS — Decentralized File Storage on Nervos CKB

> Store any file permanently on the Nervos CKB blockchain using a UTXO-based chunk model.
> Production-ready dApp with multi-wallet support, RPC-first validation, and retry resilience.

[![Testnet](https://img.shields.io/badge/network-Pudge%20Testnet-brightgreen)](https://pudge.explorer.nervos.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![JoyID](https://img.shields.io/badge/wallet-JoyID-purple)](https://joy.id)
[![Vercel](https://img.shields.io/badge/deployed-Vercel-black)](https://ckbfs-app.vercel.app)

---

## Description

**CKBFS** (CKB File Storage System) is a decentralized file storage protocol built on [Nervos CKB](https://nervos.org). Files are split into chunks, each stored as a cell on-chain with a custom Type Script validator. The system supports full file lifecycle management — upload, update, consume (reclaim CKB) — and reconstructs file content directly from live cells.

Built as a production-grade Week 20 project for the CKB Academy, demonstrating advanced on-chain storage patterns, RPC-first validation, and multi-wallet integration.

---

## Features

| Feature | Details |
|---|---|
| **Multi-file support** | Unique `fileId` per file; all files per wallet tracked independently |
| **Chunk-based storage** | Large files split into ≤32 KB chunks, each stored as a separate CKB cell |
| **Full file lifecycle** | Upload → Update → Consume (reclaim CKB capacity) |
| **RPC-first validation** | `get_live_cell` is the sole truth for cell liveness — never blocked by indexer lag |
| **Retry + jitter** | Progressive backoff (2s + 500ms/attempt) with 0–500ms random jitter to avoid retry storms |
| **Hybrid indexing** | Indexer for discovery, RPC for liveness/confirmation — eventual consistency handled gracefully |
| **File viewer** | On-chain file reconstruction and display in-browser |
| **Upgradeable script** | `SCRIPT_VERSION` constant + dep_group toggle for zero-downtime upgrades |
| **JoyID wallet** | Biometric passkey signing via popup — no seed phrase, no extension |
| **Private key** | Server-side signing for development/CI |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CKBFS dApp                              │
│                                                                 │
│  Browser (Next.js 14)                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │  FileUpload │───▶│  useCkbfs    │───▶│  WalletAdapter    │  │
│  │  Dashboard  │    │  (hook)      │    │  JoyID / PrivKey  │  │
│  │  FileViewer │◀───│  pollTxCommit│    └────────┬──────────┘  │
│  └─────────────┘    └──────┬───────┘             │ signTx      │
│                             │ build/broadcast      ▼            │
│                    ┌────────▼──────────────────────────────┐   │
│                    │       Next.js API Routes               │   │
│                    │  /api/tx/create   /api/tx/update       │   │
│                    │  /api/tx/consume  /api/tx/broadcast    │   │
│                    └────────┬──────────────────────────────┘   │
└─────────────────────────────│───────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
     │  CKB Indexer│  │  CKB RPC     │  │  CKB Network │
     │  (discovery)│  │  (liveness)  │  │  (consensus) │
     │  get_cells  │  │ get_live_cell│  │   Pudge/     │
     │  eventual   │  │ get_tx       │  │   Aggron4    │
     │  consistency│  │ send_tx      │  │              │
     └─────────────┘  └──────────────┘  └──────────────┘
```

### Transaction Flow

1. **Client** selects file → React hook (`useCkbfs`) calls `/api/tx/create`
2. **Server** (`txBuilder.ts`) fetches live cells from Indexer, validates each via `get_live_cell` RPC
3. **Server** builds raw unsigned CKB transaction (correct cell deps, witness placeholders)
4. **Client** passes raw tx to wallet adapter → JoyID popup signs → returns signed tx
5. **Client** sends `{ rawTx, signedTx }` to `/api/tx/broadcast` for integrity check + broadcast
6. **Client** polls `get_transaction` until `status: committed` → updates UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5 |
| **Blockchain** | Nervos CKB — Pudge Testnet (Aggron4) |
| **CKB SDK** | `@ckb-lumos/lumos` — address parsing, script hashing |
| **JoyID SDK** | `@joyid/ckb` v1.1.4 — biometric wallet popup signing |
| **On-chain script** | Rust Type Script (custom CKBFS validator) |
| **Encoding** | 42-byte binary header with SHA-256 file hash |
| **Styling** | Vanilla CSS — glassmorphism dark design system |

---

## How It Works

### File → Chunks → Cells

```
File (any size)
  │
  ▼
splitIntoChunks(32KB each)
  │
  ▼
encodeCellData(chunk, metadata)  ← 42-byte header + content
  ├─ bytes [0..3]   flags (0x01=partial, 0x02=final)
  ├─ bytes [4..5]   chunk index (u16 LE)
  ├─ bytes [6..7]   total chunks (u16 LE)
  ├─ bytes [8..9]   reserved
  ├─ bytes [10..41] SHA-256 hash of full file content
  └─ bytes [42..]   raw chunk content
  │
  ▼
CKB Cell per chunk
  ├─ lock:  owner's address lock script
  ├─ type:  CKBFS type script { code_hash, hash_type, args: [owner_lock_hash][file_id] }
  └─ data:  encoded chunk bytes
```

### RPC-First Validation

The indexer is used **only for discovery** (`get_cells`). Before including any cell in a transaction, the server calls `get_live_cell` on the primary RPC:

```
status === 'live'  → ✅ safe to use as input
status === 'dead'  → ❌ already spent, skip
status === 'unknown' → ❌ not yet propagated, skip
```

This eliminates false-positive "Unknown OutPoint" errors caused by indexer lag.

### Retry Logic

```
for attempt 1..10:
  cells = selectInputCells()          ← RPC-validated
  if cells found → build tx → break
  
  baseDelay = 2000 + attempt * 500    ← progressive (2.0s → 6.5s)
  jitter    = random(0, 500)          ← prevents retry storms
  sleep(baseDelay + jitter)
```

### Metadata Indexing

Each file's metadata (name, size, chunks, txHash) is stored in `localStorage` immediately after upload. This decouples the UI from indexer sync delays — the file list is always up-to-date even before the indexer has processed the transaction.

### JoyID Wallet Format Conversion

JoyID's `signRawTransaction` expects **camelCase CKBTransaction** format. Our server builds snake_case RPC format. The adapter performs a full bidirectional conversion:

```
CKB RPC (snake_case)    →  JoyID (camelCase)
────────────────────────────────────────────
cell_deps               →  cellDeps
out_point.tx_hash       →  outPoint.txHash
dep_type: 'dep_group'   →  depType: 'depGroup'
previous_output         →  previousOutput
outputs_data            →  outputsData
code_hash / hash_type   →  codeHash / hashType
```

After signing, the result is converted back before broadcast.

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- A JoyID account (testnet) OR a CKB testnet private key
- CKB testnet balance ([Faucet](https://faucet.nervos.org/))

### Install

```bash
cd ckbfs-type-script/frontend
npm install
```

### Environment Variables

Create `frontend/.env.local`:

```env
# CKB Testnet RPC (primary node — also serves as indexer)
NEXT_PUBLIC_CKB_RPC_URL=https://testnet.ckb.dev
NEXT_PUBLIC_INDEXER_URL=https://testnet.ckb.dev

# CKBFS Type Script deployment (Pudge testnet)
NEXT_PUBLIC_CKBFS_CODE_HASH=<your_deployed_script_code_hash>
NEXT_PUBLIC_CKBFS_TX_HASH=<deployment_tx_hash>
NEXT_PUBLIC_CKBFS_OUT_INDEX=0x0

# JoyID testnet app URL
NEXT_PUBLIC_JOYID_URL=https://testnet.joyid.dev

# (Optional) Dev-only private key signing
PRIVATE_KEY=<0x_prefixed_private_key>

# (Optional) dep_group upgrade support
NEXT_PUBLIC_CKBFS_USE_DEP_GROUP=false
```

### Run

```bash
npm run dev
```

App runs at **http://localhost:3000**

### Build

```bash
npm run build
npm start
```

---

## Deployment

Deployed via **Vercel** as a subfolder project:

1. Set root directory to `ckbfs-type-script/frontend` in Vercel settings
2. Add all `.env.local` variables as Vercel Environment Variables
3. Vercel auto-detects Next.js and deploys with zero config

---

## Wallet Support

| Wallet | Type | How it signs |
|---|---|---|
| **JoyID** | Recommended | Biometric passkey via popup (`signRawTransaction`) |
| **UniPass** | Email | Enter your testnet `ckt1…` address (demo/read mode) |
| **Private Key** | Dev only | Server-side signing via `PRIVATE_KEY` env var |

---

## Key Technical Insights

### 1. RPC vs Indexer
> The CKB Indexer is eventually consistent. Transactions that were just broadcast may not appear in indexer results for several seconds. **CKBFS uses `get_live_cell` from the primary RPC as the sole source of truth for cell liveness** — the indexer is only used for initial discovery.

### 2. Correct JoyID Cell Dep (Pudge Testnet)
> The `@joyid/ckb` SDK's `getJoyIDCellDep(false)` returns an **outdated/spent** tx on Pudge. The correct live dep group (confirmed by querying actual JoyID-signed transactions on Aggron4) is:
> `0x636a786001f87cb615acfcf408be0f9a1f077001f0bbc75ca54eadfe7e221713 : 0x0`

### 3. Molecule Witness Placeholder
> JoyID's `signRawTransaction` parses witnesses using the molecule codec. A bare `0x` witness (0 bytes) crashes with "Invalid buffer length: 0, should be 4". Witnesses must be pre-filled with a valid empty `WitnessArgs` molecule: `0x10000000100000001000000010000000` (16 bytes).

### 4. Cell Dep Selection by Wallet Type
> The transaction's `cell_deps` must include the lock script of the signing wallet. For secp256k1 wallets, use `0xf8de3bb4...` (Aggron4 genesis dep). For JoyID wallets, use `0x636a7860...`. The builder auto-detects by comparing `lockScript.codeHash`.

---

## Project Structure

```
ckbfs-type-script/
├── src/                        # Rust on-chain Type Script
│   ├── entry.rs                # Main entry point + state machine
│   ├── cell_data.rs            # 42-byte binary cell data layout
│   ├── error.rs                # On-chain error codes
│   └── hash.rs                 # Blake2b hash utilities
│
└── frontend/                   # Next.js dApp
    ├── app/
    │   ├── api/tx/             # Server-side tx builder API routes
    │   │   ├── create/         # Build CREATE transaction
    │   │   ├── update/         # Build UPDATE transaction
    │   │   ├── consume/        # Build CONSUME transaction
    │   │   ├── broadcast/      # Integrity check + RPC broadcast
    │   │   └── status/         # Transaction confirmation polling
    │   ├── globals.css         # Design system (glassmorphism dark)
    │   └── page.tsx            # Main SPA shell
    ├── components/
    │   ├── FileUpload.tsx       # Drag-drop upload with chunk preview
    │   ├── Dashboard.tsx        # File grid + stats
    │   ├── FileCard.tsx         # Per-file card with lifecycle actions
    │   ├── WalletModal.tsx      # Wallet selection modal
    │   └── TxStatus.tsx         # Toast-based tx state display
    ├── hooks/
    │   └── useCkbfs.ts          # Core tx lifecycle hook
    ├── services/
    │   ├── txBuilder.ts         # Cell selection, tx construction
    │   └── indexer.ts           # Indexer + RPC wrappers
    ├── wallets/
    │   ├── JoyIDAdapter.ts      # JoyID popup signing + format conversion
    │   └── PrivateKeyAdapter.ts # Dev server-side signing
    └── utils/
        └── encoding.ts          # Cell data binary encoding/decoding
```

---

## 🌐 Live Demo

**Production URL:** [https://ckbfs-app.vercel.app](https://ckbfs-app.vercel.app)

> Deployed on Vercel · Connected to Nervos CKB Pudge Testnet · Supports JoyID + Private Key wallets

---

## License

MIT — built for educational purposes as part of the CKB Academy Week 20 project.

---

*Built with ❤️ on Nervos CKB Pudge Testnet*
