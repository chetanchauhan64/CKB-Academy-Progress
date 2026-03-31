'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import PostCard from '@/components/PostCard';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
      {copied ? '✓ Copied' : (label ?? '⎘ Copy')}
    </button>
  );
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
}

export default function ProfilePage() {
  const { walletConnected, walletAddress, connectWallet, myPosts, loadMyPosts, txLog } = useStore();
  const [tab, setTab] = useState<'posts' | 'forks' | 'txlog'>('posts');
  const [showFullAddr, setShowFullAddr] = useState(false);

  useEffect(() => {
    if (walletAddress) loadMyPosts(walletAddress);
  }, [walletAddress, loadMyPosts]);

  if (!walletConnected) {
    return (
      <div className="page-content narrow">
        <div className="empty-state">
          <div className="empty-icon">🔐</div>
          <div className="empty-title">Not Connected</div>
          <div className="empty-sub">
            Connect your wallet to view your author profile, posts, and transaction history.
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => connectWallet()} id="profile-connect-btn">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const addr = walletAddress!;

  // Stats
  const forksCreated = txLog.filter(tx => tx.operation === 'fork').length;
  const totalVersions = myPosts.reduce((acc, p) => acc + p.backlinks.length, 0);

  // Reputation score (mock calculation)
  const repScore = myPosts.length * 10 + totalVersions * 5 + forksCreated * 20 + txLog.length * 2;

  const stats = {
    posts: myPosts.length,
    versions: totalVersions,
    forks: forksCreated,
    txs: txLog.length,
    totalBacklinks: myPosts.reduce((acc, p) => acc + p.backlinks.length, 0),
  };

  const forkedTxs = txLog.filter(tx => tx.operation === 'fork');

  return (
    <div className="page-content" style={{ maxWidth: '900px' }}>
      {/* Profile header */}
      <div className="card anim-fade-up" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: '72px', height: '72px', borderRadius: 'var(--r-lg)',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 800, color: '#000',
            flexShrink: 0,
            boxShadow: '0 0 30px var(--primary-glow)',
          }}>
            {addr.slice(-2).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <h1 className="heading-md">Author Profile</h1>
              <span className="badge badge-publish">CKBFS Author</span>
              <div className="rep-score" title="Reputation score based on posts, versions, and forks">
                ⭐ {repScore} Rep
              </div>
            </div>

            {/* Wallet address with copy */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
              }}>
                <code style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  wordBreak: 'break-all',
                  flexShrink: 1,
                }}>
                  {showFullAddr ? addr : shortAddr(addr)}
                </code>
                <button
                  className="copy-btn"
                  onClick={() => setShowFullAddr(v => !v)}
                  style={{ flexShrink: 0 }}
                >
                  {showFullAddr ? '⬆ Collapse' : '⬇ Full'}
                </button>
                <CopyButton text={addr} label="⎘ Copy Address" />
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Wallet-based identity · No email required
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '16px',
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border)',
        }}>
          {[
            { label: 'Posts', value: stats.posts, icon: '📝', accent: 'var(--primary)' },
            { label: 'Versions', value: stats.versions, icon: '🔗', accent: 'var(--accent)' },
            { label: 'Forks', value: stats.forks, icon: '🍴', accent: 'var(--success)' },
            { label: 'Backlinks', value: stats.totalBacklinks, icon: '⛓', accent: 'var(--primary)' },
            { label: 'Transactions', value: stats.txs, icon: '📡', accent: 'var(--warning)' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{s.icon}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.accent }}>{s.value}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Protocol status */}
      <div className="protocol-bar anim-fade-up" style={{ marginBottom: '24px', animationDelay: '80ms' }}>
        <div className="pbar-item">
          <div className="pbar-dot" />
          <span>Lock Script Hash: {shortAddr(addr)}</span>
        </div>
        <div className="pbar-item">
          <div className="pbar-dot" style={{ background: 'var(--accent)' }} />
          <span>Rep Score: {repScore} (posts×10 + versions×5 + forks×20)</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {(['posts', 'forks', 'txlog'] as const).map(t => (
          <button
            key={t}
            id={`profile-tab-${t}`}
            className="btn btn-ghost btn-sm"
            onClick={() => setTab(t)}
            style={{
              borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
              borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
              paddingBottom: '10px',
            }}
          >
            {t === 'posts'
              ? `📝 My Posts (${myPosts.length})`
              : t === 'forks'
              ? `🍴 Forks (${forkedTxs.length})`
              : `📡 TX Log (${txLog.length})`}
          </button>
        ))}
      </div>

      {/* Posts */}
      {tab === 'posts' && (
        <div>
          {myPosts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <div className="empty-title">No posts yet</div>
              <div className="empty-sub">Write your first post and it will appear here.</div>
              <Link href="/write" className="btn btn-primary" id="profile-write-btn">✍️ Write First Post</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {myPosts.map((post, i) => (
                <PostCard key={post.txHash} post={post} showAuthor={false} animDelay={i * 50} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Forks */}
      {tab === 'forks' && (
        <div>
          {forkedTxs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🍴</div>
              <div className="empty-title">No forks yet</div>
              <div className="empty-sub">Fork any post on the feed to create a new branch inheriting its history.</div>
              <Link href="/" className="btn btn-secondary">Browse Feed</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {forkedTxs.map(tx => (
                <div key={tx.txHash} className="card anim-fade-up" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span className="badge badge-fork">🍴 FORK</span>
                    <code style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      flex: 1,
                      wordBreak: 'break-all',
                    }}>
                      {tx.txHash}
                    </code>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </span>
                    <Link
                      href={`/post/${tx.txHash}`}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TX Log */}
      {tab === 'txlog' && (
        <div>
          {txLog.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📡</div>
              <div className="empty-title">No transactions yet</div>
              <div className="empty-sub">All your CKBFS operations will be logged here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {txLog.map(tx => (
                <div key={tx.txHash} className="card anim-fade-up" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span className={`badge badge-${tx.operation}`}>
                      {tx.operation === 'publish' ? '📝' : tx.operation === 'append' ? '🔗' : tx.operation === 'transfer' ? '📤' : '🍴'}{' '}
                      {tx.operation.toUpperCase()}
                    </span>
                    <code style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      flex: 1,
                      wordBreak: 'break-all',
                    }}>
                      {tx.txHash}
                    </code>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </span>
                    {['publish', 'append', 'fork'].includes(tx.operation) && (
                      <Link
                        href={`/post/${tx.txHash}`}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
