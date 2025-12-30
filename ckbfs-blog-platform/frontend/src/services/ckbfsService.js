/**
 * CKBFS Service - Frontend API Client
 * 
 * Handles all communication with the Express backend API
 * which interfaces with CKBFS for decentralized storage
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Generic API request handler with error handling
 */
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return data;

  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Fetch blog metadata from CKBFS
 * Returns array of blog posts with CIDs
 */
export async function getMetadata() {
  try {
    // For now, return mock data since we're not storing metadata globally yet
    // In production, this would fetch from a metadata CID
    
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

  } catch (error) {
    console.error('Failed to fetch metadata:', error);
    throw error;
  }
}

/**
 * Fetch blog content by CID from CKBFS
 * 
 * @param {string} cid - Content Identifier
 * @returns {Promise<string>} Blog post content
 */
export async function getContent(cid) {
  try {
    const response = await apiRequest(`/content/${cid}`);
    return response.data.content;

  } catch (error) {
    console.error(`Failed to fetch content for CID ${cid}:`, error);
    throw error;
  }
}

/**
 * Upload blog post content to CKBFS
 * 
 * @param {string} content - Blog post content (markdown)
 * @param {string} title - Optional title for logging
 * @returns {Promise<object>} Upload result with CID
 */
export async function uploadContent(content, title = '') {
  try {
    const response = await apiRequest('/upload/content', {
      method: 'POST',
      body: JSON.stringify({ content, title }),
    });

    return response.data;

  } catch (error) {
    console.error('Failed to upload content:', error);
    throw error;
  }
}

/**
 * Upload blog post metadata to CKBFS
 * 
 * @param {object} metadata - Post metadata
 * @param {string} metadata.title - Post title
 * @param {string} metadata.author - Author name
 * @param {string} metadata.contentCID - CID of the content
 * @param {string} metadata.excerpt - Post excerpt
 * @param {string[]} metadata.tags - Post tags
 * @returns {Promise<object>} Metadata upload result
 */
export async function uploadMetadata(metadata) {
  try {
    const response = await apiRequest('/upload/metadata', {
      method: 'POST',
      body: JSON.stringify(metadata),
    });

    return response.data;

  } catch (error) {
    console.error('Failed to upload metadata:', error);
    throw error;
  }
}

/**
 * Upload media file (image) to CKBFS
 * 
 * @param {File} file - Image file object
 * @returns {Promise<object>} Upload result with CID and URL
 */
export async function uploadMedia(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload/media`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header, let browser set it with boundary
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Media upload failed');
    }

    return data.data;

  } catch (error) {
    console.error('Failed to upload media:', error);
    throw error;
  }
}

/**
 * Publish a complete blog post (content + metadata)
 * 
 * @param {object} postData - Complete post data
 * @param {string} postData.title - Post title
 * @param {string} postData.author - Author name
 * @param {string} postData.content - Post content
 * @param {string[]} postData.tags - Post tags
 * @returns {Promise<object>} Complete publish result
 */
export async function publishPost(postData) {
  try {
    // Step 1: Upload content to CKBFS
    const contentResult = await uploadContent(postData.content, postData.title);

    // Step 2: Create excerpt from content
    const excerpt = postData.content
      .replace(/[#*`]/g, '')
      .trim()
      .substring(0, 150) + '...';

    // Step 3: Upload metadata
    const metadataResult = await uploadMetadata({
      title: postData.title,
      author: postData.author,
      contentCID: contentResult.cid,
      excerpt,
      tags: postData.tags,
    });

    return {
      success: true,
      post: metadataResult.post,
      contentCID: contentResult.cid,
      metadataCID: metadataResult.metadataCID,
      contentUrl: contentResult.url,
    };

  } catch (error) {
    console.error('Failed to publish post:', error);
    throw error;
  }
}

/**
 * Check API health
 */
export async function checkHealth() {
  try {
    const response = await apiRequest('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'unhealthy' };
  }
}

export default {
  getMetadata,
  getContent,
  uploadContent,
  uploadMetadata,
  uploadMedia,
  publishPost,
  checkHealth,
};