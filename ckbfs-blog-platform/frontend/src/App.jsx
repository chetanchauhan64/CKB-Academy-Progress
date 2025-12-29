import React, { useState, useEffect } from 'react';
import { FileText, Upload, ChevronRight, Calendar, User, Hash } from 'lucide-react';

/**
 * CKBFS Decentralized Blog Platform
 * 
 * Architecture Overview:
 * - Blog posts are stored in CKBFS (CKB File System)
 * - Each post has a unique CID (Content Identifier)
 * - Metadata stored separately for efficient indexing
 * - Fully decentralized content delivery
 * 
 * Data Flow:
 * 1. User creates post → Upload to CKBFS via script
 * 2. CKBFS returns CID → Store in metadata
 * 3. Frontend fetches metadata → Retrieves content by CID
 */

// Mock CKBFS Service (Replace with actual CKBFS integration)
const ckbfsService = {
  /**
   * Fetches blog metadata from CKBFS
   * In production: Call CKBFS API with metadata CID
   */
  async getMetadata() {
    // Simulate CKBFS fetch delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return [
      {
        id: '1',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        title: 'Building Decentralized Applications on Nervos CKB',
        author: 'Alice Zhang',
        timestamp: new Date('2025-01-15').toISOString(),
        excerpt: 'Exploring the power of Cell Model and CKBFS for next-generation dApps...',
        tags: ['Nervos', 'CKBFS', 'Blockchain']
      },
      {
        id: '2',
        cid: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
        title: 'Why CKBFS is a Game-Changer for Content Storage',
        author: 'Bob Chen',
        timestamp: new Date('2025-01-10').toISOString(),
        excerpt: 'Traditional cloud storage vs. decentralized file systems: a technical comparison...',
        tags: ['Storage', 'Web3', 'Tutorial']
      },
      {
        id: '3',
        cid: 'bafkreie5cvv4h4spsj6i3b2nqjrgzfpkqzxhw7jjj2szgqswjsrqkr5yhe',
        title: 'Smart Contract Patterns for Scalable Layer 2 Solutions',
        author: 'Carol Liu',
        timestamp: new Date('2025-01-05').toISOString(),
        excerpt: 'Learn how to optimize smart contracts for high-throughput applications...',
        tags: ['Smart Contracts', 'Layer 2', 'Architecture']
      }
    ];
  },

  /**
   * Fetches full blog content from CKBFS using CID
   * In production: Use CKBFS gateway or direct cell query
   */
  async getContent(cid) {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const mockContent = {
      'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi': `# Building Decentralized Applications on Nervos CKB

## Introduction

Nervos CKB provides a unique programming model called the Cell Model, which enables true ownership and programmable storage. In this post, we'll explore how CKBFS extends this capability for file storage.

## Why CKBFS?

Traditional cloud storage:
- Centralized control
- Vendor lock-in
- Data can be censored or removed

CKBFS advantages:
- **Immutable**: Content cannot be altered once stored
- **Censorship-resistant**: No single point of failure
- **Content-addressed**: Files identified by cryptographic hash (CID)

## Architecture Example

\`\`\`javascript
// Store content in CKBFS
const cid = await ckbfs.upload(content);

// Retrieve content by CID
const data = await ckbfs.fetch(cid);
\`\`\`

## Conclusion

CKBFS represents the future of decentralized content delivery. By combining it with CKB's Cell Model, developers can build truly unstoppable applications.`,

      'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku': `# Why CKBFS is a Game-Changer for Content Storage

## The Problem with Centralized Storage

Modern web applications rely on centralized cloud providers like AWS S3, Google Cloud Storage, or Azure Blob Storage. While convenient, these introduce several risks:

1. **Single point of failure**: Provider outages affect your application
2. **Cost unpredictability**: Pricing can change arbitrarily
3. **Data sovereignty**: Your data exists in someone else's infrastructure

## How CKBFS Works

CKBFS (CKB File System) stores files as cells on the Nervos blockchain:

- Each file gets a unique CID (Content Identifier)
- Content is cryptographically verified
- Files are distributed across the network
- Retrieving content requires only the CID

## Real-World Use Cases

- **NFT Metadata**: Store artwork and metadata immutably
- **Decentralized Blogs**: Censorship-resistant publishing
- **Academic Archives**: Tamper-proof research storage
- **Legal Documents**: Verifiable document storage

## Getting Started

Check out the CKBFS documentation to start building decentralized applications today!`,

      'bafkreie5cvv4h4spsj6i3b2nqjrgzfpkqzxhw7jjj2szgqswjsrqkr5yhe': `# Smart Contract Patterns for Scalable Layer 2 Solutions

## Understanding Layer 2 Scaling

Layer 2 solutions process transactions off the main blockchain while inheriting its security guarantees. Nervos CKB's Cell Model makes it uniquely suited for Layer 2 architectures.

## Key Patterns

### 1. State Channels
State channels allow participants to transact off-chain and only settle final states on-chain.

### 2. Optimistic Rollups
Transactions are assumed valid unless proven fraudulent during a challenge period.

### 3. Zero-Knowledge Rollups
Use cryptographic proofs to verify transaction validity without revealing data.

## CKBFS in Layer 2

Store Layer 2 state proofs and transaction data in CKBFS:
- Reduced on-chain storage costs
- Permanent data availability
- Easy state reconstruction

## Implementation Tips

1. Minimize on-chain data
2. Batch transactions efficiently
3. Implement fraud proofs correctly
4. Use CKBFS for auxiliary data

## Conclusion

Combining CKB's flexibility with CKBFS storage creates powerful scaling solutions.`
    };
    
    return mockContent[cid] || 'Content not found';
  }
};

