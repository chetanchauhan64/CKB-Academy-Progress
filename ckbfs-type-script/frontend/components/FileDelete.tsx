'use client';
import { useState } from 'react';
import TxStatus from './TxStatus';
import type { useCkbfs } from '@/hooks/useCkbfs';
type CkbfsHook = ReturnType<typeof useCkbfs>;

export default function FileDelete({ ckbfs, prefillFileId }: { ckbfs: CkbfsHook; prefillFileId?: string }) {
  const [fileId, setFileId]   = useState(prefillFileId ?? '');
  const [confirmed, setConf]  = useState(false);
  const [msg, setMsg]         = useState('');
  const { state, consumeFile, reset } = ckbfs;
  const busy = ['building','signing','broadcasting'].includes(state.status);

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 className="section-title" style={{ color: 'var(--danger)', marginBottom: 4 }}>Consume File</h2>
      <p className="section-sub" style={{ marginBottom: 28 }}>Destroy on-chain cells and recover locked CKB</p>

      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label className="label-upper" style={{ display: 'block', marginBottom: 8 }}>File ID to Consume</label>
          <input className="input-field mono" placeholder="0xabc123…" value={fileId}
            onChange={e => { setFileId(e.target.value); reset(); setConf(false); }} />
        </div>

        {fileId.trim() && state.status !== 'success' && (
          <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: 14, padding: '16px 18px' }}>
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>⚠ Irreversible Action</p>
            <p style={{ color: 'rgba(248,113,113,0.7)', fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
              All chunks for this file will be permanently destroyed. The locked CKB will be returned to your wallet.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConf(e.target.checked)}
                style={{ accentColor: '#f87171', width: 16, height: 16 }} />
              <span style={{ color: '#f87171', fontSize: 13 }}>I understand — this is permanent</span>
            </label>
          </div>
        )}

        <TxStatus state={state} statusMsg={msg} onReset={reset} compact />

        <button
          className="btn-danger"
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '13px 20px' }}
          disabled={!fileId.trim() || !confirmed || busy}
          onClick={async () => { setMsg(''); try { await consumeFile(fileId.trim(), setMsg); } catch {} }}
        >
          {busy ? <><span className="spinner" style={{ width: 15, height: 15, borderTopColor: '#f87171' }} />{msg || 'Processing…'}</> : '🗑  Consume & Recover CKB'}
        </button>
      </div>
    </div>
  );
}
