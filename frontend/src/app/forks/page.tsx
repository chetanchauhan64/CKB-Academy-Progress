'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { CKBFSResolvedData, detectForkedPosts, buildVersionTree, VersionNode } from '@/lib/ckbfs/indexer';

// ─── Utils ──────────────────────────────────────────────────────────────────

function shortHash(hash: string): string {
  return `${hash.slice(0, 12)}…${hash.slice(-6)}`;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Version Tree Visualizer ─────────────────────────────────────────────────

function TreeNode({ node, depth }: { node: VersionNode; depth: number }) {
  return (
    <div style={{ marginLeft: depth * 24, position: 'relative' }}>
      {depth > 0 && (
        <div style={{
          position: 'absolute', left: -16, top: 14,
          width: 12, height: 2, background: 'var(--border)',
        }} />
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 12px', marginBottom: '6px',
        background: node.isFork ? 'rgba(124,111,255,0.06)' : node.parentTxHash === null ? 'rgba(0,212,170,0.06)' : 'var(--bg-elevated)',
        border: `1px solid ${node.isFork ? 'rgba(124,111,255,0.2)' : node.parentTxHash === null ? 'rgba(0,212,170,0.2)' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)', flexWrap: 'wrap',
      }}>
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
          background: node.isFork ? 'var(--accent)' : node.parentTxHash === null ? 'var(--primary)' : 'var(--text-muted)',
          boxShadow: node.parentTxHash === null ? '0 0 6px var(--primary-glow)' : 'none',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
            {shortHash(node.txHash)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            depth: {node.depth} · checksum: 0x{(node.checksum >>> 0).toString(16).padStart(8, '0')}
            {node.timestamp && ` · ${formatTime(node.timestamp)}`}
          </div>
        </div>
        {node.parentTxHash === null && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px',
            background: 'rgba(0,212,170,0.12)', color: 'var(--primary)',
            border: '1px solid rgba(0,212,170,0.2)', borderRadius: 'var(--r-full)',
          }}>
            GENESIS
          </span>
        )}
        {node.isFork && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px',
            background: 'rgba(124,111,255,0.12)', color: 'var(--accent)',
            border: '1px solid rgba(124,111,255,0.2)', borderRadius: 'var(--r-full)',
          }}>
            FORK
          </span>
        )}
        <Link href={`/post/${node.txHash}`} className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
          View →
        </Link>
      </div>

      {/* Render children recursively */}
      {node.children.map((child, i) => (
        <TreeNode key={`${child.txHash}-${i}`} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

// ─── Fork Group Card ─────────────────────────────────────────────────────────

function ForkGroupCard({
  original,
  branches,
  index,
}: {
  original: CKBFSResolvedData;
  branches: CKBFSResolvedData[];
  index: number;
}) {
  const [showTree, setShowTree] = useState(false);
  const tree = buildVersionTree(original);

  return (
    <div className="card anim-fade-up" style={{ animationDelay: `${index * 80}ms`, marginBottom: '20px' }}>
      {/* Original post header */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span className="badge badge-publish" style={{ fontSize: '0.65rem' }}>ORIGIN</span>
            <Link href={`/post/${original.txHash}`} style={{
              fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)',
              textDecoration: 'none',
            }}>
              {original.metadata.title}
            </Link>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>by {original.metadata.author.slice(0, 12)}…</span>
            <span>·</span>
            <span>{formatTime(original.metadata.created_at)}</span>
            <span>·</span>
            <span>{branches.length} fork branch{branches.length !== 1 ? 'es' : ''}</span>
            <span>·</span>
            <span>v{original.backlinks.length + 1}</span>
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowTree(v => !v)}
          id={`tree-toggle-${original.txHash.slice(2, 8)}`}
        >
          {showTree ? '📂 Hide Tree' : '🌿 Show Version Tree'}
        </button>
      </div>

      {/* Branch list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: showTree ? '16px' : '0' }}>
        {branches.map((branch, i) => (
          <div key={branch.txHash} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 14px',
            background: 'rgba(124,111,255,0.05)',
            border: '1px solid rgba(124,111,255,0.15)',
            borderRadius: 'var(--r-md)', flexWrap: 'wrap',
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.8rem' }}>🌿 Branch {i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '2px' }}>{branch.metadata.title}</div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {shortHash(branch.txHash)} · {formatTime(branch.metadata.created_at)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className="badge badge-append" style={{ fontSize: '0.65rem' }}>v{branch.backlinks.length + 1}</span>
              <Link href={`/post/${branch.txHash}`} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>
                View →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Version Tree */}
      {showTree && (
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '16px',
          marginTop: '4px',
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>
            📐 VERSION TREE — Genesis to Latest
          </div>
          <TreeNode node={tree} depth={0} />
        </div>
      )}
    </div>
  );
}

// ─── Fork Explorer Page ──────────────────────────────────────────────────────

export default function ForksPage() {
  const { posts, loadAllPosts, globalLoading } = useStore();
  const [forkMap, setForkMap] = useState<Map<string, CKBFSResolvedData[]>>(new Map());
  const [originMap, setOriginMap] = useState<Map<string, CKBFSResolvedData>>(new Map());

  useEffect(() => {
    loadAllPosts();
  }, [loadAllPosts]);

  useEffect(() => {
    if (posts.length > 0) {
      const detected = detectForkedPosts(posts);
      setForkMap(detected);

      // Build map from txHash → post for quick origin lookup
      const oMap = new Map<string, CKBFSResolvedData>();
      for (const post of posts) oMap.set(post.txHash, post);
      setOriginMap(oMap);
    }
  }, [posts]);

  const forkGroups = Array.from(forkMap.entries())
    .filter(([parentHash]) => originMap.has(parentHash))
    .map(([parentHash, branches]) => ({ original: originMap.get(parentHash)!, branches }));

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }} className="anim-fade-up">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <h1 className="heading-xl" style={{ marginBottom: '8px' }}>🍴 Fork Explorer</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              All forked posts across the CKBFS network — grouped by original post with full branch trees.
              Forking creates a new TYPE_ID cell that inherits the complete version history as CellDeps.
            </p>
          </div>
          <Link href="/dashboard" className="btn btn-secondary btn-sm">← Dashboard</Link>
        </div>

        <div className="protocol-bar">
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--primary)' }} />
            <span>{posts.length} posts indexed</span>
          </div>
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--accent)' }} />
            <span>{forkGroups.length} fork group{forkGroups.length !== 1 ? 's' : ''} detected</span>
          </div>
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--warning)' }} />
            <span>{Array.from(forkMap.values()).flat().length} branch{Array.from(forkMap.values()).flat().length !== 1 ? 'es' : ''} total</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {globalLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '200px' }} />)}
        </div>
      ) : forkGroups.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">🌱</div>
          <div className="empty-title">No forks detected yet</div>
          <div className="empty-sub">
            When posts are forked on CKBFS, they share backlink ancestry with the original post.
            Fork any post to start a new branch inheriting the full version history.
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="btn btn-primary">Browse Feed</Link>
            <Link href="/write" className="btn btn-secondary">Write New Post</Link>
          </div>

          {/* Show all posts as genesis nodes even if no forks */}
          {posts.length > 0 && (
            <div style={{ marginTop: '32px', width: '100%', textAlign: 'left' }}>
              <h3 className="heading-sm" style={{ marginBottom: '14px', color: 'var(--text-secondary)' }}>
                🌿 All Posts (Genesis Nodes)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {posts.map(post => {
                  const tree = buildVersionTree(post);
                  return (
                    <div key={post.txHash}>
                      <TreeNode node={tree} depth={0} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {forkGroups.map(({ original, branches }, i) => (
            <ForkGroupCard key={original.txHash} original={original} branches={branches} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
