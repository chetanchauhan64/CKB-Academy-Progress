'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useStore, WalletType } from '@/lib/store';
import { CKBFSResolvedData, detectForkedPosts } from '@/lib/ckbfs/indexer';

// ─── Utils ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function walletLabel(type: WalletType): string {
  if (type === 'CKB') return '⛓ JoyID (CKB)';
  if (type === 'METAMASK') return '🦊 MetaMask';
  if (type === 'OKX') return '⭕ OKX';
  return '🔐 Demo';
}

function walletColor(type: WalletType): string {
  if (type === 'CKB') return 'var(--primary)';
  if (type === 'METAMASK') return 'var(--warning)';
  if (type === 'OKX') return 'var(--accent)';
  return 'var(--text-muted)';
}

function computeRepScore(posts: CKBFSResolvedData[], forks: number): number {
  const postScore = posts.length * 10;
  const versionScore = posts.reduce((acc, p) => acc + p.backlinks.length, 0) * 3;
  const forkScore = forks * 15;
  return postScore + versionScore + forkScore;
}

// ─── Blog Card ──────────────────────────────────────────────────────────────

function DashBlogCard({ post, index, isFork = false }: { post: CKBFSResolvedData; index: number; isFork?: boolean }) {
  const versionCount = post.backlinks.length + 1;
  const wordCount = post.content.split(/\s+/).length;
  const readMin = Math.max(1, Math.round(wordCount / 200));
  const lastUpdate = post.backlinks.length > 0
    ? post.backlinks[post.backlinks.length - 1].checksum
    : post.metadata.created_at;

  return (
    <div className="dash-card anim-fade-up" style={{ animationDelay: `${index * 60}ms`, position: 'relative' }}>
      {isFork && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px',
          background: 'rgba(124,111,255,0.12)', color: 'var(--accent)',
          border: '1px solid rgba(124,111,255,0.2)',
          borderRadius: 'var(--r-full)', padding: '2px 8px',
          fontSize: '0.65rem', fontWeight: 700,
        }}>🍴 FORK</div>
      )}

      {post.metadata.tags && post.metadata.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {post.metadata.tags.slice(0, 3).map(t => (
            <span key={t} className="tag" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{t}</span>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)', lineHeight: 1.3 }}>
        {post.metadata.title}
      </h3>

      {post.metadata.description && (
        <p style={{
          fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.55,
          marginBottom: '10px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {post.metadata.description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', flexWrap: 'wrap' }}>
        <span>{formatTime(post.metadata.created_at)}</span>
        <span>·</span>
        <span>{readMin} min read</span>
        <span>·</span>
        <span className="badge badge-append" style={{ padding: '1px 8px', fontSize: '0.68rem' }}>
          v{versionCount}
        </span>
        {post.backlinks.length > 0 && (
          <>
            <span>·</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
              {post.backlinks.length} backlink{post.backlinks.length !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        {post.txHash.slice(0, 22)}… · last: #{(lastUpdate >>> 0).toString(16).slice(-4)}
      </div>

      <div className="dash-actions">
        <Link href={`/post/${post.txHash}`} className="btn btn-secondary btn-sm" id={`dash-view-${post.txHash.slice(2, 8)}`}>
          👁 View
        </Link>
        <Link
          href={`/write?append=${post.txHash}`}
          className="btn btn-sm"
          id={`dash-append-${post.txHash.slice(2, 8)}`}
          style={{ background: 'rgba(124,111,255,0.1)', color: 'var(--accent)', border: '1px solid rgba(124,111,255,0.2)' }}
        >
          🔗 Append
        </Link>
        <button
          className="btn btn-sm"
          id={`dash-transfer-${post.txHash.slice(2, 8)}`}
          style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}
          onClick={() => { window.location.href = `/post/${post.txHash}`; }}
        >
          📤 Transfer
        </button>
      </div>
    </div>
  );
}

// ─── Version Timeline ────────────────────────────────────────────────────────

function VersionTimeline({ posts }: { posts: CKBFSResolvedData[] }) {
  // Flatten all versions across all posts into a single sorted timeline
  type TimelineEntry = { txHash: string; title: string; version: number; timestamp: number; checksum: number; postTxHash: string; };
  const entries: TimelineEntry[] = [];

  for (const post of posts) {
    // Each backlink is a prior version of this post
    post.backlinks.forEach((bl, idx) => {
      entries.push({
        txHash: bl.tx_hash,
        title: post.metadata.title,
        version: idx + 1,
        timestamp: post.metadata.created_at - ((post.backlinks.length - idx) * 1000),
        checksum: bl.checksum,
        postTxHash: post.txHash,
      });
    });
    // Current version
    entries.push({
      txHash: post.txHash,
      title: post.metadata.title,
      version: post.backlinks.length + 1,
      timestamp: post.metadata.created_at,
      checksum: post.checksum,
      postTxHash: post.txHash,
    });
  }

  entries.sort((a, b) => b.timestamp - a.timestamp);

  if (entries.length === 0) {
    return (
      <div className="empty-state card">
        <div className="empty-icon">🕰</div>
        <div className="empty-title">No version history yet</div>
        <div className="empty-sub">Publish posts and append versions to see your version timeline here.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {entries.map((entry, idx) => (
        <div key={`${entry.txHash}-${idx}`} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          {/* Timeline line */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '32px' }}>
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: entry.version === 1 ? 'var(--primary)' : 'var(--accent)',
              border: '2px solid var(--bg-card)', flexShrink: 0, marginTop: '6px',
              boxShadow: `0 0 8px ${entry.version === 1 ? 'var(--primary-glow)' : 'rgba(124,111,255,0.4)'}`,
            }} />
            {idx < entries.length - 1 && (
              <div style={{ width: '2px', flex: 1, minHeight: '24px', background: 'var(--border)', margin: '4px 0' }} />
            )}
          </div>

          {/* Entry content */}
          <div style={{ flex: 1, paddingBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <Link href={`/post/${entry.postTxHash}`} style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {entry.title}
              </Link>
              <span className={`badge ${entry.version === 1 ? 'badge-publish' : 'badge-append'}`} style={{ fontSize: '0.65rem' }}>
                v{entry.version}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>{formatTime(entry.timestamp)}</span>
              <span>·</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{entry.txHash.slice(0, 16)}…</span>
              <span>·</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>Adler32: 0x{(entry.checksum >>> 0).toString(16).padStart(8, '0')}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const {
    walletConnected, walletAddress, walletType, connectWallet,
    myPosts, loadMyPosts, userLoading, txLog, pushNotification,
    votes, loadVotes,
  } = useStore();

  const [activeSection, setActiveSection] = useState<'posts' | 'forks' | 'timeline' | 'earnings' | 'governance'>('posts');
  const [copied, setCopied] = useState(false);
  const [detectedForks, setDetectedForks] = useState<Map<string, CKBFSResolvedData[]>>(new Map());
  const [myOwnedForkedPosts, setMyOwnedForkedPosts] = useState<CKBFSResolvedData[]>([]);
  const [userError, setUserError] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      setUserError(null);
      loadMyPosts(walletAddress).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Failed to load your posts';
        setUserError(msg);
      });
    }
  }, [walletAddress, loadMyPosts]);

  useEffect(() => { loadVotes(); }, [loadVotes]);


  // Detect forks from my posts using the indexer helper
  useEffect(() => {
    if (myPosts.length > 0) {
      const forkMap = detectForkedPosts(myPosts);
      setDetectedForks(forkMap);
      // Posts I own that are themselves forks (have backlinks pointing to other posts I know)
      const forkedByMe = myPosts.filter(p =>
        p.backlinks.some(bl => myPosts.find(other => other.txHash === bl.tx_hash && other.txHash !== p.txHash))
      );
      setMyOwnedForkedPosts(forkedByMe);
    }
  }, [myPosts]);

  const handleCopyAddress = useCallback(() => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      pushNotification({ type: 'success', message: 'Address copied!', duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [walletAddress, pushNotification]);

  if (!walletConnected) {
    return (
      <div className="page-content narrow">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-title">Connect Wallet to Access Dashboard</div>
          <div className="empty-sub">
            Your dashboard shows all your CKBFS posts, version history, and quick actions.
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => connectWallet()} id="dashboard-connect-btn">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const forkedTxs = txLog.filter(tx => tx.operation === 'fork');
  const totalVersions = myPosts.reduce((acc, p) => acc + p.backlinks.length + 1, 0);
  const repScore = computeRepScore(myPosts, forkedTxs.length);
  const forksBranches = Array.from(detectedForks.values()).flat().length;

  const totalVotesReceived = myPosts.reduce((acc, p) => acc + ((votes[p.txHash]?.upvotes ?? 0) + (votes[p.txHash]?.flags ?? 0)), 0);

  const TABS = [
    { id: 'posts',      label: `📝 My Blogs (${myPosts.length})` },
    { id: 'forks',      label: `🍴 Forked (${myOwnedForkedPosts.length + forkedTxs.length})` },
    { id: 'timeline',  label: `🕓 Version Timeline (${totalVersions})` },
    { id: 'earnings',  label: `💰 Earnings` },
    { id: 'governance', label: `🗳 Governance (${totalVotesReceived})` },
  ] as const;

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>

      {/* ── Profile Section ─────────────────────────────────────────────── */}
      <div className="card anim-fade-up" style={{ marginBottom: '28px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: '64px', height: '64px', borderRadius: 'var(--r-lg)',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 800, color: '#000', flexShrink: 0,
            boxShadow: '0 0 24px var(--primary-glow)',
          }}>
            {walletAddress!.slice(-2).toUpperCase()}
          </div>

          {/* Identity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h1 className="heading-lg" style={{ marginBottom: 0 }}>My Dashboard</h1>
              {/* Wallet type badge */}
              {walletType && (
                <span style={{
                  padding: '2px 10px', borderRadius: 'var(--r-full)',
                  fontSize: '0.7rem', fontWeight: 700,
                  background: walletType === 'CKB' ? 'rgba(0,212,170,0.1)' : 'rgba(245,158,11,0.1)',
                  color: walletColor(walletType),
                  border: `1px solid ${walletColor(walletType)}33`,
                }}>
                  {walletLabel(walletType)}
                </span>
              )}
            </div>

            {/* Address with copy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {shortAddr(walletAddress!)}
              </span>
              <button
                className={`copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopyAddress}
                style={{ fontSize: '0.72rem' }}
                id="dash-copy-addr"
              >
                {copied ? '✓ Copied!' : '⎘ Copy'}
              </button>
            </div>

            {/* Reputation + stats row */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px',
                background: 'rgba(0,212,170,0.06)',
                border: '1px solid rgba(0,212,170,0.15)',
                borderRadius: 'var(--r-full)',
              }}>
                <span style={{ fontSize: '0.9rem' }}>⭐</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                  Rep: {repScore}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📝 {myPosts.length} posts</span>
                <span>·</span>
                <span>🔗 {totalVersions} versions</span>
                <span>·</span>
                <span>🍴 {forksBranches + forkedTxs.length} forks</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <Link href="/write" className="btn btn-primary btn-sm" id="dashboard-write-btn">✍️ New Post</Link>
            <Link href="/profile" className="btn btn-secondary btn-sm" id="dashboard-profile-btn">👤 Profile</Link>
            <Link href="/forks" className="btn btn-secondary btn-sm" id="dashboard-forks-btn">🍴 Fork Explorer</Link>
          </div>
        </div>

        {/* CKB-only warning for EVM wallets */}
        {walletType && walletType !== 'CKB' && (
          <div style={{
            marginTop: '16px',
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)',
            borderRadius: 'var(--r-md)', padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: '10px',
            fontSize: '0.825rem', color: 'var(--warning)',
          }}>
            <span>⚠️</span>
            <span>
              <strong>Read-only mode.</strong> Switch to <strong>JoyID (CKB)</strong> to publish, append, fork, or transfer posts on CKBFS.
            </span>
          </div>
        )}
      </div>

      {/* ── Stats Grid ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        marginBottom: '28px',
      }} className="anim-fade-up">
        {[
          { icon: '📝', label: 'Total Posts', value: myPosts.length, accent: 'var(--primary)' },
          { icon: '🔗', label: 'Total Versions', value: totalVersions, accent: 'var(--accent)' },
          { icon: '🍴', label: 'Forks', value: forksBranches + forkedTxs.length, accent: 'var(--success)' },
          { icon: '📡', label: 'Transactions', value: txLog.length, accent: 'var(--warning)' },
          { icon: '⭐', label: 'Rep Score', value: repScore, accent: 'var(--primary)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{s.icon}</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: s.accent, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Section Tabs ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`dash-tab-${tab.id}`}
            className="btn btn-ghost btn-sm"
            onClick={() => setActiveSection(tab.id)}
            style={{
              borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
              borderBottom: activeSection === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeSection === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              paddingBottom: '10px', fontSize: '0.85rem',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── My Blogs ────────────────────────────────────────────────────── */}
      {activeSection === 'posts' && (
        <div>
          {userLoading ? (
            <div className="dashboard-grid">
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '200px' }} />)}
            </div>
          ) : userError ? (
            <div className="error-state">
              <div className="error-icon">⚡</div>
              <div className="error-title">Failed to load your posts</div>
              <div className="error-sub">{userError}</div>
              <button
                className="btn-retry"
                id="dash-posts-retry-btn"
                onClick={() => {
                  setUserError(null);
                  if (walletAddress) loadMyPosts(walletAddress).catch((e: unknown) => setUserError(e instanceof Error ? e.message : 'Retry failed'));
                }}
              >
                ↺ Retry
              </button>
            </div>
          ) : myPosts.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">📭</div>
              <div className="empty-title">No posts yet</div>
              <div className="empty-sub">Start publishing on CKBFS — your posts live permanently on Nervos CKB.</div>
              <Link href="/write" className="btn btn-primary" id="dash-empty-write">✍️ Write First Post</Link>
            </div>
          ) : (
            <div className="dashboard-grid">
              {myPosts.map((post, i) => (
                <DashBlogCard key={post.txHash} post={post} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Forked Blogs ────────────────────────────────────────────────── */}
      {activeSection === 'forks' && (
        <div>
          {/* Posts I own that are themselves forks */}
          {myOwnedForkedPosts.length > 0 && (
            <>
              <h3 className="heading-sm" style={{ marginBottom: '14px', color: 'var(--text-secondary)' }}>
                🍴 My Fork Branches
              </h3>
              <div className="dashboard-grid" style={{ marginBottom: '28px' }}>
                {myOwnedForkedPosts.map((post, i) => (
                  <DashBlogCard key={post.txHash} post={post} index={i} isFork />
                ))}
              </div>
            </>
          )}

          {/* Forks I created via fork-post TX */}
          {forkedTxs.length > 0 && (
            <>
              <h3 className="heading-sm" style={{ marginBottom: '14px', color: 'var(--text-secondary)' }}>
                📡 Fork Transactions (On-Chain)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {forkedTxs.map(tx => (
                  <div key={tx.txHash} className="card anim-fade-up" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span className="badge badge-fork">🍴 Forked</span>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', flex: 1, wordBreak: 'break-all' }}>
                        {tx.txHash}
                      </code>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(tx.timestamp).toLocaleString()}
                      </span>
                      <Link href={`/post/${tx.txHash}`} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>
                        View →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Branches forked from my posts */}
          {detectedForks.size > 0 && (
            <>
              <h3 className="heading-sm" style={{ margin: '24px 0 14px', color: 'var(--text-secondary)' }}>
                🌿 Branches From My Posts
              </h3>
              {Array.from(detectedForks.entries()).map(([parentHash, branches]) => (
                <div key={parentHash} className="card" style={{ marginBottom: '12px', padding: '16px 20px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
                    Origin: {parentHash.slice(0, 20)}…
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {branches.map(b => (
                      <div key={b.txHash} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem' }}>🌿</span>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', flex: 1 }}>{b.metadata.title}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{b.txHash.slice(0, 14)}…</span>
                        <Link href={`/post/${b.txHash}`} className="btn btn-ghost btn-sm">View →</Link>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {myOwnedForkedPosts.length === 0 && forkedTxs.length === 0 && detectedForks.size === 0 && (
            <div className="empty-state card">
              <div className="empty-icon">🍴</div>
              <div className="empty-title">No forks yet</div>
              <div className="empty-sub">Fork any post on the Feed to inherit its version history and create your own branch.</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <Link href="/" className="btn btn-secondary">Browse Feed</Link>
                <Link href="/forks" className="btn btn-secondary">Fork Explorer</Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Global Version Timeline ─────────────────────────────────────── */}
      {activeSection === 'timeline' && (
        <div>
          {userLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '60px' }} />)}
            </div>
          ) : userError ? (
            <div className="error-state">
              <div className="error-icon">⚡</div>
              <div className="error-title">Failed to load timeline</div>
              <div className="error-sub">{userError}</div>
              <button
                className="btn-retry"
                onClick={() => {
                  setUserError(null);
                  if (walletAddress) loadMyPosts(walletAddress).catch((e: unknown) => setUserError(e instanceof Error ? e.message : 'Retry failed'));
                }}
              >
                ↺ Retry
              </button>
            </div>
          ) : (
            <VersionTimeline posts={myPosts} />
          )}
        </div>
      )}

      {/* ── Earnings ─────────────────────────────────────────────── */}
      {activeSection === 'earnings' && (() => {
        const tipTxs = txLog.filter(tx => (tx as { operation: string }).operation === 'tip');
        const paidPosts = myPosts.filter(p => !!(p.metadata as Record<string, unknown>).is_paid);
        const paidPostCount = paidPosts.length;
        // Tip revenue from on-chain tx log (each tip entry has amount in CKB)
        const tipRevenue = tipTxs.reduce((acc, tx) => acc + (((tx as unknown) as Record<string, unknown>).amount as number ?? 0), 0);

        return (
          <div className="anim-fade-in">
            {/* Summary stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px', marginBottom: '28px',
            }}>
              {[
                { icon: '💸', label: 'Tips Received', value: `${tipRevenue.toFixed(0)} CKB`, accent: 'var(--warning)' },
                { icon: '🔒', label: 'Paid Posts', value: paidPostCount, accent: 'var(--accent)' },
                { icon: '📅', label: 'Tip Events', value: tipTxs.length, accent: 'var(--primary)' },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{s.icon}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.accent, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Paid posts list */}
            {paidPostCount > 0 ? (
              <div>
                <h3 className="heading-sm" style={{ marginBottom: '14px', color: 'var(--text-secondary)' }}>
                  🔒 Your Paid Posts
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {paidPosts.map(p => {
                    const price = ((p.metadata as Record<string, unknown>).unlock_price as number | undefined) ?? 10;
                    return (
                      <div key={p.txHash} className="card" style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '3px' }}>{p.metadata.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {p.txHash.slice(0, 22)}…
                            </div>
                          </div>
                          <span style={{
                            padding: '3px 12px', borderRadius: 'var(--r-full)',
                            background: 'rgba(245,158,11,0.1)', color: 'var(--warning)',
                            border: '1px solid rgba(245,158,11,0.25)',
                            fontSize: '0.82rem', fontWeight: 700, flexShrink: 0,
                          }}>
                            ⚡ {price} CKB unlock
                          </span>
                          <Link href={`/post/${p.txHash}`} className="btn btn-ghost btn-sm">View →</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="empty-state card">
                <div className="empty-icon">💰</div>
                <div className="empty-title">No paid posts yet</div>
                <div className="empty-sub">
                  Enable the paid toggle in the editor when writing a post to monetize your content on-chain.
                </div>
                <Link href="/write" className="btn btn-primary" id="earnings-write-btn">✍️ Write a Paid Post</Link>
              </div>
            )}

            {/* Tip history */}
            {tipTxs.length > 0 && (
              <div style={{ marginTop: '28px' }}>
                <h3 className="heading-sm" style={{ marginBottom: '14px', color: 'var(--text-secondary)' }}>
                  💸 Tip History
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tipTxs.map(tx => (
                    <div key={tx.txHash} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span className="badge badge-publish" style={{ fontSize: '0.65rem' }}>💸 Tip</span>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-secondary)', flex: 1, wordBreak: 'break-all' }}>{tx.txHash}</code>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{new Date(tx.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Governance ──────────────────────────────────────────── */}
      {activeSection === 'governance' && (
        <div className="anim-fade-in">
          {/* Stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px', marginBottom: '28px',
          }}>
            {[
              { icon: '👍', label: 'Total Upvotes', value: myPosts.reduce((a, p) => a + (votes[p.txHash]?.upvotes ?? 0), 0), color: 'var(--primary)' },
              { icon: '🚩', label: 'Total Flags', value: myPosts.reduce((a, p) => a + (votes[p.txHash]?.flags ?? 0), 0), color: 'var(--error)' },
              { icon: '📊', label: 'Net Score', value: myPosts.reduce((a, p) => {
                const v = votes[p.txHash] ?? { upvotes: 0, flags: 0 };
                return a + v.upvotes - v.flags + p.backlinks.length;
              }, 0), color: 'var(--accent)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{s.icon}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {myPosts.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">🗳</div>
              <div className="empty-title">No votes yet</div>
              <div className="empty-sub">Publish posts to start receiving community votes.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myPosts
                .map(p => {
                  const v = votes[p.txHash] ?? { upvotes: 0, flags: 0, userVote: null };
                  const score = v.upvotes - v.flags + p.backlinks.length;
                  return { post: p, v, score };
                })
                .sort((a, b) => b.score - a.score)
                .map(({ post: p, v, score }) => {
                  const trending = score >= 3 || (v.upvotes >= 2 && v.flags === 0);
                  return (
                    <div key={p.txHash} className="card" style={{
                      padding: '14px 18px',
                      border: trending ? '1px solid rgba(0,212,170,0.25)' : undefined,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            {trending && (
                              <span style={{
                                padding: '1px 8px', borderRadius: 'var(--r-full)',
                                background: 'rgba(0,212,170,0.1)', color: 'var(--primary)',
                                border: '1px solid rgba(0,212,170,0.2)',
                                fontSize: '0.62rem', fontWeight: 700,
                              }}>🔥 TRENDING</span>
                            )}
                            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.metadata.title}</span>
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {p.txHash.slice(0, 22)}…
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 'var(--r-full)',
                            background: 'rgba(0,212,170,0.08)', color: 'var(--primary)',
                            border: '1px solid rgba(0,212,170,0.15)',
                            fontSize: '0.78rem', fontWeight: 600,
                          }}>👍 {v.upvotes}</span>
                          <span style={{
                            padding: '3px 10px', borderRadius: 'var(--r-full)',
                            background: v.flags > 0 ? 'rgba(239,68,68,0.07)' : 'var(--bg-elevated)',
                            color: v.flags > 0 ? 'var(--error)' : 'var(--text-muted)',
                            border: `1px solid ${v.flags > 0 ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                            fontSize: '0.78rem', fontWeight: 600,
                          }}>🚩 {v.flags}</span>
                          <span style={{
                            padding: '3px 10px', borderRadius: 'var(--r-full)',
                            background: score > 0 ? 'rgba(124,111,255,0.08)' : 'var(--bg-elevated)',
                            color: score > 0 ? 'var(--accent)' : 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            fontSize: '0.78rem', fontWeight: 700,
                          }}>{score > 0 ? '+' : ''}{score}</span>
                          <Link href={`/post/${p.txHash}`} className="btn btn-ghost btn-sm">View →</Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