// Header Component
function Header({ onNavigate, currentView }) {
  return (
    <header className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">CKBFS Blog</h1>
              <p className="text-sm text-emerald-100">Decentralized Publishing Platform</p>
            </div>
          </div>
          <nav className="flex space-x-4">
            <button
              onClick={() => onNavigate('list')}
              className={`px-4 py-2 rounded-lg transition ${
                currentView === 'list' 
                  ? 'bg-white text-emerald-600 font-semibold' 
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              Browse Posts
            </button>
            <button
              onClick={() => onNavigate('publish')}
              className={`px-4 py-2 rounded-lg transition flex items-center space-x-2 ${
                currentView === 'publish' 
                  ? 'bg-white text-emerald-600 font-semibold' 
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Publish</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600"></div>
      <p className="mt-4 text-gray-600">Loading from CKBFS...</p>
    </div>
  );
}

// Blog Card Component
function BlogCard({ post, onClick }) {
  return (
    <article 
      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 cursor-pointer border border-gray-100 hover:border-emerald-300"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-900 hover:text-emerald-600 transition">
          {post.title}
        </h2>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
      </div>
      
      <p className="text-gray-600 mb-4 line-clamp-2">{post.excerpt}</p>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {post.tags.map(tag => (
          <span 
            key={tag}
            className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium"
          >
            {tag}
          </span>
        ))}
      </div>
      
      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1">
            <User className="w-4 h-4" />
            <span>{post.author}</span>
          </span>
          <span className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(post.timestamp).toLocaleDateString()}</span>
          </span>
        </div>
        <span className="flex items-center space-x-1 text-xs font-mono bg-gray-100 px-2 py-1 rounded">
          <Hash className="w-3 h-3" />
          <span>{post.cid.slice(0, 8)}...</span>
        </span>
      </div>
    </article>
  );
}

// Blog List Component
function BlogList({ posts, onSelectPost, loading }) {
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Latest Posts</h2>
        <p className="text-gray-600">All content stored permanently on CKBFS</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map(post => (
          <BlogCard 
            key={post.id} 
            post={post} 
            onClick={() => onSelectPost(post)}
          />
        ))}
      </div>
    </div>
  );
}

