'use client';
import { useEffect, useState, useCallback } from 'react';
import StatsBar from './StatsBar';
import FileCard from './FileCard';
import type { useCkbfs } from '@/hooks/useCkbfs';
type CkbfsHook = ReturnType<typeof useCkbfs>;

interface FileEntry {
  fileId: string;
  chunks: number;
  totalSize: number;
  totalCapacity: string;
  outPoints: Array<{ txHash: string; index: string }>;
}

interface Props {
  ckbfs: CkbfsHook;
  address: string;
  onUpdate: (fileId: string) => void;
  onView:   (fileId: string) => void;
}

export default function Dashboard({ ckbfs, address, onUpdate, onView }: Props) {
  const [files,   setFiles]   = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const { consumeFile } = ckbfs;

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/cells?address=${encodeURIComponent(address)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load files');
      setFiles((json.files ?? []) as FileEntry[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleConsume = async (fileId: string) => {
    await consumeFile(fileId);
    setTimeout(refresh, 2000);
  };

  return (
    <div className="anim-fade-in">
      {/* Stats */}
      <StatsBar files={files} loading={loading} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 className="section-title">My Files</h2>
          <p className="section-sub">Live CKBFS cells on Aggron4 testnet</p>
        </div>
        <button className="btn-secondary" onClick={refresh} disabled={loading} style={{ fontSize: 13 }}>
          {loading
            ? <><span className="spinner" style={{ width: 14, height: 14 }} />Refreshing</>
            : '↻ Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card" style={{ borderColor: 'rgba(248,113,113,0.3)', marginBottom: 20, padding: 16 }}>
          <p style={{ color: '#f87171', fontSize: 14 }}>⚠ {error}</p>
        </div>
      )}

      {/* Loading — skeleton grid */}
      {loading && !files.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {[1,2,3].map(i => (
            <div key={i} className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 14 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ height: 14, width: '70%' }} />
                  <div className="skeleton" style={{ height: 20, width: '40%', borderRadius: 99 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="skeleton" style={{ height: 56, borderRadius: 10 }} />
                <div className="skeleton" style={{ height: 56, borderRadius: 10 }} />
              </div>
              <div className="skeleton" style={{ height: 32, borderRadius: 8 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 8 }}>
                <div className="skeleton" style={{ height: 34, borderRadius: 8 }} />
                <div className="skeleton" style={{ height: 34, borderRadius: 8 }} />
                <div className="skeleton" style={{ height: 34, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !files.length && !error && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '72px 24px' }}>
          <div style={{ fontSize: 64, marginBottom: 20, filter: 'drop-shadow(0 0 24px rgba(147,51,234,0.3))' }}>📭</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>No files on-chain yet</h3>
          <p style={{ color: 'var(--on-variant)', fontSize: 14, maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
            Upload your first file to store it permanently as CKBFS cells on the CKB blockchain.
          </p>
        </div>
      )}

      {/* File cards grid */}
      {files.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {files.map((f, i) => (
            <FileCard
              key={f.fileId}
              file={f}
              index={i}
              address={address}
              onConsume={handleConsume}
              onUpdate={onUpdate}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  );
}
