'use client';
import { useState, useRef } from 'react';
import { formatBytes, mimeToEmoji } from '@/utils/format';
import TxStatus from './TxStatus';
import type { useCkbfs } from '@/hooks/useCkbfs';
type CkbfsHook = ReturnType<typeof useCkbfs>;

export default function FileUpdate({ ckbfs, prefillFileId }: { ckbfs: CkbfsHook; prefillFileId?: string }) {
  const [fileId, setFileId] = useState(prefillFileId ?? '');
  const [file,   setFile]   = useState<File | null>(null);
  const [msg,    setMsg]    = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, updateFile, reset } = ckbfs;
  const busy = ['building','signing','broadcasting'].includes(state.status);

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 className="section-title" style={{ marginBottom: 4 }}>Update File</h2>
      <p className="section-sub" style={{ marginBottom: 28 }}>Replace on-chain content while keeping the same File ID</p>

      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label className="label-upper" style={{ display: 'block', marginBottom: 8 }}>File ID</label>
          <input className="input-field mono" placeholder="0xabc123…" value={fileId}
            onChange={e => { setFileId(e.target.value); reset(); }} />
        </div>
        <div>
          <label className="label-upper" style={{ display: 'block', marginBottom: 8 }}>Replacement File</label>
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 28 }}>{mimeToEmoji(file.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                <p style={{ color: 'var(--on-variant)', fontSize: 12, marginTop: 2 }}>{formatBytes(file.size)}</p>
              </div>
              <button className="btn-icon" onClick={() => { setFile(null); reset(); }} style={{ fontSize: 20 }}>×</button>
            </div>
          ) : (
            <div className="drop-zone" style={{ padding: '28px 16px' }} onClick={() => inputRef.current?.click()}>
              <p style={{ color: 'var(--on-variant)', fontSize: 14 }}>Click to select replacement file</p>
              <input ref={inputRef} type="file" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); reset(); } }} />
            </div>
          )}
        </div>

        <TxStatus state={state} statusMsg={msg} onReset={reset} compact />

        <button
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '13px 20px' }}
          disabled={!fileId.trim() || !file || busy}
          onClick={async () => { setMsg(''); try { await updateFile(fileId.trim(), file!, setMsg); } catch {} }}
        >
          {busy ? <><span className="spinner" style={{ width: 15, height: 15 }} />{msg || 'Processing…'}</> : '✏️  Update File'}
        </button>
      </div>
    </div>
  );
}
