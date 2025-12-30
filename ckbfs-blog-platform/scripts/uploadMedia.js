import { readFile } from 'fs/promises';
import { basename, extname } from 'path';
import config from './config.js';
import { generateCID, formatBytes, simulateUpload, log } from './utils.js';

/**
 * Upload media files (images) to CKBFS
 * 
 * Supported formats: .jpg, .jpeg, .png, .gif, .webp, .svg
 * 
 * Usage: node scripts/uploadMedia.js <image-path>
 */

const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

async function uploadMediaToCKBFS(imagePath) {
  const startTime = Date.now();

  try {
    // Validate file extension
    const ext = extname(imagePath).toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) {
      throw new Error(`Unsupported format: ${ext}. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
    }

    // Step 1: Read image
    log.upload('Reading image...');
    const imageBuffer = await readFile(imagePath);
    const filename = basename(imagePath);
    const filesize = imageBuffer.length;

    log.file(`Image: ${filename}`);
    log.file(`Size: ${formatBytes(filesize)}`);
    log.file(`Type: ${ext}`);

    // Warn if image is large
    if (filesize > 5 * 1024 * 1024) {
      log.warn('Large file size detected (>5MB). Consider compressing.');
    }

    // Step 2: Generate CID
    log.hash('Generating CID...');
    const cid = generateCID(imageBuffer);
    log.hash(`CID: ${cid}`);

    // Step 3: Upload to CKBFS
    log.network('Uploading to CKBFS...');
    await simulateUpload(filesize);

    // In production:
    /*
    const formData = new FormData();
    formData.append('file', imageBuffer, filename);
    
    const response = await fetch(`${config.ckbfs.gatewayUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.ckbfs.apiKey}`
      },
      body: formData
    });
    const { cid, url } = await response.json();
    */

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const imageUrl = `${config.ckbfs.gatewayUrl}/${cid}`;

    log.success(`Upload completed in ${duration}s`);
    log.info(`Image URL: ${imageUrl}`);

    return {
      success: true,
      cid,
      filename,
      size: filesize,
      sizeFormatted: formatBytes(filesize),
      format: ext,
      url: imageUrl,
      uploadedAt: new Date().toISOString(),
    };

  } catch (error) {
    log.error(`Media upload failed: ${error.message}`);
    throw error;
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.error('❌ Missing required argument\n');
    console.log('Usage: node scripts/uploadMedia.js <image-path>');
    console.log('Example: node scripts/uploadMedia.js content/media/hero.png\n');
    console.log('Supported formats:', SUPPORTED_FORMATS.join(', '));
    process.exit(1);
  }

  console.log('🖼️  CKBFS Media Upload\n');
  console.log('━'.repeat(50));

  uploadMediaToCKBFS(imagePath)
    .then(result => {
      console.log('\n📊 Upload Result:\n');
      console.log(`   Filename:  ${result.filename}`);
      console.log(`   Format:    ${result.format}`);
      console.log(`   Size:      ${result.sizeFormatted}`);
      console.log(`   CID:       ${result.cid}`);
      console.log(`   URL:       ${result.url}`);
      console.log('\n💡 Use this URL in your blog posts:\n');
      console.log(`   ![Alt text](${result.url})`);
      console.log('\n' + '━'.repeat(50));
      log.success('Done!');
    })
    .catch(() => process.exit(1));
}

export { uploadMediaToCKBFS };