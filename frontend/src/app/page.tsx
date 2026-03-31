'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import PostCard, { computeScore } from '@/components/PostCard';

type FeedSort = 'latest' | 'trending' | 'versions';

const HERO_FEATURES = [
  {
    icon: '📝',
    title: 'Publish',
    desc: 'Store blog posts permanently in CKB witnesses with Adler32 checksum.',
  },
  {
    icon: '🔗',
    title: 'Append',
    desc: 'Update posts by chaining witness content. Backlinks are immutable.',
  },
  {
    icon: '🍴',
    title: 'Fork',
    desc: 'Clone any post as a CellDep, inherit its history, create a new branch.',
  },
  {
    icon: '🔐',
    title: 'Transfer',
    desc: 'Transfer cell ownership via lock script. Checksum never changes.',
  },
];

export default function HomePage() {
  const { posts, loadAllPosts, globalLoading, globalError, votes, loadVotes } = useStore();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [feedSort, setFeedSort] = useState<FeedSort>('latest');
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadAllPosts();
    loadVotes();
  }, [loadAllPosts, loadVotes]);

  // Debounce search input (300ms)
  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 300);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllPosts();
    setRefreshing(false);
  }, [loadAllPosts]);

  // Extract all unique tags from posts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    posts.forEach(p => (p.metadata.tags ?? []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).slice(0, 12);
  }, [posts]);

  // Trending sidebar = top 3 by DAO score
  const trending = useMemo(() =>
    [...posts]
      .sort((a, b) => {
        const aV = votes[a.txHash] ?? { upvotes: 0, flags: 0 };
        const bV = votes[b.txHash] ?? { upvotes: 0, flags: 0 };
        return computeScore(bV.upvotes, bV.flags, b.backlinks.length)
             - computeScore(aV.upvotes, aV.flags, a.backlinks.length);
      })
      .slice(0, 3),
    [posts, votes]
  );

  // Filtered + sorted posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];
    // Sort first
    if (feedSort === 'trending') {
      result.sort((a, b) => {
        const aV = votes[a.txHash] ?? { upvotes: 0, flags: 0 };
        const bV = votes[b.txHash] ?? { upvotes: 0, flags: 0 };
        return computeScore(bV.upvotes, bV.flags, b.backlinks.length)
             - computeScore(aV.upvotes, aV.flags, a.backlinks.length);
      });
    } else if (feedSort === 'versions') {
      result.sort((a, b) => (b.backlinks.length + 1) - (a.backlinks.length + 1));
    }
    // Then filter
    if (activeTag) {
      result = result.filter(p => (p.metadata.tags ?? []).includes(activeTag));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.metadata.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        (p.metadata.description ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [posts, votes, search, activeTag, feedSort]);

  // Network stats
  const totalVersions = useMemo(() => posts.reduce((acc, p) => acc + p.backlinks.length + 1, 0), [posts]);
  const totalForked = useMemo(() => posts.filter(p => p.backlinks.length > 0).length, [posts]);

  return (
    <>
      {/* Hero */}
      <section
        style={{
          padding: '80px 24px 60px',
          maxWidth: 'var(--max-wide)',
          margin: '0 auto',
          position: 'relative',
        }}
      >
        {/* Glow orbs */}
        <div style={{
          position: 'absolute', top: '40px', left: '10%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '60px', right: '10%',
          width: '300px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,111,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
          <div className="badge badge-publish anim-fade-in" style={{ margin: '0 auto 20px', display: 'inline-flex' }}>
            ⛓ Built on CKBFS Protocol
          </div>

          <h1 className="heading-xl anim-fade-up" style={{ marginBottom: '24px' }}>
            Decentralized Publishing<br />
            <span className="text-gradient">on Nervos CKB</span>
          </h1>

          <p className="anim-fade-up" style={{
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.75,
            marginBottom: '36px',
            animationDelay: '100ms',
          }}>
            Write once, live forever. Blog posts stored in CKBFS witnesses
            with immutable version control, forking, and wallet-based identity.
            No servers. No censorship. No email.
          </p>

          <div className="anim-fade-up" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', animationDelay: '200ms' }}>
            <Link href="/write" className="btn btn-primary btn-lg" id="hero-write-btn">
              ✍️ Start Writing
            </Link>
            <Link href="/dashboard" className="btn btn-secondary btn-lg" id="hero-dashboard-btn">
              📊 Dashboard
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginTop: '60px',
        }}>
          {HERO_FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="card-glass anim-fade-up"
              style={{
                padding: '20px 22px',
                animationDelay: `${i * 80 + 300}ms`,
              }}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '10px' }}>{f.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>{f.title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feed */}
      <section
        style={{
          maxWidth: 'var(--max-wide)',
          margin: '0 auto',
          padding: '0 24px 80px',
        }}
      >
        {/* Search & filter bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: '1 1 260px' }}>
            <span className="search-icon">🔍</span>
            <input
              id="feed-search"
              placeholder="Search posts by title or content..."
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearch(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
              >✕</button>
            )}
          </div>
          {/* Refresh button */}
          <button
            id="feed-refresh-btn"
            className={`btn-refresh ${refreshing || globalLoading ? 'spinning' : ''}`}
            onClick={handleRefresh}
            disabled={globalLoading || refreshing}
            title="Refresh feed"
          >
            <span style={{ display: 'inline-block' }}>↻</span>
            {refreshing || globalLoading ? 'Syncing...' : 'Refresh'}
          </button>
          <Link href="/write" className="btn btn-secondary btn-sm" id="feed-write-btn">
            + New Post
          </Link>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <button
              className={`tag ${activeTag === null ? 'tag-active' : ''}`}
              onClick={() => setActiveTag(null)}
              style={{ cursor: 'pointer' }}
            >
              All
            </button>
            {allTags.map(t => (
              <button
                key={t}
                className={`tag ${activeTag === t ? 'tag-active' : ''}`}
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                style={{ cursor: 'pointer' }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Trending section — show when not filtering */}
        {!search && !activeTag && trending.length > 0 && posts.length > 3 && (
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <h2 className="heading-md">🔥 Trending</h2>
              <span className="trending-badge">Most Activity</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {trending.map((post, i) => (
                <Link
                  key={post.txHash}
                  href={`/post/${post.txHash}`}
                  className="anim-fade-up"
                  style={{ animationDelay: `${i * 60}ms`, display: 'block' }}
                >
                  <div className="card" style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '1.1rem' }}>🔥</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600 }}>
                        #{i + 1} Trending
                      </span>
                      {post.backlinks.length > 0 && (
                        <span className="badge badge-append" style={{ marginLeft: 'auto' }}>
                          v{post.backlinks.length + 1}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                      {post.metadata.title}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.metadata.description || post.content.replace(/[#*_`[\]]/g, '').slice(0, 120)}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {(post.metadata.tags ?? []).slice(0, 3).map(t => (
                        <span key={t} className="tag" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Feed header + sort */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
        }}>
          <div>
            <h2 className="heading-lg" style={{ marginBottom: '4px' }}>
              {activeTag ? `#${activeTag}` : search ? 'Search Results' : 'Global Feed'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {filteredPosts.length > 0
                ? `${filteredPosts.length} post${filteredPosts.length !== 1 ? 's' : ''} ${activeTag ? `tagged "${activeTag}"` : search ? 'found' : 'on CKBFS testnet'}`
                : globalLoading ? 'Indexing real CKB blocks...' : 'No posts match your filter'}
            </p>
          </div>

          {/* Sort controls */}
          {!search && !activeTag && (
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '4px' }}>
              {([
                { key: 'latest' as FeedSort, label: '🕐 Latest' },
                { key: 'trending' as FeedSort, label: '🔥 Trending' },
                { key: 'versions' as FeedSort, label: '🔗 Versions' },
              ]).map(s => (
                <button
                  key={s.key}
                  id={`sort-${s.key}-btn`}
                  onClick={() => setFeedSort(s.key)}
                  style={{
                    padding: '5px 12px', borderRadius: 'var(--r-sm)',
                    fontSize: '0.78rem', fontWeight: 600,
                    background: feedSort === s.key ? 'var(--primary)' : 'transparent',
                    color: feedSort === s.key ? '#000' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Protocol + network stats bar */}
        <div className="protocol-bar" style={{ marginBottom: '24px' }}>
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--accent)' }} />
            <span>CKBFS Testnet</span>
          </div>
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--primary)' }} />
            <span>{posts.length} cells indexed</span>
          </div>
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--warning)' }} />
            <span>{totalVersions} total versions</span>
          </div>
          <div className="pbar-item">
            <div className="pbar-dot" style={{ background: 'var(--success)' }} />
            <span>{totalForked} with backlinks</span>
          </div>
        </div>


        {/* Post grid */}
        {globalLoading ? (
          <div style={{ display: 'grid', gap: '20px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '180px' }} className="skeleton" />
            ))}
            <div style={{
              textAlign: 'center', color: 'var(--text-muted)',
              fontSize: '0.875rem', paddingTop: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <span style={{
                display: 'inline-block', width: '8px', height: '8px',
                borderRadius: '50%', background: 'var(--primary)',
                animation: 'pulse 1.4s ease-in-out infinite',
              }} />
              Indexing blockchain... please wait
            </div>
          </div>
        ) : globalError && posts.length === 0 ? (
          <div className="error-state">
            <div className="error-icon">⚡</div>
            <div className="error-title">Failed to load posts</div>
            <div className="error-sub">{globalError}</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn-retry" id="feed-retry-btn" onClick={() => loadAllPosts()}>
                ↺ Retry
              </button>
              <Link href="/write" className="btn btn-secondary" id="feed-error-write-btn">
                ✍️ Write a Post
              </Link>
            </div>
          </div>
        ) : !globalLoading && filteredPosts.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">{search || activeTag ? '🔍' : '📭'}</div>
            <div className="empty-title">
              {search || activeTag ? 'No posts match your filter' : 'No posts found on-chain yet.'}
            </div>
            <div className="empty-sub">
              {search
                ? `No results for "${search}". Try a different search term.`
                : activeTag
                ? `No posts tagged "${activeTag}" yet.`
                : 'Be the first to create a verifiable CKBFS post on the Testnet!'}
            </div>
            {(search || activeTag) ? (
              <button
                className="btn btn-secondary"
                onClick={() => { setSearch(''); setActiveTag(null); }}
              >
                Clear Filters
              </button>
            ) : (
              <Link href="/write" className="btn btn-secondary" id="empty-write-btn">
                ✍️ Write a Post
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Stale-data warning when a re-fetch failed but we still have cached posts */}
            {globalError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                padding: '10px 16px', marginBottom: '16px',
                background: 'var(--error-bg)', border: '1px solid var(--error-border)',
                borderRadius: 'var(--r-md)', fontSize: '0.83rem', color: 'var(--error)',
              }}>
                <span>⚠️ Showing cached data — refresh failed.</span>
                <button className="btn-retry" style={{ padding: '4px 12px', fontSize: '0.78rem' }} onClick={() => loadAllPosts()}>
                  ↺ Retry
                </button>
              </div>
            )}
            <div style={{ display: 'grid', gap: '20px' }}>
              {filteredPosts.map((post, i) => (
                <PostCard
                  key={post.txHash}
                  post={post}
                  animDelay={i * 60}
                />
              ))}
            </div>
          </>
        )}

      </section>
    </>
  );
}
