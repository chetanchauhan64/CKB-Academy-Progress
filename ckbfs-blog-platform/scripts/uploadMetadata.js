import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import config from './config.js';
import { generateCID, simulateUpload, log } from './utils.js';

/**
 * Manage blog metadata
 * 
 * Metadata structure:
 * - Stores array of blog posts with their CIDs
 * - Cached locally in content/metadata.json
 * - Uploaded to CKBFS for decentralized discovery
 */

async function loadMetadata() {
  try {
    if (!existsSync(config.paths.metadata)) {
      log.warn('No existing metadata found, creating new file');
      return [];
    }
    
    const data = await readFile(config.paths.metadata, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    log.error(`Failed to load metadata: ${error.message}`);
    return [];
  }
}

async function saveMetadata(metadata) {
  try {
    // Save locally
    const metadataJson = JSON.stringify(metadata, null, 2);
    await writeFile(config.paths.metadata, metadataJson);
    
    // Generate CID for CKBFS
    const cid = generateCID(metadataJson);
    
    // Simulate upload to CKBFS
    await simulateUpload(metadataJson.length);
    
    log.success(`Metadata saved (CID: ${cid})`);
    return cid;
  } catch (error) {
    log.error(`Failed to save metadata: ${error.message}`);
    throw error;
  }
}

async function addPost(postData) {
  try {
    console.log('📚 Adding post to metadata\n');
    console.log('━'.repeat(50));

    // Validate required fields
    const required = ['title', 'author', 'contentCID', 'excerpt'];
    const missing = required.filter(field => !postData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Load existing metadata
    log.info('Loading existing metadata...');
    const metadata = await loadMetadata();

    // Create new post entry
    const newPost = {
      id: String(metadata.length + 1),
      cid: postData.contentCID,
      title: postData.title,
      author: postData.author,
      timestamp: new Date().toISOString(),
      excerpt: postData.excerpt.substring(0, 200),
      tags: postData.tags || [],
    };

    log.info(`Creating entry for: "${newPost.title}"`);

    // Add to beginning of array (newest first)
    metadata.unshift(newPost);

    // Save updated metadata
    log.upload('Uploading metadata to CKBFS...');
    const metadataCID = await saveMetadata(metadata);

    console.log('\n📊 Post Added:\n');
    console.log(`   ID:        ${newPost.id}`);
    console.log(`   Title:     ${newPost.title}`);
    console.log(`   Author:    ${newPost.author}`);
    console.log(`   CID:       ${newPost.cid}`);
    console.log(`   Meta CID:  ${metadataCID}`);
    console.log('\n' + '━'.repeat(50));
    log.success('Post added to metadata!');

    return { post: newPost, metadataCID };

  } catch (error) {
    log.error(`Failed to add post: ${error.message}`);
    throw error;
  }
}

async function listPosts() {
  try {
    const metadata = await loadMetadata();
    
    console.log('\n📚 Blog Posts\n');
    console.log('━'.repeat(80));
    
    if (metadata.length === 0) {
      console.log('   No posts found');
    } else {
      metadata.forEach((post, index) => {
        console.log(`\n${index + 1}. ${post.title}`);
        console.log(`   Author: ${post.author}`);
        console.log(`   CID: ${post.cid}`);
        console.log(`   Date: ${new Date(post.timestamp).toLocaleDateString()}`);
        console.log(`   Tags: ${post.tags.join(', ') || 'None'}`);
      });
    }
    
    console.log('\n' + '━'.repeat(80));
    console.log(`Total: ${metadata.length} posts\n`);
    
    return metadata;
  } catch (error) {
    log.error(`Failed to list posts: ${error.message}`);
    throw error;
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2];

  if (action === 'list') {
    listPosts().catch(() => process.exit(1));
  } else if (action === 'add') {
    // Example post data
    const examplePost = {
      title: 'Getting Started with CKBFS',
      author: 'Development Team',
      contentCID: 'bafkreiexample1234567890abcdefghijklmnopqrstuvwxyz',
      excerpt: 'Learn how to build decentralized applications with CKBFS and Nervos CKB...',
      tags: ['Tutorial', 'CKBFS', 'Web3'],
    };

    addPost(examplePost).catch(() => process.exit(1));
  } else {
    console.log('Usage:');
    console.log('  node scripts/uploadMetadata.js list    - List all posts');
    console.log('  node scripts/uploadMetadata.js add     - Add example post');
    process.exit(1);
  }
}

export { addPost, loadMetadata, saveMetadata, listPosts };