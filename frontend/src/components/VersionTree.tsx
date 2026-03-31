'use client';

import { useRouter } from 'next/navigation';
import { VersionNode } from '@/lib/ckbfs/indexer';

interface VersionTreeProps {
  root: VersionNode;
  currentTxHash: string;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function formatTs(ts: number | undefined): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Single tree node (recursive) ────────────────────────────────────────────

interface TreeNodeProps {
  node: VersionNode;
  currentTxHash: string;
  versionLabel: string;
  isLast: boolean;
}

function TreeNode({ node, currentTxHash, versionLabel, isLast }: TreeNodeProps) {
  const router = useRouter();
  const isCurrent = node.txHash === currentTxHash;
  const isGenesis = node.depth === 0 && !node.isFork;

  // Colour palette
  const dotColor = isCurrent
    ? 'var(--primary)'
    : node.isFork
    ? 'var(--success)'
    : isGenesis
    ? 'var(--accent)'
    : 'var(--text-muted)';

  const labelBg = isCurrent
    ? 'rgba(0,212,170,0.12)'
    : node.isFork
    ? 'rgba(16,185,129,0.10)'
    : isGenesis
    ? 'rgba(124,111,255,0.10)'
    : 'rgba(255,255,255,0.04)';

  const labelColor = isCurrent
    ? 'var(--primary)'
    : node.isFork
    ? 'var(--success)'
    : isGenesis
    ? 'var(--accent)'
    : 'var(--text-muted)';

  const labelBorder = isCurrent
    ? 'rgba(0,212,170,0.25)'
    : node.isFork
    ? 'rgba(16,185,129,0.20)'
    : isGenesis
    ? 'rgba(124,111,255,0.20)'
    : 'rgba(255,255,255,0.08)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Row: connector + dot + content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Vertical rail + dot */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '20px' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: dotColor,
              boxShadow: isCurrent ? `0 0 10px ${dotColor}` : 'none',
              border: `2px solid ${isCurrent ? dotColor : 'var(--border)'}`,
              flexShrink: 0,
              marginTop: '2px',
              transition: 'box-shadow 0.2s',
            }}
          />
          {/* Connector line down to children */}
          {node.children.length > 0 && (
            <div
              style={{
                width: '2px',
                flex: 1,
                minHeight: '14px',
                background: `linear-gradient(to bottom, ${dotColor}55, var(--border-subtle))`,
                margin: '4px 0',
              }}
            />
          )}
        </div>

        {/* Node card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/post/${node.txHash}`)}
          onKeyDown={e => e.key === 'Enter' && router.push(`/post/${node.txHash}`)}
          style={{
            flex: 1,
            marginBottom: node.children.length > 0 ? '0' : '14px',
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            background: isCurrent ? 'rgba(0,212,170,0.06)' : 'var(--bg-elevated)',
            border: `1px solid ${isCurrent ? 'rgba(0,212,170,0.25)' : 'var(--border)'}`,
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
            outline: 'none',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = dotColor;
            (e.currentTarget as HTMLDivElement).style.transform = 'translateX(2px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = isCurrent ? 'rgba(0,212,170,0.25)' : 'var(--border)';
            (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)';
          }}
        >
          {/* Badge row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '5px' }}>
            <span
              style={{
                fontSize: '0.62rem', fontWeight: 700, padding: '1px 7px',
                borderRadius: 'var(--r-full)',
                background: labelBg, color: labelColor,
                border: `1px solid ${labelBorder}`,
                letterSpacing: '0.04em', textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              {isGenesis && !node.isFork ? 'Genesis' : versionLabel}
              {isCurrent ? ' · HEAD' : ''}
              {node.isFork ? ' · Fork' : ''}
            </span>

            {/* Current pulse dot */}
            {isCurrent && (
              <span
                style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--primary)',
                  boxShadow: '0 0 6px var(--primary-glow)',
                  animation: 'pulse-glow 2s ease-in-out infinite',
                  flexShrink: 0,
                }}
              />
            )}

            {/* Timestamp */}
            {node.timestamp && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {formatTs(node.timestamp)}
              </span>
            )}
          </div>

          {/* TX hash */}
          <code style={{
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            color: isCurrent ? 'var(--primary)' : 'var(--text-secondary)',
            display: 'block',
            wordBreak: 'break-all',
            lineHeight: 1.4,
          }}>
            {shortHash(node.txHash)}
          </code>

          {/* Checksum */}
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>
            Adler32: 0x{(node.checksum >>> 0).toString(16).padStart(8, '0')}
          </div>
        </div>
      </div>

      {/* Children — rendered below with indentation for forks */}
      {node.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {node.children.map((child, idx) => {
            const childIsLast = idx === node.children.length - 1;
            // Linear child uses parent's version counter; fork gets its own label
            const childLabel = child.isFork
              ? `Fork ${idx}`
              : `V${child.depth + 1}`;

            return (
              <div
                key={child.txHash}
                style={{
                  marginLeft: child.isFork ? '16px' : '0',
                  paddingLeft: child.isFork ? '14px' : '0',
                  borderLeft: child.isFork ? '2px solid rgba(16,185,129,0.25)' : 'none',
                  marginBottom: child.isFork && !childIsLast ? '4px' : '0',
                }}
              >
                <TreeNode
                  node={child}
                  currentTxHash={currentTxHash}
                  versionLabel={childLabel}
                  isLast={childIsLast}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function VersionTree({ root, currentTxHash }: VersionTreeProps) {
  const totalNodes = countNodes(root);

  return (
    <div>
      {/* Header bar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '16px', flexWrap: 'wrap', gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1rem' }}>🌳</span>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Version Tree</span>
          <span
            style={{
              fontSize: '0.7rem', padding: '2px 8px',
              background: 'rgba(0,212,170,0.08)',
              border: '1px solid rgba(0,212,170,0.15)',
              borderRadius: 'var(--r-full)',
              color: 'var(--primary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {totalNodes} node{totalNodes !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
            HEAD
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            Genesis
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            Fork
          </span>
        </div>
      </div>

      {/* Protocol bar */}
      <div className="protocol-bar" style={{ marginBottom: '20px' }}>
        <div className="pbar-item">
          <div className="pbar-dot" />
          <span>Genesis → HEAD</span>
        </div>
        <div className="pbar-item">
          <div className="pbar-dot" style={{ background: 'var(--success)' }} />
          <span>Forks are indented branches</span>
        </div>
        <div className="pbar-item">
          <div className="pbar-dot" style={{ background: 'var(--accent)' }} />
          <span>Click any node to navigate</span>
        </div>
      </div>

      {/* Tree */}
      <TreeNode
        node={root}
        currentTxHash={currentTxHash}
        versionLabel="V1"
        isLast={true}
      />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countNodes(node: VersionNode): number {
  return 1 + node.children.reduce((acc, c) => acc + countNodes(c), 0);
}
