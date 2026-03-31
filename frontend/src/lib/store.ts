import { create } from 'zustand';
import { TxResult } from '@/lib/ckbfs/types';
import { ValidatedBlogPost, validateBlogPostContent } from '@/lib/ckbfs/metadata';
import { publishPost } from '@/lib/ckbfs/publish';
import { appendPost } from '@/lib/ckbfs/append';
import { transferPost } from '@/lib/ckbfs/transfer';
import { forkPost } from '@/lib/ckbfs/fork';
import { fetchUserPosts, CKBFSResolvedData } from '@/lib/ckbfs/indexer';
import { ccc } from '@ckb-ccc/ccc';

// ── DAO Voting ────────────────────────────────────────────────────────────────
export interface VoteRecord {
  upvotes: number;
  flags: number;
  /** address that voted from this browser, or null */
  userVote: 'up' | 'flag' | null;
}

export type NotificationType = 'success' | 'error' | 'info' | 'loading';
export type WalletType = 'CKB' | 'METAMASK' | 'OKX' | null;

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  txHash?: string;
  duration?: number;
}

interface ChainPressStore {
  // Wallet bindings
  walletConnected: boolean;
  walletAddress: string | null;
  walletType: WalletType;
  evmAddress: string | null;
  evmChainId: number | null;
  connectWallet: (address?: string) => Promise<void>;
  connectMetaMask: () => Promise<void>;
  connectOKX: () => Promise<void>;
  disconnectWallet: () => void;
  setWallet: (address: string | null) => void;
  setWalletType: (type: WalletType) => void;

  // Posts
  posts: CKBFSResolvedData[];
  myPosts: CKBFSResolvedData[];
  globalLoading: boolean;
  userLoading: boolean;
  
  loadAllPosts: () => Promise<void>;
  loadMyPosts: (address: string) => Promise<void>;
  globalError: string | null;
  txStatus: 'idle' | 'signing' | 'broadcasting' | 'confirmed';

  // Operations
  publishPost: (signer: ccc.Signer, post: ValidatedBlogPost) => Promise<TxResult>;
  appendPost: (signer: ccc.Signer, txHash: string, outputIndex: number, updated: ValidatedBlogPost) => Promise<TxResult>;
  transferPost: (signer: ccc.Signer, txHash: string, outputIndex: number, newOwner: string) => Promise<TxResult>;
  forkPost: (signer: ccc.Signer, txHash: string, outputIndex: number, content: ValidatedBlogPost) => Promise<TxResult>;

  // Transaction log
  txLog: TxResult[];
  addTxLog: (result: TxResult) => void;

  // Notifications
  notifications: Notification[];
  pushNotification: (n: Omit<Notification, 'id'>) => void;
  dismissNotification: (id: string) => void;

  // DAO Voting
  votes: Record<string, VoteRecord>;
  votePost: (txHash: string, action: 'up' | 'flag', voterAddress: string | null) => void;
  loadVotes: () => void;
}

