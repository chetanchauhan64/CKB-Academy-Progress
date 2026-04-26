'use client';
/**
 * components/FileCard.tsx — Premium file card with hover glow
 */
import { formatBytes, formatCkb, shortenHash, explorerTxUrl } from '@/utils/format';

interface FileEntry {
  fileId: string;
  chunks: number;
  totalSize: number;
  totalCapacity: string;
  outPoints: Array<{ txHash: string; index: string }>;
}

interface Props {
  file: FileEntry;
  index: number;
  address: string;
  onConsume: (fileId: string) => void;
  onUpdate: (fileId: string) => void;
  onView: (fileId: string) => void;
}

const FILE_ICONS = ['📄', '🖼️', '🎬', '🎵', '📦', '📋', '📁'];

function randomIcon(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FILE_ICONS[h % FILE_ICONS.length];
}

export default function FileCard({ file, index, address, onConsume, onUpdate, onView }: Props) {
  const icon   = randomIcon(file.fileId);
  const short  = `${file.fileId.slice(2, 8)}…${file.fileId.slice(-6)}`;
  const txLink = file.outPoints?.[0] ? explorerTxUrl(file.outPoints[0].txHash) : null;

  return (
    <div
      className={`file-card anim-fade-in delay-${Math.min(index + 1, 4)}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(147,51,234,0.25), rgba(8,145,178,0.2))',
          border: '1px solid rgba(147,51,234,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--on-surface)', marginBottom: 4 }}>
            File <span className="mono-text" style={{ color: 'var(--primary)', fontSize: 12 }}>{short}</span>
          </p>
          <span className="badge badge-info">{file.chunks} chunk{file.chunks !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Size',   value: formatBytes(file.totalSize) },
          { label: 'Locked', value: formatCkb(BigInt(file.totalCapacity ?? '0x0')) },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
            <p className="label-upper" style={{ marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Explorer link */}
      {txLink && (
        <a href={txLink} target="_blank" rel="noreferrer"
           style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--secondary)', textDecoration: 'none', padding: '6px 10px', background: 'rgba(34,211,238,0.06)', borderRadius: 8, border: '1px solid rgba(34,211,238,0.15)' }}>
          <span className="mono-text">{shortenHash(file.outPoints[0].txHash, 8)}</span>
          <span>↗</span>
        </a>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
        <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => onView(file.fileId)}>
          👁 View
        </button>
        <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => onUpdate(file.fileId)}>
          ✏️ Update
        </button>
        <button className="btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => {
          if (confirm(`Consume ${short}? This is permanent.`)) onConsume(file.fileId);
        }}>
          🗑
        </button>
      </div>
    </div>
  );
}
