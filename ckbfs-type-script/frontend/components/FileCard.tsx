'use client';
/**
 * components/FileCard.tsx — Premium file card with hover glow
 * Week 20: displays fileName, MIME type, script version, upload date.
 */
import { formatBytes, formatCkb, shortenHash, explorerTxUrl } from '@/utils/format';

interface FileEntry {
  fileId        : string;
  chunks        : number;
  totalSize     : number;
  totalCapacity : string;
  outPoints     : Array<{ txHash: string; index: string }>;
  // Week 20 metadata (may be absent for files uploaded from another device)
  fileName      ?: string;
  mimeType      ?: string;
  scriptVersion ?: string;
  txHash        ?: string;
  uploadedAt    ?: number;
}

interface Props {
  file      : FileEntry;
  index     : number;
  address   : string;
  onConsume : (fileId: string) => void;
  onUpdate  : (fileId: string) => void;
  onView    : (fileId: string) => void;
}

const FILE_ICONS: Record<string, string> = {
  'image/'      : '🖼️',
  'video/'      : '🎬',
  'audio/'      : '🎵',
  'text/'       : '📝',
  'application/pdf'  : '📕',
  'application/json' : '📋',
  'application/zip'  : '📦',
};

function mimeIcon(mime?: string): string {
  if (!mime) return '📄';
  for (const [prefix, icon] of Object.entries(FILE_ICONS)) {
    if (mime.startsWith(prefix)) return icon;
  }
  return '📄';
}

function randomIcon(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ['📄','🖼️','🎬','🎵','📦','📋','📁'][h % 7];
}

function formatDate(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FileCard({ file, index, address, onConsume, onUpdate, onView }: Props) {
  const icon     = file.mimeType ? mimeIcon(file.mimeType) : randomIcon(file.fileId);
  const label    = file.fileName ?? `File ${file.fileId.slice(2, 8)}…${file.fileId.slice(-6)}`;
  const short    = `${file.fileId.slice(2, 8)}…${file.fileId.slice(-6)}`;
  const txLink   = file.outPoints?.[0] ? explorerTxUrl(file.outPoints[0].txHash) : null;
  const version  = file.scriptVersion ?? 'v1';
  const uploaded = formatDate(file.uploadedAt);
  void address;

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
          {/* Week 20: show human-readable fileName if available */}
          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--on-surface)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-info">{file.chunks} chunk{file.chunks !== 1 ? 's' : ''}</span>
            {/* Week 20: script version badge */}
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: 'rgba(147,51,234,0.15)', color: 'rgba(147,51,234,0.9)', fontWeight: 600 }}>
              {version}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Size',   value: formatBytes(file.totalSize) },
          { label: 'Locked', value: formatCkb(BigInt(file.totalCapacity ?? '0x0')) },
        ].map(({ label: l, value }) => (
          <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
            <p className="label-upper" style={{ marginBottom: 4 }}>{l}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Week 20: MIME type + upload date row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--on-variant)' }}>
        {file.mimeType && (
          <span className="mono-text" style={{ opacity: 0.7 }}>{file.mimeType}</span>
        )}
        {!file.mimeType && (
          <span className="mono-text" style={{ opacity: 0.5 }}>{short}</span>
        )}
        {uploaded && <span>{uploaded}</span>}
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
          if (confirm(`Consume "${label}"? This is permanent.`)) onConsume(file.fileId);
        }}>
          🗑
        </button>
      </div>
    </div>
  );
}
