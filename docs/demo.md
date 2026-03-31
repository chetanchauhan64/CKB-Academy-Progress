# ChainPress Demo Flow

## Happy Path (Judging Steps)

### Step 1 — Connect Wallet
- Click **"Connect Wallet"** in the top-right header
- Use MetaMask (EVM) or JoyID (Passkey) on the CKB Testnet (Pudge)
- Your CKB address becomes your **permanent author identity** — no email required

### Step 2 — Create Blog Post
- Navigate to `/write`
- Fill in Title, Tags, optional Summary, and Markdown Body
- Watch the **live Adler32 checksum** that updates in real-time as you type

### Step 3 — Publish (on-chain via CKBFS)
- Click **🚀 Publish to CKBFS**
- Sign the transaction in MetaMask / JoyID
- A real `publish.ts` transaction is built:
  - `output[0]` = new CKBFS cell with TYPE_ID
  - `witnesses[N]` = `<CKBFS><0x00><JSON_BYTES>`
  - Cell Data = `{ content_type, filename, checksum, backlinks: [] }`

### Step 4 — View Global Feed
- Navigate back to `/` (Home)
- The CKBFS Indexer scans the Testnet for all cells matching the CKBFS Type ID
- New post appears in the feed in real-time

### Step 5 — Append (Update Post)
- Open the post you published
- Click **🔗 Append Version**
- Make edits to the Markdown
- Click **🔗 Append to CKBFS** and sign
- The `append.ts` builder:
  - Consumes the previous cell as input
  - Pushes the old `tx_hash + index + checksum` into `backlinks[]`
  - Stores new markdown bytes in the new witness
  - Chains the Adler32 checksum: `newChecksum = Adler32(newBytes, prevChecksum)`

### Step 6 — View Version History
- On the post page, click the **🕰 History** tab
- See every version recreated from the backlink chain
- Each entry shows: `tx_hash`, `checksum`, and `witness index`

### Step 7 — Upload Image (Chunked Storage)
- On the write page, use the image upload field
- `uploadImage(file, signer)` fires:
  - Splits image into ≤150 KB chunks
  - Publishes Genesis chunk as a new CKBFS cell
  - Appends remaining chunks using the CKBFS APPEND protocol
- Returns URI: `ckbfs://0xabcdef...:1`
- UI saves this into `metadata.cover_image`

### Step 8 — View Reconstructed Media
- Open a post with a `ckbfs://` cover image
- `resolveCKBFSMedia()` fires:
  - Parses `txHash` and `witnessIndex` from URI
  - Fetches Head TX → reads backlinks → walks backward to Genesis
  - Merges all byte chunks in correct order
  - Validates cumulative Adler32 checksum
  - Returns `data:image/png;base64,...` inline to `<img />` tag

---

## Additional Operations

### Fork a Post
- Open any post → click **🍴 Fork Post**
- A new CKBFS cell is created with a **fresh TYPE_ID**
- Original cell is referenced as a `CellDep` (read-only, NOT consumed)
- All backlinks inherited + a new entry pointing to source

### Transfer Ownership
- Open your post → click **📤 Transfer Cell**
- Enter the recipient's CKB address
- `transfer.ts` changes the `lock` script (owner), sets `index = null`
- Checksum remains **unchanged** per CKBFS protocol

---

## On-chain Verification

Every transaction can be verified on the CKB Testnet Explorer:
- `https://pudge.explorer.nervos.org/transaction/<txHash>`
