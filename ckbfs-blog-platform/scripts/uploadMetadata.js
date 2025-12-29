/**
 * Upload Blog Metadata to CKBFS
 * 
 * This script manages blog post metadata:
 * - Stores metadata in CKBFS for decentralized discovery
 * - Maintains local index for quick lookups
 * 
 * Usage: node scripts/uploadMetadata.js
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const { generateCID } = require('./uploadContent');

/**
 * Load existing metadata from local storage
 */
async function loadMetadata() {
  try {
    const data = await fs.readFile(config.storage.metadataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty array
    return [];
  }
}

/**
 * Save metadata to local storage and upload to CKBFS
 * 
 * @param {Array} metadata - Array of blog post metadata
 * @returns {Promise<string>} - CID of the metadata file
 */
async function saveMetadata(metadata) {
  // Save locally for caching
  await fs.writeFile(
    config.storage.metadataFile,
    JSON.stringify(metadata, null, 2)
  );

  // Upload to CKBFS
  const metadataBuffer = Buffer.from(JSON.stringify(metadata));
  const cid = generateCID(metadataBuffer);

  // TODO: Upload to CKBFS
  // await uploadToC KBFS(metadataBuffer);

  console.log(`✅ Metadata saved with CID: ${cid}`);
  return cid;
}

/**
 * Add a new blog post to metadata
 * 
 * @param {object} postData - Blog post information
 * @param {string} postData.title - Post title
 * @param {string} postData.author - Author name
 * @param {string} postData.contentCID - CID of post content
 * @param {string} postData.excerpt - Post excerpt
 * @param {Array<string>} postData.tags - Post tags
 */
async function addPost(postData) {
  const metadata = await loadMetadata();

  const newPost = {
    id: String(metadata.length + 1),
    cid: postData.contentCID,
    title: postData.title,
    author: postData.author,
    timestamp: new Date().toISOString(),
    excerpt: postData.excerpt,
    tags: postData.tags || []
  };

  metadata.unshift(newPost); // Add to beginning
  const metadataCID = await saveMetadata(metadata);

  console.log(`\n✅ Blog post added successfully!`);
  console.log(`📝 Post ID: ${newPost.id}`);
  console.log(`🔑 Content CID: ${newPost.cid}`);
  console.log(`📚 Metadata CID: ${metadataCID}`);

  return { post: newPost, metadataCID };
}

// CLI Interface
if (require.main === module) {
  const examplePost = {
    title: 'Getting Started with CKBFS',
    author: 'Dev Team',
    contentCID: 'bafkreiexample1234567890abcdefghijklmnopqrstuvwxyz',
    excerpt: 'Learn how to build decentralized applications with CKBFS...',
    tags: ['Tutorial', 'CKBFS', 'Getting Started']
  };

  addPost(examplePost)
    .then(result => {
      console.log('\n📊 Result:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Failed to add post:', error);
      process.exit(1);
    });
}

module.exports = { addPost, loadMetadata, saveMetadata };