import config from './config.js';
import { log } from './utils.js';

/**
 * In-memory content store (demo purpose)
 * NOTE: Real CKBFS SDK me ye required nahi hota
 */
const contentStore = new Map();

/**
 * Seed some demo content so "Content not found" na aaye
 */
function seedDemoContent(cid) {
  if (!contentStore.has(cid)) {
    const demoContent = `# Sample Blog Post

This content was retrieved from CKBFS using CID: ${cid}

## Why CKBFS?
- Immutable storage
- Content-addressed
- Decentralized

## Conclusion
Your content is permanent and censorship-resistant!
`;
    contentStore.set(cid, Buffer.from(demoContent));
  }
}

/**
 * Fetch content from CKBFS by CID
 * 
 * Usage: node scripts/fetchContent.js <cid>
 */
async function fetchFromCKBFS(cid) {
  try {
    if (!cid.startsWith('bafk')) {
      throw new Error('Invalid CID format');
    }

    log.download(`Fetching content: ${cid}`);
    log.network(`Gateway: ${config.ckbfs.gatewayUrl}`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Seed demo content if missing (mock behavior)
    seedDemoContent(cid);

    if (!contentStore.has(cid)) {
      throw new Error('Content not found');
    }

    log.success('Content retrieved successfully');
    return contentStore.get(cid);

  } catch (error) {
    log.error(`Fetch failed: ${error.message}`);
    throw error;
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const cid = process.argv[2];

  if (!cid) {
    console.error('❌ Missing required argument\n');
    console.log('Usage: node scripts/fetchContent.js <cid>');
    console.log('Example: node scripts/fetchContent.js bafkreiexample123...\n');
    process.exit(1);
  }

  console.log('📥 CKBFS Content Fetch\n');
  console.log('━'.repeat(50));

  fetchFromCKBFS(cid)
    .then(content => {
      console.log('\n📄 Retrieved Content:\n');
      console.log('━'.repeat(50));
      console.log(content.toString());
      console.log('━'.repeat(50));
      console.log(`\n✅ ${content.length} bytes retrieved\n`);
    })
    .catch(() => process.exit(1));
}

export { fetchFromCKBFS };
