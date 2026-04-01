'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { ValidatedBlogPost } from '@/lib/ckbfs/metadata';
import { computePublishChecksum, computeAppendChecksum } from '@/lib/ckbfs/checksum';
import { CKBFSResolvedData } from '@/lib/ckbfs/indexer';

// Use marked for live preview
import { marked } from 'marked';

const DEFAULT_BODY = `Write your post in **Markdown**...

## Section title

Your content here. Support for:
- \`code\`
- **bold**, *italic*
- > blockquotes
- And more!
`;



interface EditorProps {
  /** If provided, the editor is in Append mode against this txHash */
  appendTargetTxHash?: string;
  onSubmit: (params: {
    mode: 'publish' | 'append';
    post: ValidatedBlogPost;
    selectedPostTx: string;
  }) => Promise<void>;
  submitting: boolean;
}

export default function Editor({ appendTargetTxHash, onSubmit, submitting }: EditorProps) {
  const { walletConnected, walletAddress, connectWallet, posts, pushNotification } = useStore();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState(DEFAULT_BODY);
  const [tags, setTags] = useState('');
  const [summary, setSummary] = useState('');
  const [coverImageLocal, setCoverImageLocal] = useState<string | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);

  const [appendMode, setAppendMode] = useState(!!appendTargetTxHash);
  const [selectedPostTx, setSelectedPostTx] = useState(appendTargetTxHash ?? '');

  const [checksumPreview, setChecksumPreview] = useState<number | null>(null);
  const [witnessBytes, setWitnessBytes] = useState(0);
  const [isPaid, setIsPaid] = useState(false);
  const [unlockPrice, setUnlockPrice] = useState('10');

  const [showAI, setShowAI] = useState(false);
  const [aiAction, setAiAction] = useState<'improve' | 'title' | 'summary' | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMock, setAiMock] = useState(false);
  const [aiCopied, setAiCopied] = useState(false);
  const [publishStep, setPublishStep] = useState<number>(-1); // -1 = idle

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myPosts = (posts as CKBFSResolvedData[]).filter(p => p.metadata?.author === walletAddress);

  // Pre-fill if append target is provided
  useEffect(() => {
    if (appendTargetTxHash) {
      setAppendMode(true);
      setSelectedPostTx(appendTargetTxHash);
      const found = posts.find(p => p.txHash === appendTargetTxHash) as CKBFSResolvedData | undefined;
      if (found) {
        setTitle(found.metadata?.title ?? '');
        setBody(found.content ?? '');
        setTags(found.metadata?.tags?.join(', ') ?? '');
        setSummary(found.metadata?.description ?? '');
      }
    }
  }, [appendTargetTxHash, posts]);

  // Live Adler32 checksum preview
  useEffect(() => {
    if (!title.trim() && !body.trim()) { setChecksumPreview(null); setWitnessBytes(0); return; }

    // Canonical key order MUST match publish.ts exactly for an accurate preview
    const post = {
      title:        title || '(Untitled)',
      description:  summary || '',
      author:       walletAddress || 'ckb1demo',
      tags:         tags.split(',').map(t => t.trim()).filter(Boolean),
      created_at:   Date.now(),
      updated_at:   Date.now(),
      is_paid:      isPaid,
      unlock_price: isPaid ? (parseFloat(unlockPrice) || 10) : 0,
      content:      body,
    };
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(JSON.stringify(post));
    setWitnessBytes(6 + contentBytes.length);

    if (appendMode && selectedPostTx) {
      const existingPost = posts.find(p => p.txHash === selectedPostTx) as CKBFSResolvedData | undefined;
      if (existingPost) {
        const cs = computeAppendChecksum(existingPost.backlinks ?? [], contentBytes);
        setChecksumPreview(cs);
        return;
      }
    }
    const cs = computePublishChecksum(contentBytes);
    setChecksumPreview(cs);
  }, [title, body, tags, summary, isPaid, unlockPrice, appendMode, selectedPostTx, posts, walletAddress]);

  // ── Toolbar actions ──────────────────────────────────────────────────────────
  function insertMarkdown(before: string, after: string = '') {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    const newBody = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      ta.focus();
      const newPos = start + before.length + selected.length + after.length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  }

  const TOOLBAR: Array<{ label: string; title: string; action?: () => void; type?: string }> = [
    { label: 'B', title: 'Bold', action: () => insertMarkdown('**', '**') },
    { label: 'I', title: 'Italic', action: () => insertMarkdown('*', '*') },
    { label: '<>', title: 'Inline Code', action: () => insertMarkdown('`', '`') },
    { label: 'H2', title: 'Heading', action: () => insertMarkdown('\n## ', '') },
    { label: '"', title: 'Blockquote', action: () => insertMarkdown('\n> ', '') },
    { label: '—', title: 'Separator', type: 'sep' },
    { label: '🔗', title: 'Link', action: () => insertMarkdown('[', '](url)') },
    { label: '📋', title: 'Code Block', action: () => insertMarkdown('\n```\n', '\n```\n') },
    { label: '• List', title: 'Bullet List', action: () => insertMarkdown('\n- ', '') },
  ];

  // ── Cover image ───────────────────────────────────────────────────────────────
  function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImageFile(file);
    const url = URL.createObjectURL(file);
    setCoverImageLocal(url);
  }
  // Suppress unused var warning — file is stored for future CKBFS upload
  void coverImageFile;

  // ── AI Assist ─────────────────────────────────────────────────────────────────
  async function callAI(type: 'improve' | 'title' | 'summary') {
    if (!body.trim() && type !== 'title') {
      pushNotification({ type: 'error', message: 'Write some content first before using AI.', duration: 3000 });
      return;
    }
    if (type === 'title' && !body.trim() && !title.trim()) {
      pushNotification({ type: 'error', message: 'Add a title or content first.', duration: 3000 });
      return;
    }
    setAiAction(type);
    setAiResult(null);
    setAiLoading(true);
    setAiMock(false);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content: type === 'title' ? (title + '\n\n' + body) : body }),
      });
      const json = await res.json() as { success: boolean; data: string; mock?: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'AI request failed');
      setAiResult(json.data);
      setAiMock(!!json.mock);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI unavailable';
      pushNotification({ type: 'error', message: msg, duration: 4000 });
      setAiAction(null);
    } finally {
      setAiLoading(false);
    }
  }

  function applyAIResult() {
    if (!aiResult || !aiAction) return;
    if (aiAction === 'improve') {
      setBody(aiResult);
      pushNotification({ type: 'success', message: 'Content improved by AI ✨', duration: 3000 });
    } else if (aiAction === 'summary') {
      setSummary(aiResult.slice(0, 300));
      pushNotification({ type: 'success', message: 'Summary generated ✅', duration: 3000 });
    }
    setShowAI(false);
    setAiResult(null);
    setAiAction(null);
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!walletConnected) { connectWallet(); return; }

    // ── Content guard ────────────────────────────────────────────────────────
    if (!body || body.trim().length === 0) {
      throw new Error('Content is required before publishing.');
    }
    if (!title || title.trim().length === 0) {
      throw new Error('Title is required before publishing.');
    }

    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const now = Date.now();

    // ── Exact payload matching Zod schema in metadata.ts ────────────────────
    // IMPORTANT: schema expects `content` (not `body`), `description` (not `summary`),
    // and `updated_at`. These MUST be present or validateBlogPostContent() will throw.
    const post = {
      title:        title.trim(),
      description:  summary?.trim() || '',
      content:      body,
      tags:         tagList,
      author:       walletAddress!,
      created_at:   now,
      updated_at:   now,
      // Monetization fields — stored in on-chain metadata
      is_paid:      isPaid,
      unlock_price: isPaid ? (parseFloat(unlockPrice) || 10) : 0,
    };

    // Debug log — visible in browser console during development
    console.log('[ChainPress] POST PAYLOAD:', post);

    // ── Animate pipeline: Draft(0) → Encode(1) → Sign(2) → Broadcast(3) → Done(4)
    setPublishStep(0);
    await new Promise(r => setTimeout(r, 300));
    setPublishStep(1);
    await new Promise(r => setTimeout(r, 400));
    setPublishStep(2);

    try {
      await onSubmit({ mode: appendMode ? 'append' : 'publish', post, selectedPostTx });
      setPublishStep(3);
      await new Promise(r => setTimeout(r, 600));
      setPublishStep(4);
      await new Promise(r => setTimeout(r, 800));
    } finally {
      setPublishStep(-1);
    }
  }


  // ── Live preview HTML ─────────────────────────────────────────────────────────
  const previewHtml = marked.parse(body || '*Start typing to see preview...*') as string;

  return (
    <div className="page-content narrow">
      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 className="heading-lg anim-fade-up" style={{ marginBottom: '8px' }}>
          {appendMode ? '🔗 Append to Post' : '✍️ Write a Post'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }} className="anim-fade-up">
          {appendMode
            ? 'Append new content to an existing CKBFS cell. Backlinks are immutable — history is preserved forever.'
            : 'Your post will be stored in a CKBFS witness with Adler32 checksum verification.'}
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }} className="anim-fade-up">
        <button
          className={`btn btn-sm ${!appendMode ? 'btn-primary' : 'btn-secondary'}`}
          id="mode-publish-btn"
          onClick={() => setAppendMode(false)}
        >
          📝 Publish New
        </button>
        <button
          className={`btn btn-sm ${appendMode ? 'btn-primary' : 'btn-secondary'}`}
          id="mode-append-btn"
          onClick={() => setAppendMode(true)}
          disabled={myPosts.length === 0}
          title={myPosts.length === 0 ? 'No posts to append to yet' : undefined}
        >
          🔗 Append Version
        </button>
        <button
          className="btn btn-sm"
          id="ai-assist-btn"
          onClick={() => { setShowAI(true); setAiResult(null); setAiAction(null); }}
          style={{
            marginLeft: 'auto',
            background: 'linear-gradient(135deg, rgba(124,111,255,0.15), rgba(0,212,170,0.1))',
            border: '1px solid rgba(124,111,255,0.3)',
            color: 'var(--accent)',
          }}
        >
          ✨ AI Assist
        </button>
      </div>

      {/* Append — post selector */}
      {appendMode && (
        <div className="card anim-fade-up" style={{ marginBottom: '24px', padding: '20px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="append-post-select">
              Select post to append to
            </label>
            <select
              id="append-post-select"
              className="form-input"
              value={selectedPostTx}
              onChange={e => {
                setSelectedPostTx(e.target.value);
                const found = posts.find(p => p.txHash === e.target.value) as CKBFSResolvedData | undefined;
                if (found) {
                  setTitle(found.metadata?.title ?? '');
                  setBody(found.content ?? '');
                  setTags(found.metadata?.tags?.join(', ') ?? '');
                  setSummary(found.metadata?.description ?? '');
                }
              }}
            >
              <option value="">— choose a post —</option>
              {myPosts.map(p => (
                <option key={p.txHash} value={p.txHash}>
                  {p.metadata?.title} ({p.backlinks?.length ?? 0} versions)
                </option>
              ))}
            </select>
          </div>

          {selectedPostTx && (() => {
            const found = posts.find(p => p.txHash === selectedPostTx) as CKBFSResolvedData | undefined;
            return found ? (
              <div className="protocol-bar" style={{ marginTop: '12px', fontSize: '0.75rem' }}>
                <div className="pbar-item">
                  <div className="pbar-dot" />
                  <span>prev checksum: 0x{(found.checksum ?? 0).toString(16).padStart(8, '0')}</span>
                </div>
                <div className="pbar-item">
                  <div className="pbar-dot" style={{ background: 'var(--accent)' }} />
                  <span>backlinks: {found.backlinks?.length ?? 0}</span>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Form */}
      <div className="card anim-fade-up" style={{ animationDelay: '100ms' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Cover image upload */}
          <div className="form-group">
            <label className="form-label">Cover Image (optional)</label>
            <div className="cover-upload-zone" onClick={() => fileInputRef.current?.click()}>
              {coverImageLocal ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImageLocal} alt="Cover preview" className="cover-preview" />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {coverImageFile?.name} · Click to change
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🖼</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Drop cover image or click to upload
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Stored on-chain via CKBFS media protocol
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleCoverUpload}
                id="cover-image-input"
              />
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="post-title">Title *</label>
            <input
              type="text"
              id="post-title"
              className="form-input"
              placeholder="Your post title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ fontSize: '1.1rem', fontWeight: 600 }}
            />
          </div>

          {/* Summary */}
          <div className="form-group">
            <label className="form-label" htmlFor="post-summary">Summary (optional)</label>
            <input
              type="text"
              id="post-summary"
              className="form-input"
              placeholder="A one-line description shown on the feed..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="form-label" htmlFor="post-tags">Tags (comma-separated)</label>
            <input
              type="text"
              id="post-tags"
              className="form-input"
              placeholder="ckb, blockchain, web3"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </div>

          {/* Paid Post Toggle */}
          <div className="form-group">
            <label className="form-label">Monetization</label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              padding: '14px 18px',
              background: isPaid ? 'rgba(245,158,11,0.06)' : 'var(--bg-elevated)',
              border: `1px solid ${isPaid ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)', transition: 'all var(--t-base)',
            }}>
              <button
                type="button"
                id="paid-toggle-btn"
                onClick={() => setIsPaid(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isPaid ? 'var(--warning)' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: '0.88rem', padding: 0,
                }}
              >
                <span style={{
                  width: '36px', height: '20px', borderRadius: '10px',
                  background: isPaid ? 'var(--warning)' : 'var(--border)',
                  position: 'relative', flexShrink: 0, transition: 'background var(--t-base)',
                  display: 'inline-block',
                }}>
                  <span style={{
                    position: 'absolute', top: '3px',
                    left: isPaid ? '18px' : '3px',
                    width: '14px', height: '14px',
                    borderRadius: '50%', background: '#fff',
                    transition: 'left var(--t-base)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </span>
                {isPaid ? '🔒 Paid Post' : '🔓 Free Post'}
              </button>
              {isPaid && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Unlock price:</span>
                  <input
                    id="unlock-price-input"
                    type="number"
                    min="1"
                    step="1"
                    value={unlockPrice}
                    onChange={e => setUnlockPrice(e.target.value)}
                    style={{
                      width: '80px', padding: '5px 10px',
                      background: 'var(--bg-base)',
                      border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: 'var(--r-sm)',
                      color: 'var(--warning)', fontWeight: 700,
                      fontSize: '0.88rem', textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '0.82rem', color: 'var(--warning)', fontWeight: 600 }}>CKB</span>
                </div>
              )}
            </div>
            {isPaid && (
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Readers must send {unlockPrice} CKB to your wallet to unlock this post. Stored on-chain in metadata.
              </div>
            )}
          </div>

          {/* Markdown Toolbar */}
          <div className="form-group">
            <label className="form-label">Content * (Markdown)</label>
            <div className="md-toolbar">
              {TOOLBAR.map((item, idx) =>
                item.type === 'sep' ? (
                  <div key={idx} className="md-toolbar-sep" />
                ) : (
                  <button
                    key={idx}
                    className="md-toolbar-btn"
                    title={item.title}
                    type="button"
                    onClick={item.action}
                  >
                    {item.label}
                  </button>
                )
              )}
            </div>

            {/* Split editor / preview */}
            <div className="editor-split">
              <div className="split-pane">
                <div className="split-label">✏️ Markdown</div>
                <textarea
                  id="post-body"
                  ref={bodyRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write your post in Markdown..."
                  style={{ minHeight: '360px' }}
                />
              </div>
              <div className="split-pane">
                <div className="split-label">👁 Preview</div>
                <div
                  className="preview-pane post-body"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          </div>

          {/* CKBFS checksum preview */}
          {checksumPreview !== null && (
            <div className="checksum-display">
              <span>⚙</span>
              <span className="cs-label">Adler32:</span>
              <span className="cs-value">0x{(checksumPreview >>> 0).toString(16).padStart(8, '0')}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Witness size: {witnessBytes} bytes
              </span>
            </div>
          )}

          {/* Witness format reminder */}
          <div className="protocol-bar">
            <div className="pbar-item">
              <div className="pbar-dot" />
              <span>Witness: <code style={{ color: 'var(--primary)' }}>CKBFS|0x00|content</code></span>
            </div>
            <div className="pbar-item">
              <div className="pbar-dot" style={{ background: 'var(--accent)' }} />
              <span>content_type: application/json · immutable</span>
            </div>
          </div>

          {/* Publish pipeline visual indicator */}
          {publishStep >= 0 && (
            <div style={{
              padding: '16px 20px',
              background: 'rgba(0,212,170,0.04)',
              border: '1px solid rgba(0,212,170,0.15)',
              borderRadius: 'var(--r-md)',
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>
                CKBFS PUBLISH PIPELINE
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto' }}>
                {[
                  { label: 'Draft', icon: '📝' },
                  { label: 'Encode', icon: '⚡' },
                  { label: 'Sign', icon: '🔐' },
                  { label: 'Broadcast', icon: '📡' },
                  { label: 'Done', icon: '✅' },
                ].map((step, idx) => {
                  const done = idx < publishStep;
                  const active = idx === publishStep;
                  void (idx > publishStep); // pending state is implicit

                  return (
                    <div key={step.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        padding: '8px 12px',
                        background: done ? 'rgba(0,212,170,0.12)' : active ? 'rgba(124,111,255,0.12)' : 'transparent',
                        borderRadius: 'var(--r-md)',
                        border: `1px solid ${done ? 'rgba(0,212,170,0.25)' : active ? 'rgba(124,111,255,0.3)' : 'var(--border-subtle)'}`,
                        transition: 'all 0.3s ease',
                        minWidth: '72px',
                      }}>
                        <span style={{ fontSize: '1.1rem' }}>
                          {active ? <span className="spinner" style={{ width: '18px', height: '18px' }} /> : step.icon}
                        </span>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 600,
                          color: done ? 'var(--primary)' : active ? 'var(--accent)' : 'var(--text-muted)',
                        }}>
                          {step.label}
                        </span>
                      </div>
                      {idx < 4 && (
                        <div style={{
                          width: '24px', height: '2px',
                          background: done ? 'var(--primary)' : 'var(--border-subtle)',
                          margin: '0 -1px', transition: 'background 0.3s',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              id="submit-post-btn"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Processing...</>
              ) : walletConnected ? (
                appendMode ? '🔗 Append to CKBFS' : '🚀 Publish to CKBFS'
              ) : '🔗 Connect & Publish'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Assist Panel */}
      {showAI && (
        <div className="modal-overlay" onClick={() => setShowAI(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="heading-md">✨ AI Writing Assist</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAI(false)}>✕</button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {([
                { type: 'improve' as const, icon: '✨', label: 'Improve Content', desc: 'Rewrite for clarity & impact' },
                { type: 'title'   as const, icon: '🧠', label: 'Generate Title', desc: '3 headline options' },
                { type: 'summary' as const, icon: '📄', label: 'Write Summary', desc: 'One-line feed description' },
              ]).map(action => (
                <button
                  key={action.type}
                  id={`ai-${action.type}-btn`}
                  onClick={() => callAI(action.type)}
                  disabled={aiLoading}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    padding: '14px 10px',
                    background: aiAction === action.type
                      ? 'rgba(124,111,255,0.15)'
                      : 'var(--bg-elevated)',
                    border: `1px solid ${aiAction === action.type ? 'rgba(124,111,255,0.4)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)',
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    opacity: aiLoading && aiAction !== action.type ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>
                    {aiLoading && aiAction === action.type
                      ? <span className="spinner" style={{ width: '20px', height: '20px' }} />
                      : action.icon}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{action.label}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{action.desc}</span>
                </button>
              ))}
            </div>

            {/* Loading state */}
            {aiLoading && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '16px', background: 'var(--bg-elevated)',
                borderRadius: 'var(--r-md)', marginBottom: '16px',
              }}>
                <div className="spinner" />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  {aiAction === 'improve' ? 'Rewriting content...' : aiAction === 'title' ? 'Generating titles...' : 'Summarizing...'}
                </span>
              </div>
            )}

            {/* Result area */}
            {!aiLoading && aiResult && (
              <div style={{ marginBottom: '16px' }}>
                {/* Mock badge */}
                {aiMock && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '2px 10px', borderRadius: 'var(--r-full)',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                    color: 'var(--warning)', fontSize: '0.7rem', fontWeight: 600,
                    marginBottom: '10px',
                  }}>
                    ⚠️ Mock — add OPENROUTER_API_KEY to .env.local for real AI
                  </div>
                )}

                {/* Title chips */}
                {aiAction === 'title' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Click a title to apply it:</div>
                    {aiResult.split('\n').filter(l => l.trim()).map((line, i) => {
                      const clean = line.replace(/^\d+\.\s*/, '').trim();
                      if (!clean) return null;
                      return (
                        <button
                          key={i}
                          onClick={() => { setTitle(clean); pushNotification({ type: 'success', message: 'Title applied ✅', duration: 2000 }); setShowAI(false); }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '10px 14px',
                            background: 'rgba(124,111,255,0.08)',
                            border: '1px solid rgba(124,111,255,0.2)',
                            borderRadius: 'var(--r-md)',
                            color: 'var(--text-primary)', fontSize: '0.88rem',
                            cursor: 'pointer', fontWeight: 500,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,111,255,0.16)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(124,111,255,0.08)')}
                        >
                          {clean}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Improve / summary preview */
                  <div
                    style={{
                      padding: '14px 16px',
                      background: 'rgba(124,111,255,0.06)',
                      border: '1px solid rgba(124,111,255,0.18)',
                      borderRadius: 'var(--r-md)',
                      fontSize: '0.85rem', lineHeight: 1.6,
                      color: 'var(--text-secondary)',
                      maxHeight: '200px', overflowY: 'auto',
                      fontFamily: aiAction === 'improve' ? 'var(--font-mono)' : 'inherit',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {aiResult.slice(0, 600)}{aiResult.length > 600 ? '…' : ''}
                  </div>
                )}
              </div>
            )}

            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
              {!aiLoading && aiResult && aiAction !== 'title' && (
                <button
                  className="btn btn-primary btn-sm"
                  id="ai-apply-btn"
                  onClick={applyAIResult}
                >
                  {aiAction === 'improve' ? '✨ Apply to Content' : '📄 Apply Summary'}
                </button>
              )}
              {!aiLoading && aiResult && (
                <button
                  className={`ai-copy-btn ${aiCopied ? 'copied' : ''}`}
                  id="ai-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(aiResult).then(() => {
                      setAiCopied(true);
                      setTimeout(() => setAiCopied(false), 2000);
                    });
                  }}
                >
                  {aiCopied ? '✓ Copied!' : '⎘ Copy'}
                </button>
              )}
              {!aiLoading && aiResult && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setAiResult(null); setAiAction(null); setAiCopied(false); }}
                >
                  ↺ Try Again
                </button>
              )}
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowAI(false)}>
                Close
              </button>
            </div>


            {/* Protocol bar */}
            <div className="protocol-bar" style={{ marginTop: '16px' }}>
              <div className="pbar-item">
                <div className="pbar-dot" style={{ background: aiMock ? 'var(--warning)' : 'var(--primary)' }} />
                <span>{aiMock ? 'Mock mode — set OPENROUTER_API_KEY for live AI' : 'Claude (via OpenRouter) · Your content is not stored'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
