'use client';
import { useState } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import WalletModal from './WalletModal';
import { shortenHash, explorerAddrUrl } from '@/utils/format';

const ICONS: Record<string, string> = { joyid: '🔐', privatekey: '🔑', unipass: '✉️' };
const NAMES: Record<string, string> = { joyid: 'JoyID',  privatekey: 'Dev Key', unipass: 'UniPass' };
const COLORS: Record<string, string> = { joyid: '#4ade80', privatekey: '#fbbf24', unipass: '#22d3ee' };

export default function WalletConnect() {
  const { address, walletType, connecting, error, disconnect } = useWalletContext();
  const [showModal, setModal] = useState(false);
  const [copied,    setCopied] = useState(false);

  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  /* ── Not connected ────────────────────────────────────────────────────────── */
  if (!address) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Show last connection error in header (brief) */}
          {error && (
            <span style={{
              fontSize: 11, color: '#f87171', maxWidth: 200,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={error}>
              ⚠ {error}
            </span>
          )}
          <button
            id="wallet-connect-btn"
            className="btn-primary"
            onClick={() => setModal(true)}
            disabled={connecting}
            style={{ fontSize: 13, padding: '9px 18px' }}
          >
            {connecting
              ? <><span className="spinner" style={{ width: 13, height: 13 }} />Connecting…</>
              : '🔐 Connect Wallet'}
          </button>
        </div>
        {showModal && <WalletModal onClose={() => setModal(false)} />}
      </>
    );
  }

  /* ── Connected ────────────────────────────────────────────────────────────── */
  const wColor = COLORS[walletType ?? ''] ?? '#a855f7';
  const wName  = NAMES[walletType ?? ''] ?? 'Wallet';
  const wIcon  = ICONS[walletType ?? ''] ?? '💎';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Wallet type badge */}
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.04,
        color: wColor,
        background: `${wColor}15`,
        border: `1px solid ${wColor}30`,
        padding: '4px 12px',
        borderRadius: 99,
      }}>
        {wIcon} {wName}
      </span>

      {/* Address chip */}
      <div
        className="glass"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10 }}
      >
        {/* Live dot */}
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#4ade80', flexShrink: 0,
          boxShadow: '0 0 6px #4ade80',
          animation: 'pulseGlow 2s ease infinite',
        }} />

        <span className="mono-text" style={{ fontSize: 12, color: '#dde2f3' }}>
          {shortenHash(address, 6)}
        </span>

        {/* Copy button */}
        <button
          id="wallet-copy-btn"
          className="btn-icon"
          onClick={copy}
          title="Copy address"
          style={{ fontSize: 13 }}
        >
          {copied ? '✓' : '⧉'}
        </button>

        {/* Explorer link */}
        <a
          href={explorerAddrUrl(address)}
          target="_blank"
          rel="noreferrer"
          className="btn-icon"
          style={{ fontSize: 12, textDecoration: 'none' }}
          title="View on CKB Explorer"
        >↗</a>
      </div>

      {/* Disconnect */}
      <button
        id="wallet-disconnect-btn"
        className="btn-secondary"
        onClick={disconnect}
        style={{ fontSize: 12, padding: '7px 12px' }}
      >
        Disconnect
      </button>
    </div>
  );
}
