import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Validate required environment variables
const requiredEnvVars = ['CKBFS_GATEWAY_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n💡 Please create a .env file based on .env.example');
  process.exit(1);
}

const config = {
  // CKBFS Configuration
  ckbfs: {
    gatewayUrl: process.env.CKBFS_GATEWAY_URL,
    apiKey: process.env.CKBFS_API_KEY || '',
  },

  // CKB Node Configuration (for future use)
  ckb: {
    nodeUrl: process.env.CKB_NODE_URL || 'http://localhost:8114',
    indexerUrl: process.env.CKB_INDEXER_URL || 'http://localhost:8116',
  },

  // Storage Paths
  paths: {
    root: PROJECT_ROOT,
    content: join(PROJECT_ROOT, 'content'),
    posts: join(PROJECT_ROOT, 'content', 'posts'),
    media: join(PROJECT_ROOT, 'content', 'media'),
    metadata: join(PROJECT_ROOT, 'content', 'metadata.json'),
  },

  // Environment
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
};

export default config;
