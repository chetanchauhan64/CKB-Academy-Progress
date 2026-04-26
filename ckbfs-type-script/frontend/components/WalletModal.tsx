'use client';
/**
 * components/WalletModal.tsx
 *
 * RULES:
 * • Always renders EXACTLY 3 wallet options (no conditional rendering)
 * • Shows per-option spinner while connecting
 * • Shows per-option inline error on failure — NEVER closes on failure
 * • Closes only on successful connect
 * • No silent failures — every error is visible to the user
 */

import { useState } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import type { WalletType } from '@/wallets/WalletAdapter';

interface Props { onClose: () => void; }

/* ── ALWAYS 3 options — never change this list conditionally ─────────────── */
const OPTIONS = [
  {
    type:       'joyid'      as WalletType,
    emoji:      '🔐',
    name:       'JoyID',
    tag:        'Recommended',
    tagColor:   '#4ade80',
    desc:       'Biometric wallet — no seed phrase, no extension.',
  },
  {
    type:       'unipass'    as WalletType,
    emoji:      '✉️',
    name:       'UniPass',
    tag:        'Email',
    tagColor:   '#22d3ee',
    desc:       'Enter your ckt1… testnet address (demo mode).',
  },
  {
    type:       'privatekey' as WalletType,
    emoji:      '🔑',
    name:       'Private Key',
    tag:        'Dev Only',
    tagColor:   '#fbbf24',
    desc:       'Server-side signing via PRIVATE_KEY in .env.local.',
  },
] as const;

export default function WalletModal({ onClose }: Props) {
  const { connect } = useWalletContext();

  // Per-option state (not global) so one wallet's state doesn't affect others
  const [loading, setLoading] = useState<WalletType | null>(null);
  const [errors,  setErrors]  = useState<Partial<Record<WalletType, string>>>({});

  const handleConnect = async (type: WalletType) => {
    if (loading) return;  // already connecting — ignore

    console.log('[WalletModal] User selected wallet:', type);

    setLoading(type);
    setErrors(prev => ({ ...prev, [type]: undefined }));

    try {
      await connect(type);
      console.log('[WalletModal] Connect success:', type);
      onClose();  // ← only close on success
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      console.error('[WalletModal] Connect failed:', type, raw);

      // Friendly messages per wallet type
      let msg = raw;
      if (type === 'joyid') {
        if (raw.includes('cancel') || raw.includes('reject') || raw.includes('dismiss')) {
          msg = 'JoyID popup was cancelled. Click the button again to retry.';
        } else {
          msg = `JoyID error: ${raw}`;
        }
      } else if (type === 'unipass') {
        if (raw.includes('ckt1')) {
          msg = raw; // already friendly from adapter
        } else if (raw.includes('cancel')) {
          msg = 'UniPass: cancelled. Try again.';
        } else {
          msg = `UniPass: ${raw}`;
        }
      } else if (type === 'privatekey') {
        if (raw.includes('PRIVATE_KEY')) {
          msg = 'Add PRIVATE_KEY=0x… to frontend/.env.local and restart the dev server.';
        } else {
          msg = `Private Key error: ${raw}`;
        }
      }

      setErrors(prev => ({ ...prev, [type]: msg }));
    } finally {
      setLoading(null);
    }
  };

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect Wallet"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(4,8,16,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Panel — stop click propagation so clicking inside doesn't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #0f1829 0%, #131c30 100%)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 24,
          padding: '28px 24px 24px',
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 48px 96px rgba(0,0,0,0.8), 0 0 0 1px rgba(168,85,247,0.06) inset',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#e2e8f0', letterSpacing: -0.4, margin: 0 }}>
              Connect Wallet
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 5, margin: '5px 0 0' }}>
              3 options available · Nervos CKB Aggron4 Testnet
            </p>
          </div>
          <button
            id="wallet-modal-close"
            onClick={onClose}
            aria-label="Close wallet modal"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 9,
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '5px 9px',
              transition: 'all 150ms',
            }}
          >×</button>
        </div>

        {/* Wallet options — EXACTLY 3, always rendered */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPTIONS.map(opt => {
            const isLoading = loading === opt.type;
            const errMsg    = errors[opt.type];
            const disabled  = !!loading;

            return (
              <div key={opt.type}>
                {/* Option button */}
                <button
                  id={`wallet-option-${opt.type}`}
                  onClick={() => handleConnect(opt.type)}
                  disabled={disabled}
                  aria-label={`Connect with ${opt.name}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 15,
                    padding: '14px 18px',
                    borderRadius: 14,
                    width: '100%',
                    background: errMsg
                      ? 'rgba(248,113,113,0.05)'
                      : isLoading
                      ? `${opt.tagColor}0D`
                      : 'rgba(255,255,255,0.03)',
                    border: errMsg
                      ? '1px solid rgba(248,113,113,0.28)'
                      : isLoading
                      ? `1px solid ${opt.tagColor}35`
                      : '1px solid rgba(255,255,255,0.07)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'background 150ms, border-color 150ms, transform 150ms',
                    opacity: disabled && !isLoading ? 0.5 : 1,
                    transform: 'translateY(0)',
                  }}
                  onMouseEnter={e => {
                    if (disabled) return;
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = `${opt.tagColor}12`;
                    el.style.borderColor = `${opt.tagColor}40`;
                    el.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = errMsg ? 'rgba(248,113,113,0.05)' : isLoading ? `${opt.tagColor}0D` : 'rgba(255,255,255,0.03)';
                    el.style.borderColor = errMsg ? 'rgba(248,113,113,0.28)' : isLoading ? `${opt.tagColor}35` : 'rgba(255,255,255,0.07)';
                    el.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Icon */}
                  <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{opt.emoji}</span>

                  {/* Label + desc */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{opt.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.06,
                        textTransform: 'uppercase',
                        color: opt.tagColor,
                        background: `${opt.tagColor}18`,
                        border: `1px solid ${opt.tagColor}30`,
                        borderRadius: 99, padding: '2px 8px',
                      }}>{opt.tag}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4, margin: 0 }}>
                      {opt.desc}
                    </p>
                  </div>

                  {/* Right — spinner or chevron */}
                  <span style={{ flexShrink: 0, color: '#475569', fontSize: 16, display: 'flex', alignItems: 'center' }}>
                    {isLoading
                      ? <span className="spinner" style={{ width: 17, height: 17 }} />
                      : '›'}
                  </span>
                </button>

                {/* Per-option inline error — only shown when this option errored */}
                {errMsg && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 6,
                      padding: '10px 14px',
                      background: 'rgba(248,113,113,0.07)',
                      border: '1px solid rgba(248,113,113,0.2)',
                      borderRadius: 10,
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, color: '#f87171', lineHeight: 1.55, margin: 0, wordBreak: 'break-word' }}>
                        {errMsg}
                      </p>
                      <button
                        onClick={() => setErrors(prev => ({ ...prev, [opt.type]: undefined }))}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, padding: '4px 0 0', display: 'block' }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p style={{ marginTop: 20, fontSize: 11, color: '#334155', textAlign: 'center', margin: '20px 0 0' }}>
          By connecting you agree to interact with the CKB Aggron4 testnet
        </p>
      </div>
    </div>
  );
}
