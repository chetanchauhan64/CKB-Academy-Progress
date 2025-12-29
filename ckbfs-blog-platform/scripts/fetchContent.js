/**
 * Fetch Content from CKBFS by CID
 * 
 * This script retrieves blog content from CKBFS using its CID.
 * 
 * Usage: node scripts/fetchContent.js <cid>
 */

const config = require('./config');

/**
 * Fetch content from CKBFS by CID
 * 
 * @param {string} cid - Content Identifier
 * @returns {Promise<Buffer>} - Content data
 */
async function fetchFromCKBFS(cid) {
  try {
    console.log(`📥 Fetching content with CID: ${cid}`);

    // TODO: Replace with actual CKBFS fetch
    // const response = await fetch(`${config.ckbfs.gatewayUrl}/${cid}`);
    // const content = await response.arrayBuffer();
    // return Buffer.from(content);

    console.log(`✅ Content fetched successfully!`);
    
    // Mock response
    return Buffer.from('Mock content from CKBFS');

  } catch (error) {
    console.error(`❌ Fetch failed: ${error.message}`);
    throw error;
  }
}

// CLI Interface
if (require.main === module) {
  const cid = process.argv[2];
  
  if (!cid) {
    console.error('Usage: node fetchContent.js <cid>');
    process.exit(1);
  }

  fetchFromCKBFS(cid)
    .then(content => {
      console.log('\n📄 Content:');
      console.log(content.toString());
    })
    .catch(error => {
      console.error('Fetch failed:', error);
      process.exit(1);
    });
}

module.exports = { fetchFromCKBFS };