import { NextResponse } from 'next/server';
import { fetchAllPosts } from '@/lib/ckbfs/indexer';

// CKB RPC responses are 2-3MB — way over Next.js's 2MB fetch cache limit.
// Force dynamic rendering so Next.js never tries to cache these responses.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const posts = await fetchAllPosts();
    return NextResponse.json({ success: true, data: posts });
  } catch (error: unknown) {
    // Never crash the feed — return an empty list so the UI shows the empty state
    // instead of a fatal error. The error is logged server-side for debugging.
    const message = error instanceof Error ? error.message : String(error);
    console.error('[/api/blogs] fetchAllPosts failed:', message);
    return NextResponse.json({ success: true, data: [], error: message });
  }
}

