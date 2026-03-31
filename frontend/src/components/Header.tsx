'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useStore, WalletType } from '@/lib/store';
import WalletModal from '@/components/WalletModal';
import { useCcc } from '@ckb-ccc/connector-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  return addr.length > 20 ? `${addr.slice(0, 10)}...${addr.slice(-6)}` : addr;
}

function walletLabel(type: WalletType): string {
  if (type === 'CKB') return '⛓ JoyID (CKB)';
  if (type === 'METAMASK') return '🦊 MetaMask';
  if (type === 'OKX') return '⭕ OKX';
  return '🔐 Wallet';
}

function walletColor(type: WalletType): string {
  if (type === 'CKB') return 'var(--primary)';
  if (type === 'METAMASK') return 'var(--warning)';
  if (type === 'OKX') return 'var(--accent)';
  return 'var(--text-muted)';
}

// ── Header ─────────────────────────────────────────────────────────────────────

export default function Header() {
  const pathname = usePathname();
  const { walletConnected, walletAddress, walletType, evmChainId, disconnectWallet, pushNotification } = useStore();
  const { open: openCKBModal } = useCcc();

  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowWalletMenu(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const navLinks = [
    { href: '/', label: 'Feed' },
    { href: '/write', label: 'Write' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/forks', label: 'Forks' },
    { href: '/profile', label: 'Profile' },
  ];

  function handleCopyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      pushNotification({ type: 'success', message: 'Address copied!', duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDisconnect() {
    disconnectWallet();
    setShowWalletMenu(false);
    pushNotification({ type: 'info', message: 'Wallet disconnected', duration: 3000 });
  }

  // Show wrong-network badge for EVM wallets not on mainnet
  const wrongNetwork = (walletType === 'METAMASK' || walletType === 'OKX') && evmChainId !== null && evmChainId !== 1;

  return (
    <>
      <header className="header">
        <Link href="/" className="header-logo">
          <div className="logo-icon">⛓</div>
          <div>
            <span className="logo-text">ChainPress</span>
            <span className="logo-sub">on CKBFS</span>
          </div>
        </Link>

        <nav className="header-nav" aria-label="Main navigation">
          {navLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link ${pathname === l.href ? 'active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          {walletConnected ? (
            <div style={{ position: 'relative' }} ref={menuRef}>
              {/* Wrong-network warning pill */}
              {wrongNetwork && (
                <span style={{
                  position: 'absolute', top: '-26px', right: 0,
                  fontSize: '0.68rem', fontWeight: 600,
                  color: 'var(--error)',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 'var(--r-full)',
                  padding: '2px 8px',
                  whiteSpace: 'nowrap',
                }}>
                  ⚠️ Wrong network
                </span>
              )}

              <button
                className="wallet-pill"
                id="wallet-pill-btn"
                onClick={() => setShowWalletMenu(v => !v)}
                title={walletAddress ?? ''}
                style={{ borderColor: walletColor(walletType) + '44' }}
              >
                <span
                  className="wallet-dot"
                  style={{ background: walletColor(walletType), boxShadow: `0 0 6px ${walletColor(walletType)}66` }}
                />
                {shortAddr(walletAddress ?? '')}
                <span style={{ fontSize: '0.65rem', color: walletColor(walletType), fontWeight: 600 }}>
                  {walletType === 'CKB' ? 'CKB' : walletType === 'METAMASK' ? 'ETH' : walletType === 'OKX' ? 'OKX' : ''}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▾</span>
              </button>

              {showWalletMenu && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: '8px',
                  minWidth: '240px',
                  boxShadow: 'var(--shadow-popup)',
                  zIndex: 200,
                }}>
                  {/* Wallet info block */}
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: walletColor(walletType) }}>
                        {walletLabel(walletType)}
                      </span>
                      {walletType !== 'CKB' && (
                        <span style={{
                          fontSize: '0.62rem', padding: '1px 6px', borderRadius: 'var(--r-full)',
                          background: 'rgba(245,158,11,0.1)', color: 'var(--warning)',
                          border: '1px solid rgba(245,158,11,0.2)', fontWeight: 600,
                        }}>
                          READ-ONLY
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                      color: 'var(--text-secondary)', wordBreak: 'break-all', marginBottom: '8px',
                    }}>
                      {walletAddress}
                    </div>
                    <button
                      className={`copy-btn ${copied ? 'copied' : ''}`}
                      onClick={handleCopyAddress}
                      style={{ fontSize: '0.72rem' }}
                      id="header-copy-addr"
                    >
                      {copied ? '✓ Copied!' : '⎘ Copy Address'}
                    </button>
                  </div>

                  {/* Wrong network warning in dropdown */}
                  {wrongNetwork && (
                    <div style={{
                      padding: '8px 12px', marginBottom: '6px',
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                      borderRadius: 'var(--r-sm)', fontSize: '0.75rem', color: 'var(--error)',
                    }}>
                      ⚠️ Wrong network — switch to Ethereum Mainnet (chainId: 1)
                    </div>
                  )}

                  {/* CKB-only notice */}
                  {walletType !== 'CKB' && (
                    <div style={{
                      padding: '8px 12px', marginBottom: '6px',
                      background: 'rgba(0,212,170,0.04)', border: '1px solid rgba(0,212,170,0.12)',
                      borderRadius: 'var(--r-sm)', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5,
                    }}>
                      Switch to <strong style={{ color: 'var(--primary)' }}>JoyID (CKB)</strong> to publish, append, fork or transfer posts on CKBFS.
                    </div>
                  )}

                  {/* Actions */}
                  <Link
                    href="/profile"
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => setShowWalletMenu(false)}
                  >
                    👤 My Profile
                  </Link>
                  <Link
                    href="/dashboard"
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => setShowWalletMenu(false)}
                  >
                    📊 Dashboard
                  </Link>

                  {/* Switch wallet */}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--accent)' }}
                    onClick={() => { setShowWalletMenu(false); setShowWalletModal(true); }}
                    id="switch-wallet-btn"
                  >
                    🔄 Switch Wallet
                  </button>

                  <button
                    className="btn btn-ghost btn-sm btn-danger"
                    style={{ width: '100%', justifyContent: 'flex-start', marginTop: '2px' }}
                    onClick={handleDisconnect}
                    id="disconnect-wallet-btn"
                  >
                    🔌 Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              id="connect-wallet-btn"
              onClick={() => setShowWalletModal(true)}
            >
              Connect Wallet
            </button>
          )}

          <Link href="/write" className="btn btn-secondary btn-sm" id="write-post-btn">
            ✍️ Write
          </Link>
        </div>
      </header>

      {/* Wallet Selector Modal */}
      {showWalletModal && (
        <WalletModal
          onClose={() => setShowWalletModal(false)}
          onConnectCKB={() => {
            openCKBModal();
            setShowWalletModal(false);
          }}
        />
      )}
    </>
  );
}
