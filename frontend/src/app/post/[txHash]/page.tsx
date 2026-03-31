'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { useStore } from '@/lib/store';
import type { VoteRecord } from '@/lib/store';
import { CKBFSResolvedData, buildVersionTreeWithForks, VersionNode } from '@/lib/ckbfs/indexer';
import { VersionEntry } from '@/lib/ckbfs/types';
import VersionHistory from '@/components/VersionHistory';
import VersionTree from '@/components/VersionTree';
import { marked } from 'marked';
import { ccc } from '@ckb-ccc/connector-react';
import { runPostSecurityChecks, PostSecurityReport } from '@/lib/ckbfs/security';

function shortAddr(addr: string): string {
  return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
}

function formatTime(ts: number | undefined): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy to clipboard">
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  );
}

type PageParams = { txHash: string }

export default function PostPage({ params }: { params: PageParams }) {
  const { txHash } = params;
  const { walletAddress, walletConnected, pushNotification, votes, votePost, loadVotes } = useStore();

  const [post, setPost] = useState<CKBFSResolvedData | null>(null);
  const [treeRoot, setTreeRoot] = useState<VersionNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'history' | 'tree' | 'cell'>('content');

  // Action modals
  const [showTransfer, setShowTransfer] = useState(false);
  const [showFork, setShowFork] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [transferAddr, setTransferAddr] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  // Tip state
  const [tipAmount, setTipAmount] = useState('10');
  const [tipStatus, setTipStatus] = useState<'idle' | 'signing' | 'broadcasting' | 'confirmed'>('idle');
  const [tipTxHash, setTipTxHash] = useState<string | null>(null);
  // Paid content unlock
  const [unlocked, setUnlocked] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState<'idle' | 'signing' | 'broadcasting' | 'confirmed'>('idle');
  // ── ALL HOOKS MUST BE AT TOP LEVEL — BEFORE ANY EARLY RETURN ———————————
  // Paid content: session unlock persisted in sessionStorage.
  // MUST live here — not below early-return boundaries — to satisfy Rules of Hooks.
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  // Copy link state — also at top level
  const [linkCopied, setLinkCopied] = useState(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('cp_unlocked') ?? '[]') as string[];
      if (stored.includes(txHash)) setSessionUnlocked(true);
    } catch { /* ignore */ }
  }, [txHash]);

  // CCC signer
  const signer = ccc.useSigner();

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    async function resolveOnChain() {
      setLoadError(null);
      setNotFound(false);
      try {
        // Fetch this specific post — abort after 10s if RPC hangs
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 10000);
        const postRes = await fetch(`/api/blog/${txHash}`, {
          cache: 'no-store',
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
        const postJson = await postRes.json() as { success: boolean; data: CKBFSResolvedData; error?: string };

        if (!postJson.success) {
          if (postRes.status === 404 || (postJson.error ?? '').toLowerCase().includes('not found')) {
            setNotFound(true);
          } else {
            setLoadError(postJson.error ?? 'Failed to load post');
          }
          return;
        }
        const resolvedPost = postJson.data;
        setPost(resolvedPost);

        // Feed is non-critical — fetch in background, don't block post render
        fetch('/api/blogs', { cache: 'no-store' })
          .then(r => r.json())
          .then((feedJson: { success: boolean; data: CKBFSResolvedData[] }) => {
            const resolvedFeed = feedJson.success ? feedJson.data : [];
            setTreeRoot(buildVersionTreeWithForks(resolvedPost, resolvedFeed));
          })
          .catch(() => {
            // Feed failure doesn't affect post display
            setTreeRoot(buildVersionTreeWithForks(resolvedPost, []));
          });
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') {
          setLoadError('Request timed out — CKB RPC did not respond in 10s. Check your connection.');
          return;
        }
        console.error('Missing remote post cell:', e);
        const msg = e instanceof Error ? e.message : 'Network error — could not reach CKB indexer';
        if (msg.toLowerCase().includes('not found')) {
          setNotFound(true);
        } else {
          setLoadError(msg);
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }
    resolveOnChain();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [txHash]);

  // ── DAO Voting ──────────────────────────────────────────────────────────────
  // NOTE: Must be above all early returns to satisfy Rules of Hooks.
  useEffect(() => { loadVotes(); }, [loadVotes]);
  const voteRecord: VoteRecord = votes[txHash] ?? { upvotes: 0, flags: 0, userVote: null };

  function retryLoad() {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    const run = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const postRes = await fetch(`/api/blog/${txHash}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const postJson = await postRes.json() as { success: boolean; data: CKBFSResolvedData; error?: string };
        if (!postJson.success) throw new Error(postJson.error ?? 'Post not found');
        const resolvedPost = postJson.data;
        setPost(resolvedPost);
        fetch('/api/blogs', { cache: 'no-store' })
          .then(r => r.json())
          .then((feedJson: { success: boolean; data: CKBFSResolvedData[] }) => {
            const resolvedFeed = feedJson.success ? feedJson.data : [];
            setTreeRoot(buildVersionTreeWithForks(resolvedPost, resolvedFeed));
          })
          .catch(() => setTreeRoot(buildVersionTreeWithForks(resolvedPost, [])));
      } catch (e) {
        const msg = (e as Error)?.name === 'AbortError'
          ? 'Request timed out (10s). Check your connection.'
          : e instanceof Error ? e.message : 'Retry failed';
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
    };
    run();
  }

  if (loading) {
    return (
      <div className="page-content narrow">
        <div className="skeleton" style={{ height: '48px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '24px', marginBottom: '8px', width: '60%' }} />
        <div className="skeleton" style={{ height: '300px', marginTop: '32px' }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-content narrow">
        <div className="error-state">
          <div className="error-icon">⚡</div>
          <div className="error-title">Failed to load post</div>
          <div className="error-sub">{loadError}</div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-retry" id="post-retry-btn" onClick={retryLoad}>↺ Retry</button>
            <Link href="/" className="btn btn-secondary">← Back to Feed</Link>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="page-content narrow">
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">Post not found</div>
          <div className="empty-sub">
            No live CKBFS cell found for tx hash <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{txHash.slice(0, 20)}…</code>
          </div>
          <Link href="/" className="btn btn-secondary">← Back to Feed</Link>
        </div>
      </div>
    );
  }

  const { metadata, content, checksum, backlinks, versions } = post;
  const isOwner = walletAddress === metadata.author;
  const versionCount = backlinks.length + 1;

  const daoScore = voteRecord.upvotes - voteRecord.flags + backlinks.length;
  const isTrending = daoScore >= 3 || (voteRecord.upvotes >= 2 && voteRecord.flags === 0);

  function handleVote(action: 'up' | 'flag') {
    if (!walletConnected) {
      pushNotification({ type: 'error', message: 'Connect your wallet to vote', duration: 3000 });
      return;
    }
    votePost(txHash, action, walletAddress);
    pushNotification({
      type: 'success',
      message: action === 'up'
        ? (voteRecord.userVote === 'up' ? 'Upvote removed' : '❤️ Upvoted!')
        : (voteRecord.userVote === 'flag' ? 'Flag removed' : '🚩 Post flagged'),
      duration: 2000,
    });
  }

  // ── CKBFS Security Validation (full suite via security.ts) ─────────────────
  let securityReport: PostSecurityReport | null = null;
  try {
    securityReport = runPostSecurityChecks({ metadata, content, backlinks, checksum });
  } catch { /* swallow — never crash page */ }

  // Build VersionEntry[] combining historical versions and current
  const coverImage = (metadata as Record<string, unknown>).cover_image as string | undefined;

  const versionEntries: VersionEntry[] = [
    ...versions.map(v => ({
      txHash: v.txHash,
      witnessIndex: 0,
      checksum: v.checksum,
      content: {
        title: v.metadata.title,
        body: v.content,
        tags: v.metadata.tags ?? [],
        author: v.metadata.author,
        created_at: v.metadata.created_at,
        version: 1,
        summary: v.metadata.description,
      } as VersionEntry['content'],
      timestamp: v.metadata.created_at,
    })),
    {
      txHash,
      witnessIndex: 0,
      checksum,
      content: {
        title: metadata.title,
        body: content,
        tags: metadata.tags ?? [],
        author: metadata.author,
        created_at: metadata.created_at,
        version: backlinks.length + 1,
        summary: metadata.description,
      } as VersionEntry['content'],
      timestamp: metadata.created_at,
    },
  ];


  async function handleFork() {
    if (!walletConnected) {
      pushNotification({ type: 'error', message: 'Connect wallet to fork', duration: 3000 });
      return;
    }
    setActionLoading(true);
    try {
      pushNotification({ type: 'info', message: 'Fork requires CKB wallet signature. Connect a real CCC wallet to proceed.', duration: 5000 });
    } finally {
      setActionLoading(false);
      setShowFork(false);
    }
  }

  async function handleTransfer() {
    if (!walletConnected) {
      pushNotification({ type: 'error', message: 'Connect wallet to transfer', duration: 3000 });
      return;
    }
    if (!transferAddr.trim()) {
      pushNotification({ type: 'error', message: 'Please enter a recipient address', duration: 3000 });
      return;
    }
    setActionLoading(true);
    try {
      pushNotification({ type: 'info', message: `Transfer to ${transferAddr.slice(0, 16)}... requires CKB wallet signature.`, duration: 5000 });
    } finally {
      setActionLoading(false);
      setShowTransfer(false);
      setTransferAddr('');
    }
  }

  // ─ Real CKB tip transaction ─────────────────────────────────────────────────
  async function sendCKBTip(to: string, ckbAmount: number): Promise<string> {
    if (!signer) throw new Error('Wallet not connected. Please connect a CKB wallet.');
    const toAddr = await ccc.Address.fromString(to, signer.client);
    const tx = ccc.Transaction.from({
      outputs: [{
        lock: toAddr.script,
        capacity: ccc.fixedPointFrom(ckbAmount),
      }],
    });
    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer, 1000);
    const sentHash = await signer.sendTransaction(tx);
    return sentHash;
  }

  async function handleTip() {
    const amount = parseFloat(tipAmount);
    if (!amount || amount <= 0) {
      pushNotification({ type: 'error', message: 'Enter a valid tip amount (> 0 CKB)', duration: 3000 });
      return;
    }
    if (!walletConnected || !signer) {
      pushNotification({ type: 'error', message: 'Connect your CKB wallet to tip', duration: 3000 });
      return;
    }
    if (post && walletAddress === post.metadata.author) {
      pushNotification({ type: 'error', message: "You can't tip your own post 😄", duration: 3000 });
      return;
    }
    setTipStatus('signing');
    try {
      setTipStatus('broadcasting');
      const hash = await sendCKBTip(post!.metadata.author, amount);
      setTipTxHash(hash);
      setTipStatus('confirmed');
      pushNotification({ type: 'success', message: `✅ Tipped ${amount} CKB! TX: ${hash.slice(0, 16)}...`, txHash: hash, duration: 8000 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      pushNotification({ type: 'error', message: `Tip failed: ${msg}`, duration: 5000 });
      setTipStatus('idle');
    }
  }

  async function handleUnlock() {
    if (!post) return;
    const price = (post.metadata as Record<string, unknown>).unlock_price as number | undefined;
    const amount = price && price > 0 ? price : 10;
    if (!walletConnected || !signer) {
      pushNotification({ type: 'error', message: 'Connect your CKB wallet to unlock', duration: 3000 });
      return;
    }
    setUnlockStatus('signing');
    try {
      setUnlockStatus('broadcasting');
      const hash = await sendCKBTip(post.metadata.author, amount);
      setUnlockStatus('confirmed');
      setUnlocked(true);
      // Persist unlock in sessionStorage so it survives page tab switches
      try {
        const stored = JSON.parse(sessionStorage.getItem('cp_unlocked') ?? '[]') as string[];
        sessionStorage.setItem('cp_unlocked', JSON.stringify(Array.from(new Set([...stored, txHash]))));
      } catch { /* ignore */ }
      pushNotification({ type: 'success', message: `✅ Unlocked! TX: ${hash.slice(0, 16)}...`, txHash: hash, duration: 8000 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      pushNotification({ type: 'error', message: `Unlock failed: ${msg}`, duration: 5000 });
      setUnlockStatus('idle');
    }
  }

  const renderedContent = marked.parse(content) as string;
  const metaExt = metadata as Record<string, unknown>;
  const isPaidPost = !!metaExt.is_paid;
  const unlockPrice = (metaExt.unlock_price as number | undefined) ?? 10;
  const typeId = post.filename ?? txHash.slice(0, 16);

  // Reading time
  const readMin = Math.max(1, Math.round(content.split(/\s+/).length / 200));

  // Copy link handler
  function handleCopyLink() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      pushNotification({ type: 'success', message: 'Link copied!', duration: 2000 });
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }
  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: metadata.title, url: window.location.href }).catch(() => {});
    } else {
      handleCopyLink();
    }
  }

  // sessionUnlocked state is declared at the top of the component (Rules of Hooks).
  const isUnlocked = unlocked || sessionUnlocked;
  const showContent = !isPaidPost || isOwner || isUnlocked;

  return (
    <>
      <div className="page-content narrow">
        {/* Breadcrumb + share actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
          <nav style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <Link href="/" style={{ color: 'var(--text-muted)' }}>Feed</Link>
            <span style={{ margin: '0 8px' }}>›</span>
            <span style={{ color: 'var(--text-secondary)' }}>{metadata.title.slice(0, 40)}{metadata.title.length > 40 ? '…' : ''}</span>
          </nav>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="read-time">📖 {readMin} min read</span>
            <button
              className={`copy-btn ${linkCopied ? 'copied' : ''}`}
              onClick={handleCopyLink}
              id="copy-link-btn"
              title="Copy link"
            >
              {linkCopied ? '✓ Copied' : '🔗 Copy link'}
            </button>
            <button
              className="btn-share"
              onClick={handleShare}
              id="share-post-btn"
              title="Share post"
            >
              ↗ Share
            </button>
          </div>
        </div>

        {/* Cover image */}
        {coverImage && (
          <div style={{ marginBottom: '28px', borderRadius: 'var(--r-lg)', overflow: 'hidden', maxHeight: '320px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt="Cover"
              style={{ width: '100%', height: '320px', objectFit: 'cover' }}
            />
          </div>
        )}

        <header style={{ marginBottom: '32px' }} className="anim-fade-up">
          {metadata.tags && metadata.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {metadata.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          )}

          <h1 className="heading-xl" style={{ marginBottom: '20px', fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}>
            {metadata.title}
          </h1>

          {metadata.description && (
            <p style={{
              fontSize: '1.125rem', color: 'var(--text-secondary)',
              lineHeight: 1.7, marginBottom: '20px', fontStyle: 'italic',
            }}>
              {metadata.description}
            </p>
          )}

          {/* Author section */}
          <div className="author-card">
            <div className="author-avatar">
              {metadata.author.slice(-2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {shortAddr(metadata.author)}
                </span>
                <CopyButton text={metadata.author} />
                {isOwner && <span className="badge badge-publish" style={{ fontSize: '0.65rem' }}>You</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {formatTime(metadata.created_at)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {versionCount > 1 && (
                <span className="badge badge-append">v{versionCount}</span>
              )}
              <span className="badge badge-publish">CKBFS Main</span>
            </div>
          </div>
        </header>

        <div className="protocol-bar anim-fade-up" style={{ marginBottom: '28px', animationDelay: '100ms' }}>
          <div className="pbar-item">
            <div className="pbar-dot" />
            <span>TX: {txHash.slice(0, 18)}…</span>
          </div>
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--accent)' }} />
            <span>Adler32: 0x{(checksum >>> 0).toString(16).padStart(8, '0')}</span>
          </div>
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--warning)' }} />
            <span>{backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Ownership Panel */}
        <div className="ownership-panel anim-fade-up" style={{ marginBottom: '28px', animationDelay: '50ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>🏷 On-Chain Ownership · CKBFS Cell</span>
            {isPaidPost && (
              <span style={{
                padding: '1px 8px', borderRadius: 'var(--r-full)',
                fontSize: '0.65rem', fontWeight: 700,
                background: 'rgba(245,158,11,0.1)', color: 'var(--warning)',
                border: '1px solid rgba(245,158,11,0.25)', marginLeft: 'auto',
              }}>🔒 Paid · {unlockPrice} CKB</span>
            )}
          </div>
          <div className="ownership-row">
            <span className="ownership-label">Owner</span>
            <span className="ownership-value">{shortAddr(metadata.author)}</span>
            {isOwner && <span className="owner-badge">✓ Owned by you</span>}
            <CopyButton text={metadata.author} />
          </div>
          <div className="ownership-row">
            <span className="ownership-label">TYPE_ID</span>
            <span className="ownership-value">{typeId.slice(0, 30)}…</span>
            <CopyButton text={typeId} />
          </div>
          <div className="ownership-row">
            <span className="ownership-label">TX Hash</span>
            <span className="ownership-value">{txHash.slice(0, 30)}…</span>
            <CopyButton text={txHash} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {(['content', 'history', 'tree', 'cell'] as const).map(tab => (
            <button
              key={tab}
              id={`tab-${tab}-btn`}
              className="btn btn-ghost btn-sm"
              onClick={() => setActiveTab(tab)}
              style={{
                borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                paddingBottom: '10px',
              }}
            >
              {tab === 'content' ? '📄 Content'
                : tab === 'history' ? `🕰 History (${versionEntries.length})`
                : tab === 'tree' ? `🌳 Tree`
                : '🧬 Cell Data'}
            </button>
          ))}
        </div>

        {/* DAO Governance Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          padding: '10px 16px', marginBottom: '16px',
          background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
        }}>
          {/* Upvote */}
          <button
            id="upvote-btn"
            onClick={() => handleVote('up')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: 'var(--r-full)',
              background: voteRecord.userVote === 'up' ? 'rgba(0,212,170,0.15)' : 'transparent',
              border: `1px solid ${voteRecord.userVote === 'up' ? 'rgba(0,212,170,0.35)' : 'var(--border)'}`,
              color: voteRecord.userVote === 'up' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            👍 {voteRecord.upvotes}
          </button>
          {/* Flag */}
          <button
            id="flag-btn"
            onClick={() => handleVote('flag')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: 'var(--r-full)',
              background: voteRecord.userVote === 'flag' ? 'rgba(239,68,68,0.1)' : 'transparent',
              border: `1px solid ${voteRecord.userVote === 'flag' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
              color: voteRecord.userVote === 'flag' ? 'var(--error)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            🚩 {voteRecord.flags}
          </button>
          {/* Trending badge */}
          {isTrending && (
            <span style={{
              padding: '3px 10px', borderRadius: 'var(--r-full)',
              background: 'rgba(0,212,170,0.1)', color: 'var(--primary)',
              border: '1px solid rgba(0,212,170,0.25)',
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
            }}>🔥 TRENDING</span>
          )}
          {/* Score */}
          <span style={{
            marginLeft: 'auto', fontSize: '0.78rem',
            color: daoScore > 0 ? 'var(--primary)' : daoScore < 0 ? 'var(--error)' : 'var(--text-muted)',
            fontWeight: 600,
          }}>
            Score: {daoScore > 0 ? '+' : ''}{daoScore}
          </span>
        </div>

        {/* ── Security Banners ─────────────────────────────────────────────── */}
        {securityReport && !securityReport.allClear && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>

            {/* 1. Witness header check */}
            {!securityReport.witnessValid && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '10px 16px',
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--r-md)', fontSize: '0.82rem',
              }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔴</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--error)', marginBottom: '3px' }}>
                    ⚠️ Witness Format Invalid — content rejected by CKBFS protocol
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                    {securityReport.witnessError}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Expected: bytes 0-4 = <code style={{ fontFamily: 'var(--font-mono)' }}>CKBFS</code> · byte 5 = <code style={{ fontFamily: 'var(--font-mono)' }}>0x00</code>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Checksum integrity */}
            {!securityReport.checksumValid && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '10px 16px',
                background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 'var(--r-md)', fontSize: '0.82rem',
              }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--warning)', marginBottom: '3px' }}>
                    ⚠️ Content Integrity Failed — Adler32 mismatch
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                    {securityReport.checksumError}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Backlink validation */}
            {!securityReport.backlinksValid && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '10px 16px',
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--r-md)', fontSize: '0.82rem',
              }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>❌</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--error)', marginBottom: '3px' }}>
                    Backlink Validation Failed
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.77rem' }}>
                    {securityReport.backlinksError}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security: all-clear confirmation */}
        {securityReport?.allClear && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 14px', marginBottom: '16px',
            background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.15)',
            borderRadius: 'var(--r-md)', fontSize: '0.78rem',
            color: 'var(--primary)',
          }}>
            <span>✅</span>
            <span>Security validated — witness header, checksum, and backlinks all pass CKBFS protocol checks.</span>
          </div>
        )}

        {/* Content tab */}
        {activeTab === 'content' && (
          showContent ? (
            <div className="post-body anim-fade-in" dangerouslySetInnerHTML={{ __html: renderedContent }} />
          ) : (
            <div className="paid-gate anim-fade-in">
              <div className="paid-gate-icon">🔒</div>
              <div className="paid-gate-title">This is a paid post</div>
              <div className="paid-gate-sub">
                The author has locked this content. Send CKB to the author&apos;s wallet to unlock it permanently.
              </div>
              <div className="paid-gate-price">
                <span>⚡</span>{unlockPrice} CKB
              </div>
              {unlockStatus === 'confirmed' ? (
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>✅ Unlocked! Refresh to read.</span>
              ) : (
                <button
                  className="btn btn-primary"
                  id="unlock-post-btn"
                  onClick={handleUnlock}
                  disabled={unlockStatus !== 'idle'}
                >
                  {unlockStatus === 'idle' && `🔓 Unlock for ${unlockPrice} CKB`}
                  {unlockStatus === 'signing' && <>✍️ Waiting for signature…</>}
                  {unlockStatus === 'broadcasting' && <>📡 Broadcasting…</>}
                </button>
              )}
              {!walletConnected && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-4px' }}>
                  Connect wallet first to unlock.
                </p>
              )}
            </div>
          )
        )}


        {/* History tab */}
        {activeTab === 'history' && (
          <div className="anim-fade-in">
            <VersionHistory
              versions={versionEntries}
              backlinks={backlinks}
              currentTxHash={txHash}
            />
          </div>
        )}

        {/* Tree tab */}
        {activeTab === 'tree' && (
          <div className="anim-fade-in">
            {treeRoot ? (
              <VersionTree root={treeRoot} currentTxHash={txHash} />
            ) : (
              <div style={{
                padding: '24px', textAlign: 'center',
                background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.875rem',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🌱</div>
                This is the genesis version — no version tree to display yet.
              </div>
            )}
          </div>
        )}

        {/* Cell data tab */}
        {activeTab === 'cell' && (
          <div className="anim-fade-in">
            {/* Protocol Fields */}
            <div className="card" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', marginBottom: '16px' }}>
              <h3 className="heading-md" style={{ marginBottom: '16px', fontFamily: 'var(--font-sans)' }}>
                🧬 CKBFS Protocol Layer
              </h3>

              {[
                {
                  k: 'content_type',
                  v: 'application/json',
                  note: '(IMMUTABLE)',
                  badge: true,
                  badgeColor: 'var(--primary)',
                },
                { k: 'filename', v: post.filename, note: '(IMMUTABLE — set at publish)' },
                {
                  k: 'checksum',
                  v: `0x${(checksum >>> 0).toString(16).padStart(8, '0')} (${checksum >>> 0})`,
                  note: '(Adler32 chain)',
                },
                { k: 'tx_hash', v: txHash, note: '(on-chain location)' },
                { k: 'backlinks', v: `${backlinks.length} entries`, note: '(append-only)' },
                { k: 'witness_format', v: 'CKBFS | 0x00 | content_bytes', note: '(MAGIC + VERSION + DATA)' },
                { k: 'owner', v: metadata.author, note: '(lock script)' },
                { k: 'version', v: `v${versionCount}`, note: '(current head)' },
              ].map(({ k, v, note, badge, badgeColor }) => (
                <div key={k} style={{
                  display: 'flex', gap: '12px', padding: '10px 0',
                  borderBottom: '1px solid var(--border-subtle)', alignItems: 'flex-start', flexWrap: 'wrap',
                }}>
                  <span style={{ color: 'var(--accent)', minWidth: '160px', flexShrink: 0 }}>{k}:</span>
                  <span style={{ color: 'var(--text-primary)', flex: 1, wordBreak: 'break-all' }}>{v}</span>
                  {badge && (
                    <span style={{
                      padding: '1px 7px', borderRadius: 'var(--r-full)',
                      fontSize: '0.65rem', fontWeight: 700,
                      background: `${badgeColor}18`, color: badgeColor,
                      border: `1px solid ${badgeColor}33`, flexShrink: 0,
                    }}>
                      IMMUTABLE
                    </span>
                  )}
                  {!badge && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', flexShrink: 0 }}>{note}</span>}
                </div>
              ))}
            </div>

            {/* Version Graph */}
            {versionCount > 1 && (
              <div className="card">
                <h3 className="heading-md" style={{ marginBottom: '14px', fontFamily: 'var(--font-sans)' }}>
                  🔗 Version Graph (Genesis → Latest)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {versionEntries.map((entry, idx) => {
                    const isLatest = idx === versionEntries.length - 1;
                    const isGenesis = idx === 0;
                    return (
                      <div key={entry.txHash} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        {/* Timeline connector */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '28px' }}>
                          <div style={{
                            width: '10px', height: '10px', borderRadius: '50%', marginTop: '8px', flexShrink: 0,
                            background: isLatest ? 'var(--primary)' : isGenesis ? 'var(--accent)' : 'var(--text-muted)',
                            boxShadow: isLatest ? '0 0 8px var(--primary-glow)' : 'none',
                          }} />
                          {!isLatest && (
                            <div style={{ width: '2px', flex: 1, minHeight: '20px', background: 'var(--border-subtle)', margin: '3px 0' }} />
                          )}
                        </div>
                        {/* Entry */}
                        <div style={{ flex: 1, paddingBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px',
                              borderRadius: 'var(--r-full)',
                              background: isLatest ? 'rgba(0,212,170,0.1)' : 'rgba(124,111,255,0.08)',
                              color: isLatest ? 'var(--primary)' : 'var(--accent)',
                              border: `1px solid ${isLatest ? 'rgba(0,212,170,0.2)' : 'rgba(124,111,255,0.2)'}`,
                            }}>
                              v{idx + 1}{isLatest ? ' · HEAD' : ''}{isGenesis ? ' · GENESIS' : ''}
                            </span>
                            <code style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                              {entry.txHash.slice(0, 18)}…
                            </code>
                            <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              0x{(entry.checksum >>> 0).toString(16).padStart(8, '0')}
                            </code>
                          </div>
                          {entry.timestamp && (
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                              {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Backlink chain */}
            {backlinks.length > 0 && (
              <div className="card" style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.77rem' }}>
                <h3 className="heading-md" style={{ marginBottom: '12px', fontFamily: 'var(--font-sans)', fontSize: '1rem' }}>
                  ⛓ Backlink Chain (Append-Only)
                </h3>
                {backlinks.map((bl, i) => (
                  <div key={bl.tx_hash} style={{
                    padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
                    display: 'grid', gridTemplateColumns: '28px 1fr', gap: '10px', alignItems: 'start',
                  }}>
                    <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>↑{i}</span>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-all', marginBottom: '2px' }}>{bl.tx_hash}</div>
                      <div style={{ color: 'var(--text-muted)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span>idx: {bl.index}</span>
                        <span>checksum: 0x{(bl.checksum >>> 0).toString(16).padStart(8, '0')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        <div className="action-row">
          {/* Fork */}
          <button
            id="fork-post-btn"
            className="btn btn-secondary"
            onClick={() => setShowFork(true)}
          >
            🍴 Fork
          </button>

          {/* Transfer — only owner */}
          {isOwner && (
            <button
              id="transfer-post-btn"
              className="btn btn-secondary"
              onClick={() => setShowTransfer(true)}
            >
              📤 Transfer
            </button>
          )}

          {/* Tip — disabled for self; real tx otherwise */}
          {!isOwner && (
            <button
              id="tip-post-btn"
              className="btn btn-tip"
              onClick={() => { setShowTip(true); setTipStatus('idle'); setTipTxHash(null); }}
            >
              💸 Tip Author
            </button>
          )}

          {/* Append — only owner */}
          {isOwner && (
            <Link
              href={`/write?append=${txHash}`}
              className="btn btn-accent"
              id="append-post-btn"
              style={{ marginLeft: 'auto' }}
            >
              🔗 Append Update
            </Link>
          )}
        </div>
      </div>

      {/* Fork Modal */}
      {showFork && (
        <div className="modal-overlay" onClick={() => setShowFork(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 className="heading-md">🍴 Fork This Post</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowFork(false)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '20px' }}>
              Forking creates a new CKBFS cell with this post as a CellDep. You inherit the full version history but start a new branch with your own wallet identity.
            </p>
            <div className="protocol-bar" style={{ marginBottom: '20px' }}>
              <div className="pbar-item"><div className="pbar-dot" /><span>CellDep: {txHash.slice(0, 16)}…</span></div>
              <div className="pbar-item"><div className="pbar-dot" style={{ background: 'var(--accent)' }} /><span>New branch · Your wallet</span></div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowFork(false)}>Cancel</button>
              <button
                className="btn btn-accent"
                id="confirm-fork-btn"
                onClick={handleFork}
                disabled={actionLoading}
                style={{ marginLeft: 'auto' }}
              >
                {actionLoading ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Forking...</> : '🍴 Confirm Fork'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="modal-overlay" onClick={() => setShowTransfer(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 className="heading-md">📤 Transfer Ownership</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTransfer(false)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '20px' }}>
              Transfer this CKBFS cell to a new wallet. The checksum and backlink history are immutable — only the lock script owner changes.
            </p>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="transfer-addr-input">Recipient CKB Address</label>
              <input
                id="transfer-addr-input"
                className="form-input"
                placeholder="ckb1qz..."
                value={transferAddr}
                onChange={e => setTransferAddr(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowTransfer(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                id="confirm-transfer-btn"
                onClick={handleTransfer}
                disabled={actionLoading || !transferAddr.trim()}
                style={{ marginLeft: 'auto' }}
              >
                {actionLoading ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Transferring...</> : '📤 Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tip Modal — real CKB transfer */}
      {showTip && (
        <div className="modal-overlay" onClick={() => tipStatus === 'idle' && setShowTip(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 className="heading-md">💸 Tip Author</h2>
              {tipStatus === 'idle' && <button className="btn btn-ghost btn-sm" onClick={() => setShowTip(false)}>✕</button>}
            </div>

            {/* Author info */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', background: 'var(--bg-elevated)',
              borderRadius: 'var(--r-md)', marginBottom: '20px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.85rem', color: '#000',
              }}>
                {metadata.author.slice(-2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tipping</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {shortAddr(metadata.author)}
                </div>
              </div>
            </div>

            {tipStatus === 'confirmed' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--success)', marginBottom: '8px' }}>Tip sent!</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  TX: {tipTxHash}
                </div>
                <button className="btn btn-secondary" style={{ marginTop: '20px' }} onClick={() => setShowTip(false)}>Close</button>
              </div>
            ) : (
              <>
                {/* Amount input */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" htmlFor="tip-amount-input">Amount (CKB)</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[5, 10, 50, 100].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTipAmount(String(preset))}
                        style={{
                          padding: '5px 14px', borderRadius: 'var(--r-full)',
                          border: `1px solid ${tipAmount === String(preset) ? 'var(--warning)' : 'var(--border)'}`,
                          background: tipAmount === String(preset) ? 'rgba(245,158,11,0.1)' : 'var(--bg-elevated)',
                          color: tipAmount === String(preset) ? 'var(--warning)' : 'var(--text-muted)',
                          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {preset} CKB
                      </button>
                    ))}
                  </div>
                  <input
                    id="tip-amount-input"
                    type="number"
                    min="1"
                    step="1"
                    className="form-input"
                    value={tipAmount}
                    onChange={e => setTipAmount(e.target.value)}
                    style={{ marginTop: '10px' }}
                    placeholder="Custom amount in CKB"
                  />
                </div>

                {/* Tx status */}
                {tipStatus !== 'idle' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 16px', borderRadius: 'var(--r-md)', marginBottom: '16px',
                    background: 'rgba(124,111,255,0.08)', border: '1px solid rgba(124,111,255,0.2)',
                  }}>
                    <div className="spinner" style={{ width: '14px', height: '14px' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
                      {tipStatus === 'signing' && '✍️ Waiting for wallet signature...'}
                      {tipStatus === 'broadcasting' && '📡 Broadcasting to CKB network...'}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => setShowTip(false)}>Cancel</button>
                  <button
                    className="btn btn-tip"
                    id="confirm-tip-btn"
                    onClick={handleTip}
                    disabled={tipStatus !== 'idle' || !tipAmount}
                    style={{ marginLeft: 'auto', fontWeight: 700 }}
                  >
                    {tipStatus === 'idle' ? `💸 Send ${tipAmount || '?'} CKB` : 'Processing...'}
                  </button>
                </div>

                <div className="protocol-bar" style={{ marginTop: '16px' }}>
                  <div className="pbar-item"><div className="pbar-dot" style={{ background: 'var(--warning)' }} /><span>Native CKB transfer · No intermediary</span></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