// Blog Detail Component
function BlogDetail({ post, content, onBack, loading }) {
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <button
        onClick={onBack}
        className="mb-6 flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 transition"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span>Back to all posts</span>
      </button>
      
      <article className="bg-white rounded-xl shadow-lg p-8">
        <header className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-6 text-gray-600">
              <span className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span className="font-medium">{post.author}</span>
              </span>
              <span className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>{new Date(post.timestamp).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm">
              <Hash className="w-4 h-4 text-gray-400" />
              <span className="font-mono text-gray-500 bg-gray-100 px-3 py-1 rounded">
                CID: {post.cid.slice(0, 16)}...
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map(tag => (
              <span 
                key={tag}
                className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>
        
        <div className="prose prose-lg prose-emerald max-w-none">
          {content.split('\n').map((paragraph, idx) => {
            if (paragraph.startsWith('# ')) {
              return <h1 key={idx} className="text-3xl font-bold mt-8 mb-4">{paragraph.slice(2)}</h1>;
            } else if (paragraph.startsWith('## ')) {
              return <h2 key={idx} className="text-2xl font-bold mt-6 mb-3">{paragraph.slice(3)}</h2>;
            } else if (paragraph.startsWith('### ')) {
              return <h3 key={idx} className="text-xl font-bold mt-4 mb-2">{paragraph.slice(4)}</h3>;
            } else if (paragraph.startsWith('```')) {
              return null;
            } else if (paragraph.trim().match(/^\d+\./)) {
              return <li key={idx} className="ml-6">{paragraph}</li>;
            } else if (paragraph.trim().startsWith('-') || paragraph.trim().startsWith('*')) {
              return <li key={idx} className="ml-6">{paragraph.slice(1).trim()}</li>;
            } else if (paragraph.trim()) {
              return <p key={idx} className="mb-4 text-gray-700 leading-relaxed">{paragraph}</p>;
            }
            return null;
          })}
        </div>
      </article>
    </div>
  );
}

// Publish Form Component
function PublishForm({ onPublish }) {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    content: '',
    tags: ''
  });
  const [isPublishing, setIsPublishing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsPublishing(true);
    
    // Simulate CKBFS upload process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    onPublish(formData);
    setIsPublishing(false);
    
    // Reset form
    setFormData({ title: '', author: '', content: '', tags: '' });
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Publish to CKBFS</h2>
        <p className="text-gray-600 mb-8">Your content will be stored permanently on the decentralized file system</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="Enter your blog post title"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Author
            </label>
            <input
              type="text"
              required
              value={formData.author}
              onChange={(e) => setFormData({...formData, author: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="Your name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Content (Markdown supported)
            </label>
            <textarea
              required
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              rows={12}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono text-sm"
              placeholder="Write your blog post content here..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({...formData, tags: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="e.g., Blockchain, Tutorial, Web3"
            />
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> When you publish, your content is uploaded to CKBFS, 
              generating a unique CID (Content Identifier). This CID is stored in metadata, 
              allowing anyone to retrieve your post immutably.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isPublishing}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-lg font-semibold hover:from-emerald-700 hover:to-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isPublishing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Publishing to CKBFS...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Publish Post</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const [view, setView] = useState('list');
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postContent, setPostContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    const metadata = await ckbfsService.getMetadata();
    setPosts(metadata);
    setLoading(false);
  };

  const handleSelectPost = async (post) => {
    setView('detail');
    setLoading(true);
    setSelectedPost(post);
    const content = await ckbfsService.getContent(post.cid);
    setPostContent(content);
    setLoading(false);
  };

  const handlePublish = (formData) => {
    const newPost = {
      id: String(posts.length + 1),
      cid: 'bafkrei' + Math.random().toString(36).substring(2, 50),
      title: formData.title,
      author: formData.author,
      timestamp: new Date().toISOString(),
      excerpt: formData.content.slice(0, 100) + '...',
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    };
    
    setPosts([newPost, ...posts]);
    setView('list');
    alert('✅ Post published to CKBFS successfully!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50">
      <Header onNavigate={setView} currentView={view} />
      
      {view === 'list' && (
        <BlogList 
          posts={posts} 
          onSelectPost={handleSelectPost}
          loading={loading}
        />
      )}
      
      {view === 'detail' && selectedPost && (
        <BlogDetail 
          post={selectedPost}
          content={postContent}
          onBack={() => setView('list')}
          loading={loading}
        />
      )}
      
      {view === 'publish' && (
        <PublishForm onPublish={handlePublish} />
      )}
      
      <footer className="bg-gray-900 text-gray-400 py-8 mt-16">
        <div className="container mx-auto px-6 text-center">
          <p className="mb-2">Built with Nervos CKB + CKBFS</p>
          <p className="text-sm">Decentralized • Immutable • Censorship-Resistant</p>
        </div>
      </footer>
    </div>
  );
}