'use client';

import { VersionEntry, BackLink } from '@/lib/ckbfs/types';

interface VersionHistoryProps {
  versions: VersionEntry[];
  backlinks: BackLink[];
  currentTxHash: string;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function formatChecksum(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

export default function VersionHistory({ versions, backlinks, currentTxHash }: VersionHistoryProps) {
  if (versions.length <= 1) {
    return (
      <div style={{
        padding: '20px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
      }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🌱</div>
        This is the genesis version — no prior versions exist.
      </div>
    );
  }

  return (
    <div>
      {/* Backlink chain header */}
      <div className="protocol-bar" style={{ marginBottom: '20px' }}>
        <div className="pbar-item">
          <div className="pbar-dot" />
          <span>Backlink chain: {backlinks.length} link{backlinks.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="pbar-item">
          <div className="pbar-dot" style={{ background: 'var(--accent)' }} />
          <span>Append-only · Immutable</span>
        </div>
      </div>

      <div className="version-timeline">
        {versions.map((v, i) => {
          const isCurrent = v.txHash === currentTxHash;
          const isGenesis = i === 0;
          return (
            <div key={v.txHash} className="version-item">
              <div
                className="version-dot"
                style={{
                  background: isCurrent ? 'var(--primary)' : isGenesis ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
                  borderColor: isCurrent ? 'var(--primary)' : isGenesis ? 'var(--accent)' : 'var(--border)',
                  color: isCurrent ? '#000' : 'var(--primary)',
                  boxShadow: isCurrent ? '0 0 12px var(--primary-glow)' : undefined,
                }}
              >
                {isCurrent ? '★' : (i + 1)}
              </div>
              <div className="version-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    className="badge"
                    style={{
                      background: isGenesis
                        ? 'rgba(0, 212, 170, 0.12)'
                        : isCurrent
                        ? 'rgba(124, 111, 255, 0.15)'
                        : 'rgba(245, 158, 11, 0.12)',
                      color: isGenesis ? 'var(--primary)' : isCurrent ? 'var(--accent)' : 'var(--warning)',
                      border: 'none',
                    }}
                  >
                    {isGenesis ? 'Genesis' : isCurrent ? 'Current' : `v${i + 1}`}
                  </span>
                  {v.timestamp && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(v.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="version-title">
                  {v.content?.title || '(Untitled)'}
                </div>

                {/* CKBFS metadata */}
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      TX:
                    </span>
                    <code style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: isCurrent ? 'var(--primary)' : 'var(--text-muted)',
                      wordBreak: 'break-all',
                    }}>
                      {shortHash(v.txHash)}
                    </code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Adler32:
                    </span>
                    <code style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                    }}>
                      0x{formatChecksum(v.checksum)}
                    </code>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      · witness[{v.witnessIndex}]
                    </span>
                  </div>
                </div>

                {/* Backlink note for non-genesis */}
                {!isGenesis && i > 0 && (
                  <div style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    background: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.12)',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '0.72rem',
                    color: 'var(--warning)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    ← backlink[{i - 1}] · chains from 0x{formatChecksum(versions[i - 1]?.checksum ?? 0)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
