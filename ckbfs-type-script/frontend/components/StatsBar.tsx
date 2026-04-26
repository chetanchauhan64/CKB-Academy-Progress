'use client';
/**
 * components/StatsBar.tsx — Animated stat cards row
 * Shows: Total Files · Total Storage · CKB Locked · Network
 */
import { formatBytes, formatCkb } from '@/utils/format';

interface Props {
  files: Array<{ totalSize: number; totalCapacity: string }>;
  loading: boolean;
}

const ICONS = ['🗂', '💾', '⛓️', '🌐'];
const LABELS = ['Total Files', 'Total Storage', 'CKB Locked', 'Network'];
const COLORS = ['#a855f7', '#22d3ee', '#4ade80', '#fbbf24'];

function Skeleton() {
  return <div className="skeleton" style={{ width: '80%', height: 28, borderRadius: 8, marginTop: 8 }} />;
}

export default function StatsBar({ files, loading }: Props) {
  const totalFiles   = files.length;
  const totalBytes   = files.reduce((s, f) => s + (f.totalSize || 0), 0);
  const totalLocked  = files.reduce((s, f) => s + BigInt(f.totalCapacity || '0x0'), 0n);

  const stats = [
    { label: 'Total Files',   value: loading ? null : totalFiles.toString(),               icon: ICONS[0], color: COLORS[0] },
    { label: 'Total Storage', value: loading ? null : formatBytes(totalBytes),              icon: ICONS[1], color: COLORS[1] },
    { label: 'CKB Locked',    value: loading ? null : formatCkb(totalLocked),              icon: ICONS[2], color: COLORS[2] },
    { label: 'Network',       value: 'Aggron4',                                             icon: ICONS[3], color: COLORS[3] },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
      {stats.map((s, i) => (
        <div key={s.label} className={`stat-card anim-slide-up delay-${i + 1}`}>
          {/* Bg blob */}
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: s.color, opacity: 0.06, filter: 'blur(20px)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="label-upper">{s.label}</span>
            <span style={{
              width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${s.color}1a`, border: `1px solid ${s.color}30`, fontSize: 16,
            }}>{s.icon}</span>
          </div>
          {s.value === null ? (
            <Skeleton />
          ) : (
            <p style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: -0.5, lineHeight: 1 }}>{s.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}
