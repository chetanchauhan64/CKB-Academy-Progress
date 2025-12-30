import { readFile } from 'fs/promises';
import { basename } from 'path';
import config from './config.js';
import { generateCID, formatBytes, simulateUpload, log } from './utils.js';

/**
 * Upload blog post content to CKBFS
 * 
 * This script:
 * 1. Reads a markdown file from disk
 * 2. Generates a content-addressed CID
 * 3. Simulates upload to CKBFS
 * 4. Returns CID for metadata storage
 * 
 * Usage: node scripts/uploadContent.js <filepath>
 * Example: node scripts/uploadContent.js content/posts/my-post.md
 */

async function uploadContentToCKBFS(filepath) {
  const startTime = Date.now();

  try {
    // Step 1: Read file
    log.upload('Reading file...');
    const content = await readFile(filepath);
    const filename = basename(filepath);
    const filesize = content.length;

    log.file(`File: ${filename}`);
    log.file(`Size: ${formatBytes(filesize)}`);

    // Step 2: Generate CID
    log.hash('Generating CID...');
    const cid = generateCID(content);
    contentStore.set(cid, content);
    log.hash(`CID: ${cid}`);

    // Step 3: Simulate CKBFS upload
    log.network('Uploading to CKBFS...');
    await simulateUpload(filesize);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log.success(`Upload completed in ${duration}s`);
    log.info(`Retrieve at: ${config.ckbfs.gatewayUrl}/${cid}`);

    return {
      success: true,
      cid,
      filename,
      size: filesize,
      sizeFormatted: formatBytes(filesize),
      filepath,
      uploadedAt: new Date().toISOString(),
      retrieveUrl: `${config.ckbfs.gatewayUrl}/${cid}`,
    };

  } catch (error) {
    log.error(`Upload failed: ${error.message}`);
    throw error;
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const filepath = process.argv[2];

  if (!filepath) {
    console.error('❌ Missing required argument\n');
    console.log('Usage: node scripts/uploadContent.js <filepath>');
    console.log('Example: node scripts/uploadContent.js content/posts/test.md\n');
    process.exit(1);
  }

  console.log('🚀 CKBFS Content Upload\n');
  console.log('━'.repeat(50));

  uploadContentToCKBFS(filepath)
    .then(result => {
      console.log('\n📊 Upload Result:\n');
      console.log(`   Filename:  ${result.filename}`);
      console.log(`   Size:      ${result.sizeFormatted}`);
      console.log(`   CID:       ${result.cid}`);
      console.log(`   URL:       ${result.retrieveUrl}`);
      console.log(`   Timestamp: ${result.uploadedAt}`);
      console.log('\n' + '━'.repeat(50));
      console.log('✅ Done!\n');
    })
    .catch(() => {
      console.error('\n' + '━'.repeat(50));
      console.error('❌ Upload failed\n');
      process.exit(1);
    });
}

export { uploadContentToCKBFS };
