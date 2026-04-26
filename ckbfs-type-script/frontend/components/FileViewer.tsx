'use client';
import { useState } from 'react';
import { formatBytes, mimeToEmoji } from '@/utils/format';

interface Props { address: string; }
interface FileResult { content: Uint8Array; size: number; chunks: number; mimeType: string; isText: boolean; text?: string; objectUrl?: string; }

export default function FileViewer({ address }: Props) {
  const [fileId, setFileId]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState<FileResult | null>(null);

  const fetchFile = async () => {
    if (!fileId.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res  = await fetch(`/api/file/${fileId.trim()}?address=${encodeURIComponent(address)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Fetch failed');

      const binary = atob(json.contentBase64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const isText  = sniffText(bytes);
      const mimeType = isText ? 'text/plain' : sniffMime(bytes);
      const blob    = new Blob([bytes], { type: mimeType });

      setResult({ content: bytes, size: json.size, chunks: json.chunks, mimeType, isText,
        text: isText ? new TextDecoder().decode(bytes) : undefined,
        objectUrl: URL.createObjectURL(blob) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 className="section-title" style={{ marginBottom: 4 }}>File Viewer</h2>
      <p className="section-sub" style={{ marginBottom: 24 }}>Reconstruct any CKBFS file from the chain</p>

      <div className="glass-card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input className="input-field mono" style={{ flex: 1 }} placeholder="Enter File ID (0x…)" value={fileId}
            onChange={e => { setFileId(e.target.value); setResult(null); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && fetchFile()} />
          <button className="btn-primary" onClick={fetchFile} disabled={!fileId.trim() || loading} style={{ fontSize: 13, padding: '10px 18px' }}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> : '👁 Fetch'}
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--on-variant)', fontSize: 14 }}>Fetching from chain…</p>
          </div>
        )}

        {error && <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 10, padding: '12px 16px' }}><p style={{ color: '#ff7070', fontSize: 14 }}>⚠ {error}</p></div>}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.3s ease' }}>
            {/* Meta row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[['Size', formatBytes(result.size)], ['Chunks', String(result.chunks)], ['Type', result.mimeType.split('/')[1] ?? result.mimeType]].map(([k,v]) => (
                <div key={k} className="glass" style={{ borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                  <p className="label-upper" style={{ marginBottom: 4 }}>{k}</p>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{v}</p>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="glass" style={{ borderRadius: 12, padding: 16, minHeight: 80 }}>
              <p className="label-upper" style={{ marginBottom: 10 }}>{mimeToEmoji(result.mimeType)} Preview</p>
              {result.isText && result.text ? (
                <pre style={{ fontSize: 12, color: 'var(--on-variant)', overflowY: 'auto', maxHeight: 280, whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>
                  {result.text.slice(0, 5000)}{result.text.length > 5000 ? '\n…' : ''}
                </pre>
              ) : result.mimeType.startsWith('image/') && result.objectUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.objectUrl} alt="Preview" style={{ maxHeight: 280, borderRadius: 8, maxWidth: '100%' }} />
              ) : (
                <p style={{ color: 'var(--on-variant)', fontSize: 14, fontStyle: 'italic' }}>Binary file — download to view</p>
              )}
            </div>

            {result.objectUrl && (
              <a href={result.objectUrl} download={`ckbfs-${fileId.slice(2,10)}`} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', fontSize: 14 }}>
                ⬇ Download File
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function sniffText(b: Uint8Array): boolean {
  const s = b.slice(0, 512);
  for (const x of s) { if (x < 9 || (x > 13 && x < 32 && x !== 27)) return false; }
  return true;
}
function sniffMime(b: Uint8Array): string {
  if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0x25 && b[1] === 0x50) return 'application/pdf';
  return 'application/octet-stream';
}
