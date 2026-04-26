'use client';
import { useState } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { useCkbfs } from '@/hooks/useCkbfs';
import WalletConnect from '@/components/WalletConnect';
import WalletModal from '@/components/WalletModal';
import FileUpload from '@/components/FileUpload';
import FileUpdate from '@/components/FileUpdate';
import FileDelete from '@/components/FileDelete';
import FileViewer from '@/components/FileViewer';
import Dashboard from '@/components/Dashboard';

type Tab = 'dashboard' | 'upload' | 'update' | 'delete' | 'view';

const NAV: { id: Tab; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '🗂', label: 'My Files'  },
  { id: 'upload',    icon: '⬆️', label: 'Upload'    },
  { id: 'update',    icon: '✏️', label: 'Update'    },
  { id: 'delete',    icon: '🗑', label: 'Consume'   },
  { id: 'view',      icon: '👁', label: 'View File' },
];

export default function Home() {
  const { address, connecting, error: walletErr } = useWalletContext();
  const ckbfs = useCkbfs(address ?? undefined);
  const [tab, setTab]           = useState<Tab>('dashboard');
  const [prefillId, setPrefill] = useState('');
  const [showModal, setShowModal] = useState(false);

  /** Called from Dashboard card → navigates to Update pre-filled */
  const handleUpdate = (fileId: string) => { setPrefill(fileId); setTab('update'); };
  /** Called from Dashboard card → navigates to View pre-filled */
  const handleView   = (fileId: string) => { setPrefill(fileId); setTab('view'); };

  return (
    <>
      {/* ── Ambient blobs ─── */}
      <div className="ambient-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 100,
          padding: '0 28px', height: 62,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(8,12,20,0.8)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: 'linear-gradient(135deg,#9333ea,#0891b2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 13, color: 'white', letterSpacing: -1,
              boxShadow: '0 4px 16px rgba(147,51,234,0.4)',
            }}>FS</div>
            <span className="gradient-text" style={{ fontSize: 20, fontWeight: 900, letterSpacing: -1 }}>CKBFS</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', padding: '3px 10px', borderRadius: 20 }}>
              Aggron4
            </span>
          </div>
          <WalletConnect />
        </header>

        {/* ── HERO (no wallet) ─────────────────────────────────────────────── */}
        {!address && (
          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>
            <div className="anim-fade-in" style={{ textAlign: 'center', maxWidth: 720 }}>
              {/* Icon */}
              <div style={{ fontSize: 72, marginBottom: 28, filter: 'drop-shadow(0 0 40px rgba(147,51,234,0.5))' }}>⛓️</div>

              {/* Headline */}
              <h1 className="gradient-text" style={{ fontSize: 58, fontWeight: 900, letterSpacing: -2.5, lineHeight: 1.05, marginBottom: 20 }}>
                On-chain File Storage
              </h1>
              <p style={{ color: 'var(--on-variant)', fontSize: 18, lineHeight: 1.7, maxWidth: 520, margin: '0 auto 48px' }}>
                CKBFS stores your files permanently on the CKB blockchain as typed cells —
                censorship-resistant, decentralised, and truly permanent.
              </p>

              {/* CTA */}
              <button className="btn-primary anim-pulse-glow" onClick={() => setShowModal(true)} disabled={connecting}
                style={{ fontSize: 17, padding: '16px 44px', borderRadius: 16 }}>
                {connecting
                  ? <><span className="spinner" style={{ width: 18, height: 18 }} />Connecting…</>
                  : '🔐 Connect Wallet to Start'}
              </button>
              {walletErr && <p style={{ color: '#f87171', fontSize: 13, marginTop: 14 }}>{walletErr}</p>}

              {/* Feature cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 72 }}>
                {[
                  { icon: '⬆️', t: 'Upload',  d: 'Store any file as CKBFS cells'   },
                  { icon: '✏️', t: 'Update',  d: 'Modify content, keep File ID'    },
                  { icon: '🗑', t: 'Consume', d: 'Delete and recover locked CKB'   },
                  { icon: '👁', t: 'View',    d: 'Read & reconstruct from chain'   },
                ].map((f, i) => (
                  <div key={f.t} className={`stat-card anim-slide-up delay-${i+1}`} style={{ textAlign: 'center', padding: '24px 16px', cursor: 'default' }}>
                    <div style={{ fontSize: 30, marginBottom: 12 }}>{f.icon}</div>
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{f.t}</p>
                    <p style={{ color: 'var(--on-variant)', fontSize: 12, lineHeight: 1.5 }}>{f.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </main>
        )}

        {/* ── APP (wallet connected) ───────────────────────────────────────── */}
        {address && (
          <div style={{ display: 'flex', flex: 1 }}>

            {/* Sidebar */}
            <aside style={{
              width: 220, flexShrink: 0,
              background: 'rgba(8,12,20,0.7)',
              backdropFilter: 'blur(16px)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              padding: '24px 12px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {/* Address badge */}
              <div style={{ padding: '10px 14px', marginBottom: 18, background: 'rgba(147,51,234,0.08)', border: '1px solid rgba(147,51,234,0.15)', borderRadius: 12 }}>
                <p className="label-upper" style={{ marginBottom: 4 }}>Connected</p>
                <p className="mono-text" style={{ fontSize: 11, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {address.slice(0,16)}…{address.slice(-8)}
                </p>
              </div>

              {/* Nav items */}
              {NAV.map(n => (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px', borderRadius: 12,
                    border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                    fontSize: 14, fontWeight: tab === n.id ? 700 : 400,
                    transition: 'all 180ms',
                    background: tab === n.id
                      ? 'linear-gradient(135deg, rgba(147,51,234,0.22), rgba(8,145,178,0.15))'
                      : 'transparent',
                    color: tab === n.id ? '#ddb8ff' : 'var(--on-variant)',
                    borderLeft: tab === n.id ? '3px solid var(--primary)' : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
                  {n.label}
                  {tab === n.id && (
                    <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)' }} />
                  )}
                </button>
              ))}

              {/* Bottom */}
              <div style={{ marginTop: 'auto', padding: '14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 11, color: 'var(--on-muted)', lineHeight: 1.5 }}>
                  CKBFS Type Script<br />
                  <span style={{ color: 'rgba(74,222,128,0.6)' }}>● Aggron4 Testnet</span>
                </p>
              </div>
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, padding: '36px 40px', overflowY: 'auto' }}>
              {tab === 'dashboard' && (
                <Dashboard ckbfs={ckbfs} address={address} onUpdate={handleUpdate} onView={handleView} />
              )}
              {tab === 'upload' && <FileUpload ckbfs={ckbfs} />}
              {tab === 'update' && <FileUpdate ckbfs={ckbfs} prefillFileId={prefillId} />}
              {tab === 'delete' && <FileDelete ckbfs={ckbfs} prefillFileId={prefillId} />}
              {tab === 'view'   && <FileViewer address={address} />}
            </main>
          </div>
        )}

        {/* Footer */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>CKBFS · Aggron4 Testnet · Built with ❤️ on Nervos</span>
          <a href="https://github.com/nervosnetwork" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--on-variant)', textDecoration: 'none' }}>Nervos Network ↗</a>
        </footer>
      </div>

      {showModal && <WalletModal onClose={() => setShowModal(false)} />}
    </>
  );
}
