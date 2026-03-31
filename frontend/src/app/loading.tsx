// src/app/loading.tsx
// Shown instantly by Next.js when navigating between pages.

export default function Loading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '20px',
      maxWidth: 'var(--max-wide)', margin: '0 auto',
      padding: '32px 24px',
    }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton" style={{ height: '180px', borderRadius: 'var(--r-lg)' }} />
      ))}
    </div>
  );
}
