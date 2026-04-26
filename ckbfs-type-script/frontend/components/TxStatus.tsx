'use client';
/**
 * components/TxStatus.tsx — Full 4-state transaction feedback
 * States: building → signing → broadcasting → success | error
 */
import { explorerTxUrl } from '@/utils/format';
import type { OperationState } from '@/types';
import { useState } from 'react';

const STEP_LABELS: Record<string, string> = {
  building:     'Building transaction…',
  signing:      'Waiting for wallet signature…',
  broadcasting: 'Broadcasting to CKB network…',
  success:      'Transaction confirmed!',
  error:        'Transaction failed',
};

const STEP_ICONS: Record<string, string> = {
  building: '🔨', signing: '✍️', broadcasting: '📡', success: '✅', error: '❌',
};

interface Props {
  state: OperationState;
  statusMsg?: string;
  onReset?: () => void;
  compact?: boolean;
}

export default function TxStatus({ state, statusMsg, onReset, compact = false }: Props) {
  const [copied, setCopied] = useState(false);

  if (state.status === 'idle') return null;

  const label  = statusMsg || STEP_LABELS[state.status] || state.status;
  const isActive = ['building','signing','broadcasting'].includes(state.status);

  const copyTx = () => {
    if (!state.txHash) return;
    navigator.clipboard.writeText(state.txHash).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  return (
    <div className={`tx-card ${state.status === 'success' ? 'success' : state.status === 'error' ? 'error' : 'pending'} anim-scale-in`}
         style={{ marginTop: compact ? 12 : 20 }}>

      {/* Status header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: state.status === 'success' || state.status === 'error' ? 14 : 0 }}>
        {isActive ? (
          <span className="spinner" style={{ flexShrink: 0 }} />
        ) : (
          <span style={{ fontSize: 20 }}>{STEP_ICONS[state.status]}</span>
        )}
        <div style={{ flex: 1 }}>
          <p style={{
            fontWeight: 700, fontSize: 14,
            color: state.status === 'success' ? '#4ade80' : state.status === 'error' ? '#f87171' : 'var(--primary)',
          }}>{label}</p>
          {state.status === 'error' && state.error && (
            <p style={{ fontSize: 12, color: 'rgba(248,113,113,0.7)', marginTop: 4 }}>{state.error}</p>
          )}
        </div>
        {onReset && !isActive && (
          <button className="btn-icon" onClick={onReset} style={{ fontSize: 16 }}>×</button>
        )}
      </div>

      {/* Step dots (only while active) */}
      {isActive && !compact && (
        <div className="step-bar" style={{ marginTop: 14 }}>
          {['building','signing','broadcasting'].map((s, i) => {
            const steps = ['building','signing','broadcasting'];
            const cur   = steps.indexOf(state.status);
            return (
              <>
                <div key={s} className={`step-dot ${i < cur ? 'done' : i === cur ? 'active' : ''}`} />
                {i < 2 && <div key={`l${i}`} className={`step-line ${i < cur ? 'done' : ''}`} />}
              </>
            );
          })}
        </div>
      )}

      {/* Success tx details */}
      {state.status === 'success' && state.txHash && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono-text" style={{ fontSize: 12, color: 'var(--secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {state.txHash}
            </span>
            <button className="btn-icon" onClick={copyTx} style={{ fontSize: 13, flexShrink: 0 }}>{copied ? '✓' : '⧉'}</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={explorerTxUrl(state.txHash)} target="_blank" rel="noreferrer"
               className="btn-secondary"
               style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', fontSize: 13 }}>
              View on Explorer ↗
            </a>
            {onReset && (
              <button className="btn-ghost" onClick={onReset} style={{ fontSize: 13 }}>Close</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
