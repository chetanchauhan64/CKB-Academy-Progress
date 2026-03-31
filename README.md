# ⛓ ChainPress — Decentralized Publishing on Nervos CKB

> A wallet-native, WordPress-style publishing platform built on the **Nervos CKB** blockchain using the **CKBFS protocol**. Every post is permanent, censorship-resistant, and stored on-chain.

---

**Deployed on Vercel:** [https://ckb-academy-progress.vercel.app/](https://ckb-academy-progress.vercel.app/)

---
## Dashboard

## ✨ Features

| Feature | Description |
|---|---|
| 📝 **On-Chain Publishing** | Blog posts stored as CKBFS witnesses with Adler32 checksum validation |
| 🔗 **Append-Only Versioning** | Immutable backlink tree — every edit creates a new cell, history never deleted |
| 🌳 **Version Tree** | Visual branch/fork explorer with node navigation |
| 🔒 **Paid Content** | Reader-unlockable posts via CKB tip transactions |
| 🤖 **AI Writing Assist** | Claude 3 Haiku via OpenRouter — improve, title, summarize |
| 🗳️ **DAO Voting** | Upvote / flag system with score-based trending ranking |
| 🔐 **Multi-Wallet Support** | JoyID (CKB native), MetaMask, OKX |
| 📡 **RPC Fallback** | Auto-retry across multiple CKB testnet endpoints with 10s timeout |
| 📱 **Mobile Responsive** | Touch-friendly, single-column feed on mobile |
| ⚡ **Performance** | React.memo, debounced search, route-level skeletons, top progress bar |

---

## 🛠 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Blockchain:** Nervos CKB Testnet via `@ckb-ccc/ccc`
- **Protocol:** CKBFS (CKB File System) — witness-based storage
- **AI:** OpenRouter API (Claude 3 Haiku + Mixtral fallback)
- **State:** Zustand
- **Styling:** Vanilla CSS (dark theme, glassmorphism)
- **Fonts:** Inter + JetBrains Mono + Playfair Display

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/chetanchauhan64/CKB-Academy-Progress.git
cd CKB-Academy-Progress/ChainPress/frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
# Then edit .env.local and add your OpenRouter API key
```

`.env.local`:
```env
# Get your key at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-...
```

> **Note:** Leave `OPENROUTER_API_KEY` empty to use mock AI mode — the app works fully without it.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
ChainPress/
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── api/
    │   │   │   ├── ai/route.ts          # OpenRouter AI endpoint
    │   │   │   ├── blogs/route.ts       # Feed API (RPC fallback)
    │   │   │   └── blog/[txHash]/       # Single post API
    │   │   ├── post/[txHash]/page.tsx   # Post reader page
    │   │   ├── write/page.tsx           # Editor/publish page
    │   │   ├── dashboard/page.tsx       # Author dashboard
    │   │   ├── forks/page.tsx           # Fork explorer
    │   │   ├── profile/page.tsx         # Author profile
    │   │   ├── loading.tsx              # Route-level skeleton
    │   │   └── layout.tsx              # Root layout + footer + progress bar
    │   ├── components/
    │   │   ├── Editor.tsx              # Markdown editor + AI assist modal
    │   │   ├── PostCard.tsx            # Feed card (React.memo)
    │   │   ├── Header.tsx              # Nav + wallet pill
    │   │   ├── VersionTree.tsx         # Branch visualizer
    │   │   ├── TopProgressBar.tsx      # Route transition bar
    │   │   └── NotificationToasts.tsx  # Toast notification system
    │   └── lib/
    │       ├── ckbfs/
    │       │   ├── client.ts           # RPC client with URL fallback
    │       │   ├── indexer.ts          # fetchAllPosts + fetchWithRetry
    │       │   ├── publish.ts          # CKBFS publish transaction
    │       │   ├── append.ts           # CKBFS append transaction
    │       │   ├── metadata.ts         # Zod schema for ValidatedBlogPost
    │       │   ├── checksum.ts         # Adler32 implementation
    │       │   └── witness.ts          # Witness encoding/decoding
    │       └── store.ts               # Zustand global state
    ├── .env.local                     # API keys (gitignored)
    └── next.config.mjs
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Optional | OpenRouter key for real AI. Mock mode if empty. |

---

## 🔗 CKBFS Protocol

ChainPress uses the CKBFS protocol to store blog posts permanently on Nervos CKB:

```
Witness layout:
CKBFS | 0x00 | JSON payload

JSON payload (ValidatedBlogPost):
{
  title, content, description, tags,
  author, created_at, updated_at,
  is_paid?, unlock_price?
}

Checksum: Adler32 over UTF-8 encoded witness bytes
```

Backlinks form an immutable version chain — each append references all previous tx hashes.

---

## 🤖 AI Writing Assist

The `✨ AI Assist` button in the editor uses **Claude 3 Haiku** (via OpenRouter) with automatic fallback to **Mixtral 8x7b** if Claude is unavailable:

- **Improve Content** — rewrites for clarity and engagement
- **Generate Title** — 3 headline options, click to apply
- **Write Summary** — 160-char feed description

Without an API key, the app runs in **mock mode** with demo responses.

---

## 🏗 Architecture Decisions

- **No server-side data fetching** — all CKBFS reads happen in client-only API routes to avoid Next.js fetch cache limits (responses can be >2MB)
- **RPC Fallback** — `fetchWithRetry` cycles through multiple CKB testnet endpoints with a 10s timeout per attempt
- **Graceful degradation** — `/api/blogs` always returns `{ success: true, data: [] }` on failure; the UI shows "No posts found" instead of crashing
- **Rules of Hooks** — all `useState`/`useEffect` hooks are at the top level of components, before any conditional early returns

---

## 📜 License

MIT — Built for the **CKB Academy** learning program.

---

> _"Your words, permanently on-chain."_ ⛓
