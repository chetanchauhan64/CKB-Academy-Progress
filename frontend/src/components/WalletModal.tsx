'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

interface WalletModalProps {
  onClose: () => void;
  /** Called when a CKB (JoyID) wallet connection is requested via the CCC connector */
  onConnectCKB: () => void;
}

// Detect wallet extensions
function hasMetaMask(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as Window & { ethereum?: unknown }).ethereum !== 'undefined';
}

function hasOKX(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as Window & { okxwallet?: unknown }).okxwallet !== 'undefined';
}

const WALLET_OPTIONS = [
  {
    id: 'joyid',
    icon: '🔑',
    name: 'JoyID (CKB)',
    description: 'Connect with JoyID passkey. Required for on-chain publishing.',
    badge: null,
    badgeColor: '',
    type: 'CKB' as const,
    primary: true,
  },
  {
    id: 'metamask',
    icon: '🦊',
    name: 'MetaMask',
    description: 'Connect Ethereum wallet. Read-only — cannot publish to CKBFS.',
    badge: 'EVM',
    badgeColor: 'rgba(245,158,11,0.15)',
    type: 'METAMASK' as const,
    primary: false,
  },
  {
    id: 'okx',
    icon: '⭕',
    name: 'OKX Wallet',
    description: 'Connect OKX. Read-only — cannot publish to CKBFS.',
    badge: 'EVM',
    badgeColor: 'rgba(124,111,255,0.15)',
    type: 'OKX' as const,
    primary: false,
  },
];

export default function WalletModal({ onClose, onConnectCKB }: WalletModalProps) {
  const { connectMetaMask, connectOKX, connectWallet } = useStore();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [customAddress, setCustomAddress] = useState('');

  async function handleSelect(type: 'CKB' | 'METAMASK' | 'OKX') {
    setConnecting(type);
    try {
      if (type === 'CKB') {
        onConnectCKB();
        onClose();
        return;
      }
      if (type === 'METAMASK') {
        await connectMetaMask();
      } else if (type === 'OKX') {
        await connectOKX();
      }
      onClose();
    } finally {
      setConnecting(null);
    }
  }

  async function handleDemoWallet() {
    setConnecting('DEMO');
    await connectWallet();
    onClose();
    setConnecting(null);
  }

  async function handleCustomAddress() {
    if (!customAddress.trim()) return;
    setConnecting('CUSTOM');
    await connectWallet(customAddress.trim());
    onClose();
    setConnecting(null);
  }

  const metaMaskDetected = hasMetaMask();
  const okxDetected = hasOKX();

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card anim-fade-up" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <h2 className="heading-md" style={{ marginBottom: '4px' }}>Connect Wallet</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Choose how you want to sign in to ChainPress
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} id="wallet-modal-close">✕</button>
        </div>

        {/* CKB notice */}
        <div style={{
          padding: '10px 14px',
          background: 'rgba(0,212,170,0.06)',
          border: '1px solid rgba(0,212,170,0.15)',
          borderRadius: 'var(--r-md)',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0 }}>⛓</span>
          <span>
            <strong style={{ color: 'var(--primary)' }}>JoyID (CKB)</strong> is required to publish, append, fork, or transfer posts on CKBFS.
            EVM wallets (MetaMask, OKX) are for read-only identity only.
          </span>
        </div>

        {/* Wallet options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {WALLET_OPTIONS.map(w => {
            const isConnecting = connecting === w.type;
            const detected = w.type === 'METAMASK' ? metaMaskDetected : w.type === 'OKX' ? okxDetected : true;

            return (
              <button
                key={w.id}
                id={`wallet-option-${w.id}`}
                onClick={() => handleSelect(w.type)}
                disabled={!!connecting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  background: w.primary ? 'rgba(0,212,170,0.06)' : 'var(--bg-elevated)',
                  border: `1px solid ${w.primary ? 'rgba(0,212,170,0.25)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)',
                  cursor: connecting ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all var(--t-base)',
                  opacity: connecting && !isConnecting ? 0.5 : 1,
                }}
                className="wallet-option-btn"
              >
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{w.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: w.primary ? 'var(--primary)' : 'var(--text-primary)' }}>
                      {w.name}
                    </span>
                    {w.badge && (
                      <span style={{
                        padding: '1px 7px',
                        borderRadius: 'var(--r-full)',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: w.badgeColor,
                        color: 'var(--warning)',
                        border: '1px solid rgba(245,158,11,0.2)',
                      }}>
                        {w.badge}
                      </span>
                    )}
                    {w.primary && (
                      <span className="badge badge-publish" style={{ fontSize: '0.65rem', padding: '1px 7px' }}>
                        Recommended
                      </span>
                    )}
                    {!detected && w.type !== 'CKB' && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Not installed</span>
                    )}
                    {detected && w.type !== 'CKB' && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>● Detected</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {w.description}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {isConnecting ? (
                    <div className="spinner" style={{ width: '18px', height: '18px' }} />
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>→</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            or demo mode
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Demo wallet */}
        <button
          className="btn btn-secondary"
          id="demo-wallet-btn"
          style={{ width: '100%', marginBottom: '10px', justifyContent: 'center' }}
          onClick={handleDemoWallet}
          disabled={!!connecting}
        >
          {connecting === 'DEMO' ? (
            <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Connecting...</>
          ) : '🎭 Use Demo Wallet (Simulation)'}
        </button>

        {/* Custom address */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-input"
            id="custom-address-input"
            placeholder="ckb1qz... (paste CKB address)"
            value={customAddress}
            onChange={e => setCustomAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomAddress()}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-secondary btn-sm"
            id="custom-wallet-btn"
            disabled={!customAddress.trim() || !!connecting}
            onClick={handleCustomAddress}
          >
            {connecting === 'CUSTOM' ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : '→'}
          </button>
        </div>

        <div className="protocol-bar" style={{ marginTop: '16px' }}>
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--primary)' }} />
            <span>JoyID via CCC connector · Nervos CKB Testnet</span>
          </div>
        </div>
      </div>
    </div>
  );
}