export const useStore = create<ChainPressStore>((set, get) => ({
  walletConnected: false,
  walletAddress: null,
  walletType: null,
  evmAddress: null,
  evmChainId: null,

  connectWallet: async () => {},
  disconnectWallet: () => set({ walletConnected: false, walletAddress: null, walletType: null, evmAddress: null, evmChainId: null }),
  setWallet: (address) => set({ walletAddress: address, walletConnected: !!address }),
  setWalletType: (type) => set({ walletType: type }),

  connectMetaMask: async () => {
    const { pushNotification } = get();
    const eth = (window as Window & { ethereum?: { request: (args: { method: string }) => Promise<string[]>; chainId?: string; on?: (event: string, cb: (payload: unknown) => void) => void } }).ethereum;
    if (!eth) {
      pushNotification({ type: 'error', message: 'MetaMask not detected. Install MetaMask extension first.', duration: 5000 });
      return;
    }
    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      const address = accounts[0] ?? null;
      const chainIdHex = eth.chainId ?? '0x1';
      const chainId = parseInt(chainIdHex, 16);

      // Listen for account/chain changes
      eth.on?.('accountsChanged', (payload: unknown) => {
        const newAccounts = payload as string[];
        set({ evmAddress: newAccounts[0] ?? null, walletAddress: newAccounts[0] ?? null });
      });
      eth.on?.('chainChanged', (payload: unknown) => {
        const id = parseInt(payload as string, 16);
        set({ evmChainId: id });
        if (id !== 1) {
          get().pushNotification({ type: 'error', message: '⚠️ Wrong network — switch to Ethereum Mainnet', duration: 6000 });
        }
      });

      set({ walletConnected: true, walletAddress: address, evmAddress: address, evmChainId: chainId, walletType: 'METAMASK' });
      pushNotification({ type: 'success', message: `MetaMask connected: ${address?.slice(0, 10)}...`, duration: 4000 });

      if (chainId !== 1) {
        setTimeout(() => get().pushNotification({ type: 'error', message: '⚠️ Wrong network — switch to Ethereum Mainnet', duration: 6000 }), 600);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'MetaMask connection rejected';
      pushNotification({ type: 'error', message: `MetaMask error: ${msg}`, duration: 5000 });
    }
  },

  connectOKX: async () => {
    const { pushNotification } = get();
    const okx = (window as Window & { okxwallet?: { request: (args: { method: string }) => Promise<string[]>; chainId?: string } }).okxwallet;
    if (!okx) {
      pushNotification({ type: 'error', message: 'OKX Wallet not detected. Install OKX Wallet extension first.', duration: 5000 });
      return;
    }
    try {
      const accounts = await okx.request({ method: 'eth_requestAccounts' });
      const address = accounts[0] ?? null;
      const chainIdHex = okx.chainId ?? '0x1';
      const chainId = parseInt(chainIdHex, 16);
      set({ walletConnected: true, walletAddress: address, evmAddress: address, evmChainId: chainId, walletType: 'OKX' });
      pushNotification({ type: 'success', message: `OKX Wallet connected: ${address?.slice(0, 10)}...`, duration: 4000 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OKX connection rejected';
      pushNotification({ type: 'error', message: `OKX error: ${msg}`, duration: 5000 });
    }
  },


  posts: [],
  myPosts: [],
  globalLoading: false,
  userLoading: false,
  globalError: null,
  txStatus: 'idle',

  loadAllPosts: async () => {
    set({ globalLoading: true, globalError: null });
    try {
      const res = await fetch('/api/blogs', { cache: 'no-store' });
      const json = await res.json() as { success: boolean; data: CKBFSResolvedData[]; error?: string };
      // API always returns success:true now; data may be [] on RPC failure.
      // Only treat it as an error if the HTTP request itself failed (success:false).
      if (!json.success) throw new Error(json.error ?? 'Failed to fetch posts');
      set({ posts: json.data, globalLoading: false, globalError: null });
    } catch (e) {
      // Network-level failure — show empty feed, never block the UI.
      console.error('Failed to load global posts', e);
      set({ posts: [], globalLoading: false, globalError: null });
    }
  },

  loadMyPosts: async (address: string) => {
    set({ userLoading: true });
    try {
      const resolved = await fetchUserPosts(address);
      set({ myPosts: resolved, userLoading: false });
    } catch (e) {
      console.error('Failed to load user posts', e);
      set({ userLoading: false });
    }
  },

  publishPost: async (signer, post) => {
    const { pushNotification, addTxLog, loadMyPosts, loadAllPosts } = get();
    set({ txStatus: 'signing' });
    pushNotification({ type: 'loading', message: '✍️ Waiting for wallet signature...', duration: 99999 });

    try {
      const validPost = validateBlogPostContent(post);
      set({ txStatus: 'broadcasting' });
      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      pushNotification({ type: 'loading', message: '📡 Broadcasting transaction...', duration: 99999 });
      const txHash = await publishPost(signer, validPost);

      set({ txStatus: 'confirmed' });
      const result: TxResult = { txHash, operation: 'publish', timestamp: Date.now() };
      addTxLog(result);

      setTimeout(async () => {
        const addressStr = await signer.getRecommendedAddress();
        await loadMyPosts(addressStr);
        await loadAllPosts();
      }, 5000);

      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      pushNotification({ type: 'success', message: `✅ Post published! TX: ${txHash.slice(0, 16)}...`, txHash, duration: 8000 });
      setTimeout(() => set({ txStatus: 'idle' }), 3000);
      return result;
    } catch (error: unknown) {
      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      set({ txStatus: 'idle' });
      const msg = error instanceof Error ? error.message : String(error);
      pushNotification({ type: 'error', message: `Publish failed: ${msg}`, duration: 5000 });
      throw error;
    }
  },

  appendPost: async (signer, txHash, outputIndex, updated) => {
    const { pushNotification, addTxLog, loadMyPosts, loadAllPosts } = get();
    set({ txStatus: 'signing' });
    pushNotification({ type: 'loading', message: '✍️ Waiting for wallet signature...', duration: 99999 });

    try {
      const validPost = validateBlogPostContent(updated);
      set({ txStatus: 'broadcasting' });
      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      pushNotification({ type: 'loading', message: '📡 Broadcasting transaction...', duration: 99999 });
      const newTxHash = await appendPost(signer, txHash, outputIndex, validPost);

      set({ txStatus: 'confirmed' });
      const result: TxResult = { txHash: newTxHash, operation: 'append', timestamp: Date.now() };
      addTxLog(result);

      setTimeout(async () => {
        const addressStr = await signer.getRecommendedAddress();
        await loadMyPosts(addressStr);
        await loadAllPosts();
      }, 5000);

      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      pushNotification({ type: 'success', message: `✅ Version appended! TX: ${newTxHash.slice(0, 16)}...`, txHash: newTxHash, duration: 8000 });
      setTimeout(() => set({ txStatus: 'idle' }), 3000);
      return result;
    } catch (error: unknown) {
      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      set({ txStatus: 'idle' });
      const msg = error instanceof Error ? error.message : String(error);
      pushNotification({ type: 'error', message: `Append failed: ${msg}`, duration: 5000 });
      throw error;
    }
  },

  transferPost: async (signer, txHash, outputIndex, newOwner) => {
    const { pushNotification, addTxLog, loadMyPosts, loadAllPosts } = get();
    set({ txStatus: 'signing' });
    pushNotification({ type: 'loading', message: '✍️ Waiting for wallet signature...', duration: 99999 });

    try {
      set({ txStatus: 'broadcasting' });
      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      pushNotification({ type: 'loading', message: '📡 Broadcasting transfer...', duration: 99999 });
      const newTxHash = await transferPost(signer, txHash, outputIndex, newOwner);

      set({ txStatus: 'confirmed' });
      const result: TxResult = { txHash: newTxHash, operation: 'transfer', timestamp: Date.now() };
      addTxLog(result);

      setTimeout(async () => {
        const addressStr = await signer.getRecommendedAddress();
        await loadMyPosts(addressStr);
        await loadAllPosts();
      }, 5000);

      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      pushNotification({ type: 'success', message: `✅ Cell transferred! TX: ${newTxHash.slice(0, 16)}...`, txHash: newTxHash, duration: 8000 });
      setTimeout(() => set({ txStatus: 'idle' }), 3000);
      return result;
    } catch (error: unknown) {
      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      set({ txStatus: 'idle' });
      const msg = error instanceof Error ? error.message : String(error);
      pushNotification({ type: 'error', message: `Transfer failed: ${msg}`, duration: 5000 });
      throw error;
    }
  },

  forkPost: async (signer, txHash, outputIndex, content) => {
    const { pushNotification, addTxLog, loadMyPosts, loadAllPosts } = get();
    set({ txStatus: 'signing' });
    pushNotification({ type: 'loading', message: '✍️ Waiting for wallet signature...', duration: 99999 });

    try {
      const validPost = validateBlogPostContent(content);
      set({ txStatus: 'broadcasting' });
      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      pushNotification({ type: 'loading', message: '📡 Broadcasting fork...', duration: 99999 });
      const newTxHash = await forkPost(signer, txHash, outputIndex, validPost);

      set({ txStatus: 'confirmed' });
      const result: TxResult = { txHash: newTxHash, operation: 'fork', timestamp: Date.now() };
      addTxLog(result);

      setTimeout(async () => {
        const addressStr = await signer.getRecommendedAddress();
        await loadMyPosts(addressStr);
        await loadAllPosts();
      }, 5000);

      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      pushNotification({ type: 'success', message: `✅ Fork created! TX: ${newTxHash.slice(0, 16)}...`, txHash: newTxHash, duration: 8000 });
      setTimeout(() => set({ txStatus: 'idle' }), 3000);
      return result;
    } catch (error: unknown) {
      set(s => ({ notifications: s.notifications.filter(n => n.type !== 'loading') }));
      set({ txStatus: 'idle' });
      const msg = error instanceof Error ? error.message : String(error);
      pushNotification({ type: 'error', message: `Fork failed: ${msg}`, duration: 5000 });
      throw error;
    }
  },

  txLog: [],
  addTxLog: (result) => set(s => ({ txLog: [result, ...s.txLog].slice(0, 50) })),

  notifications: [],
  pushNotification: (n) => {
    const id = Math.random().toString(36).slice(2);
    set(s => ({ notifications: [...s.notifications, { ...n, id }] }));
    if (n.duration && n.duration < 99999) {
      setTimeout(() => {
        set(s => ({ notifications: s.notifications.filter(x => x.id !== id) }));
      }, n.duration);
    }
  },
  dismissNotification: (id) =>
    set(s => ({ notifications: s.notifications.filter(n => n.id !== id) })),

  // ── DAO Voting ──────────────────────────────────────────────────────────────
  votes: {},

  loadVotes: () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('cp_votes') : null;
      if (raw) set({ votes: JSON.parse(raw) as Record<string, VoteRecord> });
    } catch { /* ignore parse errors */ }
  },

  votePost: (txHash, action, voterAddress) => {
    const existing: VoteRecord = get().votes[txHash] ?? { upvotes: 0, flags: 0, userVote: null };
    let next: VoteRecord;

    if (existing.userVote === action) {
      // Toggle off same vote
      next = {
        upvotes: action === 'up'   ? Math.max(0, existing.upvotes - 1) : existing.upvotes,
        flags:   action === 'flag' ? Math.max(0, existing.flags - 1)   : existing.flags,
        userVote: null,
      };
    } else {
      // Remove old vote if switching
      const revertUp   = existing.userVote === 'up'   ? Math.max(0, existing.upvotes - 1) : existing.upvotes;
      const revertFlag = existing.userVote === 'flag' ? Math.max(0, existing.flags - 1)   : existing.flags;
      next = {
        upvotes:  action === 'up'   ? revertUp + 1   : revertUp,
        flags:    action === 'flag' ? revertFlag + 1 : revertFlag,
        userVote: action,
      };
    }

    const updated = { ...get().votes, [txHash]: next };
    set({ votes: updated });
    try { localStorage.setItem('cp_votes', JSON.stringify(updated)); } catch { /* ignore quota errors */ }

    void voterAddress; // reserved for future on-chain vote tx
  },
}));
