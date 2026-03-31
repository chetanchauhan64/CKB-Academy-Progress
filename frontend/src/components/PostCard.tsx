'use client';

import { memo, useEffect } from 'react';
import Link from 'next/link';
import { CKBFSResolvedData } from '@/lib/ckbfs/indexer';
import { useStore } from '@/lib/store';

interface PostCardProps {
  post: CKBFSResolvedData;
  showAuthor?: boolean;
  style?: React.CSSProperties;
  animDelay?: number;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
}

/** Score used for ranking: upvotes − flags + backlinks (chain activity bonus) */
export function computeScore(upvotes: number, flags: number, backlinks: number): number {
  return upvotes - flags + backlinks;
}

function PostCardInner({ post, showAuthor = true, style, animDelay }: PostCardProps) {
  const { metadata, content, checksum, txHash, backlinks } = post;
  const versionCount = backlinks.length + 1;
  const hasVersions = backlinks.length > 0;

  const { votes, loadVotes } = useStore();

  // Hydrate votes from localStorage once on mount
  useEffect(() => { loadVotes(); }, [loadVotes]);

  const voteRecord = votes[txHash] ?? { upvotes: 0, flags: 0, userVote: null };
  const score = computeScore(voteRecord.upvotes, voteRecord.flags, backlinks.length);
  const isTrending = score >= 3 || (voteRecord.upvotes >= 2 && voteRecord.flags === 0);
  const isFlagged = voteRecord.flags > 0 && voteRecord.flags > voteRecord.upvotes + 1;

  // Estimated reading time
  const wordCount = content.split(/\s+/).length;
  const readMin = Math.max(1, Math.round(wordCount / 200));

  const isPaid = !!(post.metadata as Record<string, unknown>).is_paid;

  return (
    <Link
      href={`/post/${txHash}`}
      id={`post-card-${txHash.slice(2, 10)}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        animationDelay: animDelay ? `${animDelay}ms` : undefined,
        ...style,
      }}
      className="anim-fade-up"
    >
      <article
        className="card"
        style={{
          cursor: 'pointer',
          border: isTrending
            ? '1px solid rgba(0,212,170,0.25)'
            : isFlagged
            ? '1px solid rgba(239,68,68,0.15)'
            : undefined,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.35)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = '';
          (e.currentTarget as HTMLElement).style.boxShadow = '';
        }}
      >
        {/* Badge row */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
          {isTrending && (
            <span style={{
              padding: '2px 9px', borderRadius: 'var(--r-full)',
              background: 'rgba(0,212,170,0.12)', color: 'var(--primary)',
              border: '1px solid rgba(0,212,170,0.25)',
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
            }}>🔥 TRENDING</span>
          )}
          {isPaid && (
            <span style={{
              padding: '2px 9px', borderRadius: 'var(--r-full)',
              background: 'rgba(245,158,11,0.1)', color: 'var(--warning)',
              border: '1px solid rgba(245,158,11,0.2)',
              fontSize: '0.65rem', fontWeight: 700,
            }}>🔒 PAID</span>
          )}
          {isFlagged && (
            <span style={{
              padding: '2px 9px', borderRadius: 'var(--r-full)',
              background: 'rgba(239,68,68,0.08)', color: 'var(--error)',
              border: '1px solid rgba(239,68,68,0.2)',
              fontSize: '0.65rem', fontWeight: 700,
            }}>🚩 FLAGGED</span>
          )}
          {/* Tags */}
          {metadata.tags && metadata.tags.length > 0 &&
            metadata.tags.slice(0, 3).map(t => (
              <span key={t} className="tag">{t}</span>
            ))
          }
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.3,
          marginBottom: '10px', color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}>
          {metadata.title}
        </h2>

        {/* Summary / body preview */}
        {(metadata.description || content) && (
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: 1.65,
            marginBottom: '16px',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {metadata.description || content.replace(/[#*_`[\]]/g, '').slice(0, 200)}
          </p>
        )}

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {showAuthor && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: `linear-gradient(135deg, var(--primary), var(--accent))`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, color: '#000',
                flexShrink: 0,
              }}>
                {metadata.author.slice(-2).toUpperCase()}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {shortAddr(metadata.author)}
              </span>
            </div>
          )}

          {metadata.created_at && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {formatTime(metadata.created_at)}
            </span>
          )}

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {readMin} min read
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {hasVersions && (
              <span className="badge badge-append">v{versionCount}</span>
            )}
            {/* DAO score pill */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', borderRadius: 'var(--r-full)',
              background: score > 0 ? 'rgba(0,212,170,0.08)' : score < 0 ? 'rgba(239,68,68,0.07)' : 'var(--bg-elevated)',
              border: `1px solid ${score > 0 ? 'rgba(0,212,170,0.2)' : score < 0 ? 'rgba(239,68,68,0.15)' : 'var(--border)'}`,
              fontSize: '0.7rem', fontWeight: 600,
              color: score > 0 ? 'var(--primary)' : score < 0 ? 'var(--error)' : 'var(--text-muted)',
            }}>
              <span>▲{voteRecord.upvotes}</span>
              {voteRecord.flags > 0 && <span style={{ color: 'var(--error)', opacity: 0.8 }}>🚩{voteRecord.flags}</span>}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
            }}>
              crc:{(checksum >>> 0).toString(16).padStart(8, '0')}
            </span>
          </div>
        </div>

        {/* CKBFS protocol info strip */}
        <div style={{
          marginTop: '14px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'rgba(0, 212, 170, 0.5)',
          }}>
            CKBFS
          </span>
          <span className="text-mono">{txHash.slice(0, 18)}…</span>
          <span className="text-mono">
            {backlinks.length > 0
              ? `${backlinks.length} backlink${backlinks.length > 1 ? 's' : ''}`
              : 'genesis'}
          </span>
          <span className="text-mono">{post.filename}</span>
          {/* Score text */}
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            score: {score > 0 ? '+' : ''}{score}
          </span>
        </div>
      </article>
    </Link>
  );
}

export default memo(PostCardInner);
