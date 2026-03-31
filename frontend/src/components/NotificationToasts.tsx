'use client';

import { useStore } from '@/lib/store';

export default function NotificationToasts() {
  const { notifications, dismissNotification } = useStore();

  if (notifications.length === 0) return null;

  const icons: Record<string, string> = {
    success: '✅',
    error: '❌',
    loading: '⏳',
    info: 'ℹ️',
  };

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {notifications.map(n => (
        <div key={n.id} className={`toast toast-${n.type}`} role="alert">
          <span className="toast-icon">{icons[n.type]}</span>
          <div className="toast-body">
            <div className="toast-message">{n.message}</div>
            {n.txHash && (
              <div className="toast-tx">
                TX: {n.txHash.slice(0, 24)}...
              </div>
            )}
          </div>
          {n.type !== 'loading' && (
            <button
              className="toast-close"
              onClick={() => dismissNotification(n.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
          {n.type === 'loading' && <div className="spinner" />}
        </div>
      ))}
    </div>
  );
}
