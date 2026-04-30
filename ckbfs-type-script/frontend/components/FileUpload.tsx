'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { formatBytes, mimeToEmoji } from '@/utils/format';
import TxStatus from './TxStatus';
import type { useCkbfs } from '@/hooks/useCkbfs';
type CkbfsHook = ReturnType<typeof useCkbfs>;

export default function FileUpload({ ckbfs }: { ckbfs: CkbfsHook }) {
  const [file, setFile]       = useState<File | null>(null);
  const [dragging, setDrag]   = useState(false);
  const [statusMsg, setMsg]   = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const { state, createFile, reset } = ckbfs;
  const busy = ['building','signing','broadcasting'].includes(state.status);

  // Generate image preview URL when a file is picked
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    if (!file.type.startsWith('image/')) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = useCallback((f: File) => { setFile(f); reset(); setMsg(''); }, [reset]);

  const handleUpload = async () => {
    if (!file) return;
    try {
      await createFile(file, (msg) => setMsg(msg));
    } catch { /* error shown in TxStatus */ }
  };

  const clear = () => { setFile(null); setPreview(null); reset(); setMsg(''); };

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 className="section-title" style={{ marginBottom: 4 }}>Upload File</h2>
      <p className="section-sub" style={{ marginBottom: 28 }}>
        Store any file permanently on CKB Pudge Testnet as CKBFS cells
      </p>

      {/* ── Drop zone (no file selected) ── */}
      {!file ? (
        <div
          className={`drop-zone ${dragging ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <div style={{ fontSize: 40, marginBottom: 14, filter: 'drop-shadow(0 0 16px rgba(147,51,234,0.4))' }}>⬆️</div>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Drag &amp; drop or click to browse</p>
          <p style={{ color: 'var(--on-variant)', fontSize: 13 }}>Any file type · split into 32 KB chunks</p>
          <input ref={inputRef} type="file" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); }} />
        </div>
      ) : (
        /* ── File selected card ── */
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>

          {/* Image preview (only for image/* types) */}
          {preview && (
            <div style={{
              width: '100%', maxHeight: 220, overflow: 'hidden',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="preview"
                style={{
                  maxWidth: '100%', maxHeight: 220,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* File metadata row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(147,51,234,0.15)',
              border: '1px solid rgba(147,51,234,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>
              {mimeToEmoji(file.type)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontWeight: 700, fontSize: 14,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 4,
              }}>{file.name}</p>
              <p style={{ color: 'var(--on-variant)', fontSize: 12 }}>
                {formatBytes(file.size)}
                {file.type ? ` · ${file.type}` : ''}
                {` · ${Math.ceil(file.size / (32 * 1024))} chunk${Math.ceil(file.size / (32 * 1024)) !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              className="btn-icon"
              onClick={clear}
              style={{ fontSize: 22, flexShrink: 0 }}
              aria-label="Remove file"
              title="Remove file"
            >×</button>
          </div>
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
          : '⬆️  Upload to CKB Pudge Testnet'}
      </button>
    </div>
  );
}
