<div align="center">
  <div style="font-size: 64px; margin-bottom: 20px;">⛓</div>
  <h1>ChainPress</h1>
  <h3>Decentralized, Wallet-Native Publishing built purely on Nervos CKBFS</h3>
  <p><i>Submitting to the CKB Bitcoin Scale Hackathon 2026</i></p>
  
  <br />
  
  ![Demo Screenshot 1 Placeholder](https://via.placeholder.com/800x400/1e1e24/00d4aa?text=ChainPress+Dashboard+Preview)
</div>

---

## 🏆 Project Vision

**ChainPress** is an autonomous, WordPress-style publishing platform deployed 100% on the **Nervos CKB Testnet**. 

Instead of relying on centralized servers or databases like AWS, Postgres, or MongoDB, ChainPress utilizes the **CKBFS (CKB File System) Protocol**. Every blog post, edit history, and cover image is a unique CKB Asset (Cell), cryptographically signed and stored immutably directly inside the blockchain's `witness` and `cell_data` parameters!

---

## 🏗 Architecture Diagram

```mermaid
graph TD
    A[Next.js Frontend] -->|Zustand Store| B(@ckb-ccc/ccc SDK)
    B -->|Builds Tx| C[Wallet Provider]
    C -->|JoyID / EVM Sign| D(CKB Testnet RPC)
    
    subgraph CKBFS Protocol Layer
    D --> E[CKBFS TypeScript Indexer]
    E --> F{Prefix Search}
    F -->|Match TYPE_ID| G[Parse Cell Data]
    G --> H[Extract Backlinks]
    H --> I[Reconstruct Witness bytes]
    end
    
    I -->|JSON Parse| J[Render Post & History]
```

---

## 🧬 How CKBFS Works in ChainPress

The CKB File System maps traditional computer file structures (like files and symlinks) into the limitations of Nervos Cell UTXOs. 

1. **Cell Identity (TYPE_ID):** When you publish, a `Type Script` is assigned. This creates an un-duplicatable Identity so that `Post 1` is always recognized globally as `Post 1`.
2. **Immutable Metadata:** The `Cell Data` stores strict properties: `content_type` ("text/markdown") and `filename` ("blog-post.json"). Once set, CKB Contract rules enforce they **cannot be changed**.
3. **Payload Storage:** Storing massive bodies of text inside standard Cell Capacity is extremely expensive. Therefore, we encode the physical markdown bytes wrapped in a `<CKBFS><0x00>` magic header directly into the **Transaction Witnesses**.

---

## 🕰 How Versioning Works (The `APPEND` Feature)

ChainPress natively supports Git-like version histories. When an author edits a post, they do not "overwrite" the previous state—they **APPEND** to it.

1. **Backlink Rewinding:** CKBFS cells maintain a strictly append-only `backlinks` array. When updating a post, the `tx_hash` and `index` of the *previous* version is pushed into this array. 
2. **Chained Adler32 Checksums:** To prevent malicious tampering of a post's history, the checksum of an appended cell equals `Hash(New Content + Previous Checksum)`. 
3. **Frontend Resolution:** Our `indexer.ts` scans the latest Cell, traces the backward chain of backlinks via RPC, validates every hash along the way, and dynamically paints a full `🕰 History` tab for the reader.

---

## 🖼 How Decentralized Media Works

We eliminated centralized S3 bucket dependencies by scaling CKBFS for binary files!

![Media Upload Flow Placeholder](https://via.placeholder.com/800x300/1e1e24/00d4aa?text=Decentralized+Chunk+Uploading)

1. **Chunking Engine:** When an image (e.g., 500 KB) is uploaded, our `<media.ts>` module splits the `Uint8Array` into `150 KB` chunks to adhere to CKB network P2P limits.
2. **Sequential Append:** It publishes Chunk 1 (Genesis), then automatically chains `APPEND` transactions for Chunk 2, 3, etc.
3. **`ckbfs://` URI Protocol:** The post's JSON metadata saves the head transaction: `"cover_image": "ckbfs://0xad3f...:0"`.
4. **Base64 Assembly:** When a reader views the post, our frontend resolver traverses the backlinks backward to gather the chunks, merges the bytes sequentially, verifies the grand Adler32 sum, and converts it into a `data:image/png;base64,...` URL. 

---

## 🎭 Demo Flow (Judging Steps)

Want to test ChainPress yourself? Follow this happy path on the CKB Testnet:

1. **Connect Wallet:** Click "Connect Wallet" natively in the top-right header layout. Use MetaMask or JoyID (Pudge Testnet).
2. **Publish Genesis Post:** Navigate to `/write`, draft a markdown article with tags, and hit "Publish". You'll sign the payload and wait for RPC confirmation!
3. **Browse Global Feed:** Navigate back to the Home page `/`. Real indexers will pick up your `TYPE_ID` instantly!
4. **Append a Version:** Inside the post, click `🔗 Append Version`. Make edits to your Markdown, and hit Save.
5. **Inspect the Cell Data:** Click the `🧬 Cell Data` and `🕰 History` tabs on the frontend to visually trace the exact `backlink` chain and view the chained Adler32 checksum recalculations in real-time.
6. **Fork It:** Sign in with a secondary wallet account, load the post, and hit `🍴 Fork`. Watch how the application binds the origin's `tx_hash` as an immutable CellDep while generating a fresh author state.

<br/>

![Post Detail UI Placeholder](https://via.placeholder.com/800x450/1e1e24/00d4aa?text=Viewing+Live+CKBFS+Post)

---

### Built By
*Designed & engineered rapidly for Nervos Ecosystem.*
