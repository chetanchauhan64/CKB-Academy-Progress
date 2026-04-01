'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCcc } from '@ckb-ccc/connector-react';
import { useStore } from '@/lib/store';
import { ValidatedBlogPost } from '@/lib/ckbfs/metadata';
import { CKBFSResolvedData } from '@/lib/ckbfs/indexer';
import Editor from '@/components/Editor';

function WritePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appendTarget = searchParams.get('append') ?? undefined;

  const { signerInfo } = useCcc();
  const signer = signerInfo?.signer ?? null;
  const { walletConnected, walletAddress, walletType, connectWallet, publishPost, appendPost, posts, pushNotification } = useStore();
  const [submitting, setSubmitting] = useState(false);

  const isCKBWallet = !walletConnected || walletType === 'CKB' || walletType === null;

  async function handleSubmit({ mode, post, selectedPostTx }: {
    mode: 'publish' | 'append';
    post: ValidatedBlogPost;
    selectedPostTx: string;
  }) {
    if (!walletConnected || !signer) {
      connectWallet();
      return;
    }
    // Block EVM wallets from submitting — CKB signer is required
    if (!isCKBWallet) {
      pushNotification({ type: 'error', message: 'Switch to JoyID (CKB) wallet to publish on CKBFS. EVM wallets are read-only.', duration: 5000 });
      return;
    }
    if (!post.title.trim()) {
      pushNotification({ type: 'error', message: 'Please add a title.', duration: 3000 });
      return;
    }
    if (!post.content.trim()) {
      pushNotification({ type: 'error', message: 'Post content cannot be empty.', duration: 3000 });
      return;
    }
    if (mode === 'append' && !selectedPostTx) {
      pushNotification({ type: 'error', message: 'Please select a post to append to.', duration: 3000 });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'append') {
        const existingPost = posts.find(p => p.txHash === selectedPostTx) as CKBFSResolvedData | undefined;
        if (!existingPost) throw new Error('Post not found in local cache');

        // Build updated post with schema fields — content_type / filename stay unchanged (CKBFS immutability)
        const updatedPost: ValidatedBlogPost = {
          title:        post.title,
          description:  post.description ?? '',
          author:       existingPost.metadata.author,
          tags:         post.tags,
          created_at:   existingPost.metadata.created_at,
          updated_at:   Date.now(),
          is_paid:      post.is_paid ?? false,
          unlock_price: post.unlock_price ?? 0,
          content:      post.content,
        };
        const result = await appendPost(signer, selectedPostTx, (existingPost as CKBFSResolvedData & { outputIndex?: number }).outputIndex ?? 0, updatedPost);
        router.push(`/post/${result.txHash}`);
      } else {
        const result = await publishPost(signer, { ...post, author: walletAddress! });
        router.push(`/post/${result.txHash}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      pushNotification({ type: 'error', message: msg, duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <>
      {/* CKB-only transaction guard banner */}
      {walletConnected && !isCKBWallet && (
        <div style={{
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 'var(--r-md)',
          padding: '12px 20px',
          margin: '0 24px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.875rem',
          color: 'var(--warning)',
        }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚠️</span>
          <span>
            <strong>Switch to JoyID (CKB)</strong> to perform on-chain actions.
            Your current wallet ({walletType}) is read-only and cannot sign CKB transactions.
          </span>
        </div>
      )}
      <Editor appendTargetTxHash={appendTarget} onSubmit={handleSubmit} submitting={submitting} />
    </>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={
      <div className="page-content narrow">
        <div className="skeleton" style={{ height: '48px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '400px' }} />
      </div>
    }>
      <WritePageInner />
    </Suspense>
  );
}
