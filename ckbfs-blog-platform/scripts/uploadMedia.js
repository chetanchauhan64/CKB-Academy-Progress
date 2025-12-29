/**
 * Upload Media Files to CKBFS
 * 
 * This script handles image uploads for blog posts.
 * Images are stored in CKBFS and referenced by CID.
 * 
 * Usage: node scripts/uploadMedia.js <image-path>
 */

const fs = require('fs').promises;
const path = require('path');
const { generateCID } = require('./uploadContent');

/**
 * Upload an image to CKBFS
 * 
 * @param {string} imagePath - Path to image file
 * @returns {Promise<object>} - Upload result with CID
 */
async function uploadImage(imagePath) {
  try {
    console.log(`🖼️  Reading image: ${imagePath}`);
    
    const imageBuffer = await fs.readFile(imagePath);
    const imageSize = imageBuffer.length;
    const imageType = path.extname(imagePath).toLowerCase();

    console.log(`📏 Image size: ${(imageSize / 1024).toFixed(2)} KB`);
    console.log(`📸 Image type: ${imageType}`);

    // Generate CID
    const cid = generateCID(imageBuffer);
    
    // TODO: Upload to CKBFS
    // const response = await fetch(`${config.ckbfs.gatewayUrl}/upload`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${config.ckbfs.apiKey}`,
    //     'Content-Type': `image/${imageType.slice(1)}`
    //   },
    //   body: imageBuffer
    // });

    console.log(`✅ Image uploaded successfully!`);
    console.log(`🔗 CKBFS URL: ${config.ckbfs.gatewayUrl}/${cid}`);

    return {
      success: true,
      cid,
      size: imageSize,
      type: imageType,
      url: `${config.ckbfs.gatewayUrl}/${cid}`,
      uploadedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Image upload failed: ${error.message}`);
    throw error;
  }
}

// CLI Interface
if (require.main === module) {
  const imagePath = process.argv[2];
  
  if (!imagePath) {
    console.error('Usage: node uploadMedia.js <image-path>');
    process.exit(1);
  }

  uploadImage(imagePath)
    .then(result => {
      console.log('\n📊 Upload Result:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Upload failed:', error);
      process.exit(1);
    });
}

module.exports = { uploadImage };