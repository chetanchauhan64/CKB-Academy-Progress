'use client';
import { useState, useCallback, useRef } from 'react';
import { formatBytes, mimeToEmoji } from '@/utils/format';
import TxStatus from './TxStatus';
import type { useCkbfs } from '@/hooks/useCkbfs';
type CkbfsHook = ReturnType<typeof useCkbfs>;

export default function FileUpload({ ckbfs }: { ckbfs: CkbfsHook }) {
  const [file, setFile]     = useState<File | null>(null);
  const [dragging, setDrag] = useState(false);
  const [statusMsg, setMsg] = useState('');
  const inputRef            = useRef<HTMLInputElement>(null);
  const { state, createFile, reset } = ckbfs;
  const busy = ['building','signing','broadcasting'].includes(state.status);

  const pick = useCallback((f: File) => { setFile(f); reset(); }, [reset]);

  const handleUpload = async () => {
    if (!file) return;
    try {
      await createFile(file, (msg) => setMsg(msg));
    } catch { /* toast already shown */ }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 className="section-title" style={{ marginBottom: 4 }}>Upload File</h2>
      <p className="section-sub" style={{ marginBottom: 28 }}>Store any file permanently on CKB as CKBFS cells</p>

      {/* Drop zone */}
      {!file ? (
        <div
          className={`drop-zone ${dragging ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <div style={{ fontSize: 40, marginBottom: 14, filter: 'drop-shadow(0 0 16px rgba(147,51,234,0.4))' }}>⬆️</div>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Drag & drop or click to browse</p>
          <p style={{ color: 'var(--on-variant)', fontSize: 13 }}>Any file type · split into 32 KB chunks</p>
          <input ref={inputRef} type="file" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); }} />
        </div>
      ) : (
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(147,51,234,0.15)', border: '1px solid rgba(147,51,234,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
            {mimeToEmoji(file.type)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{file.name}</p>
            <p style={{ color: 'var(--on-variant)', fontSize: 12 }}>{formatBytes(file.size)} · {file.type || 'binary'}</p>
          </div>
          <button className="btn-icon" onClick={() => { setFile(null); reset(); setMsg(''); }} style={{ fontSize: 22 }}>×</button>
        </div>
      )}

      {/* Tx status */}
      <TxStatus state={state} statusMsg={statusMsg} onReset={reset} />

      {/* Upload button */}
      <button
        className="btn-primary"
        style={{ marginTop: 20, width: '100%', justifyContent: 'center', fontSize: 15, padding: '14px 20px' }}
        onClick={handleUpload}
        disabled={!file || busy}
      >
        {busy
          ? <><span className="spinner" style={{ width: 16, height: 16 }} />{statusMsg || 'Processing…'}</>
          : '⬆️  Upload to CKB Blockchain'}
      </button>
    </div>
  );
}
