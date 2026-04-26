'use client';
/**
 * utils/toast.ts + ToastProvider
 * Provides a global toast notification system.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { explorerTxUrl } from './format';

type ToastType = 'success' | 'error' | 'pending' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  txHash?: string;
  duration?: number;  // 0 = persistent
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(ts => ts.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<Toast, 'id'>): string => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts(ts => [...ts, { ...opts, id }]);
    if (opts.duration !== 0) {
      setTimeout(() => dismiss(id), opts.duration ?? 5000);
    }
    return id;
  }, [dismiss]);

  const ICONS: Record<ToastType, string> = { success: '✅', error: '❌', pending: '⏳', info: 'ℹ️' };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Toast container */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type} anim-fade-fast`}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{ICONS[t.type]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--on-surface)' }}>{t.title}</p>
              {t.message && <p style={{ fontSize: 12, color: 'var(--on-variant)', marginTop: 3, wordBreak: 'break-word' }}>{t.message}</p>}
              {t.txHash && (
                <a href={explorerTxUrl(t.txHash)} target="_blank" rel="noreferrer"
                   style={{ fontSize: 11, color: 'var(--secondary)', textDecoration: 'none', marginTop: 4, display: 'block' }}>
                  View tx ↗
                </a>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              style={{ background: 'transparent', border: 'none', color: 'var(--on-variant)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', alignSelf: 'flex-start', flexShrink: 0 }}
            >×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback when used outside provider (e.g. SSR)
    return {
      toast: () => '',
      dismiss: () => {},
    };
  }
  return ctx;
}
