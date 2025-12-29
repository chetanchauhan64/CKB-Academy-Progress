/**
 * CKBFS Configuration
 * 
 * This file contains configuration for connecting to the Nervos CKB network
 * and CKBFS service endpoints.
 */

require('dotenv').config();

module.exports = {
  // CKB Node Configuration
  ckb: {
    nodeUrl: process.env.CKB_NODE_URL || 'http://localhost:8114',
    indexerUrl: process.env.CKB_INDEXER_URL || 'http://localhost:8116',
  },

  // CKBFS Configuration
  ckbfs: {
    gatewayUrl: process.env.CKBFS_GATEWAY_URL || 'https://ckbfs.dev',
    apiKey: process.env.CKBFS_API_KEY || '',
  },

  // Storage Configuration
  storage: {
    contentDir: './content/posts',
    mediaDir: './content/media',
    metadataFile: './content/metadata.json'
  }
};