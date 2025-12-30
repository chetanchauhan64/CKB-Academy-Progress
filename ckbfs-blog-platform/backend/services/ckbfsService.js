// Temporary in-memory store (demo purpose)
const contentStore = new Map();

import { createHash } from 'crypto';
import { config } from '../middleware/validateEnv.js';

/**
 * CKBFS Service
 * 
 * Handles all interactions with CKBFS (CKB File System)
 * Reuses core logic from scripts/ folder
 */

/**
 * Generate a CID-like identifier from content
 * Simulates IPFS/CKBFS CIDv1 format
 */
function generateCID(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const hash = createHash('sha256').update(buffer).digest('hex');
  return `bafkrei${hash.substring(0, 50)}`;
}

/**
 * Simulate network delay based on content size
 */
async function simulateUpload(sizeBytes) {
  const delayMs = Math.min(2000, 500 + (sizeBytes / 1000));
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Upload content to CKBFS
 * 
 * @param {string|Buffer} content - Content to upload
 * @returns {Promise<object>} Upload result with CID
 */
export async function uploadContent(content) {
  try {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const size = buffer.length;

    // Generate CID
    const cid = generateCID(buffer);

    // Simulate CKBFS upload
    await simulateUpload(size);

    // In production, replace with:
    /*
    const response = await fetch(`${config.ckbfs.gatewayUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.ckbfs.apiKey}`,
        'Content-Type': 'application/octet-stream'
      },
      body: buffer
    });
    
    if (!response.ok) {
      throw new Error(`CKBFS upload failed: ${response.statusText}`);
    }
    
    const { cid } = await response.json();
    */

    return {
      success: true,
      cid,
      size,
      url: `${config.ckbfs.gatewayUrl}/${cid}`,
      uploadedAt: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(`Failed to upload to CKBFS: ${error.message}`);
  }
}

/**
 * Fetch content from CKBFS by CID
 * 
 * @param {string} cid - Content Identifier
 * @returns {Promise<Buffer>} Content data
 */
export async function fetchContent(cid) {
  try {
    // Validate CID format
    if (!cid || !cid.startsWith('bafkrei')) {
      throw new Error('Invalid CID format');
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 600));

    // In production, replace with:
    /*
    const response = await fetch(`${config.ckbfs.gatewayUrl}/${cid}`, {
      headers: {
        'Authorization': `Bearer ${config.ckbfs.apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Content not found: ${cid}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
    */

    // Mock response with realistic blog content
    const mockContent = {
      'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi': `# Building Decentralized Applications on Nervos CKB

## Introduction

Nervos CKB provides a unique programming model called the Cell Model, which enables true ownership and programmable storage. In this post, we'll explore how CKBFS extends this capability for file storage.

## Why CKBFS?

Traditional cloud storage has significant limitations:
- Centralized control
- Vendor lock-in
- Data can be censored or removed

CKBFS advantages:
- **Immutable**: Content cannot be altered once stored
- **Censorship-resistant**: No single point of failure
- **Content-addressed**: Files identified by cryptographic hash (CID)

## Architecture Example

When you store content in CKBFS, it returns a unique content identifier that can be used to retrieve the data from anywhere in the network.

## Conclusion

CKBFS represents the future of decentralized content delivery. By combining it with CKB's Cell Model, developers can build truly unstoppable applications.`,

      'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku': `# Why CKBFS is a Game-Changer for Content Storage

## The Problem with Centralized Storage

Modern web applications rely on centralized cloud providers like AWS S3, Google Cloud Storage, or Azure Blob Storage. While convenient, these introduce several risks.

## How CKBFS Works

CKBFS stores files as cells on the Nervos blockchain with cryptographic verification and distributed storage.

## Real-World Use Cases

- NFT Metadata storage
- Decentralized blog platforms
- Academic archives
- Legal document storage`,

      'bafkreie5cvv4h4spsj6i3b2nqjrgzfpkqzxhw7jjj2szgqswjsrqkr5yhe': `# Smart Contract Patterns for Scalable Layer 2 Solutions

## Understanding Layer 2 Scaling

Layer 2 solutions process transactions off the main blockchain while inheriting its security guarantees.

## Key Patterns

State channels, optimistic rollups, and zero-knowledge proofs enable massive scalability.`,
    };

    const content = mockContent[cid] || `# Content Retrieved

This content was fetched from CKBFS with CID: ${cid}

The content is immutable and permanently stored on the decentralized network.`;

    return Buffer.from(content);

  } catch (error) {
    console.error('Fetch error:', error);
    throw new Error(`Failed to fetch from CKBFS: ${error.message}`);
  }
}

/**
 * Upload metadata to CKBFS
 * 
 * @param {object} metadata - Metadata object
 * @returns {Promise<object>} Upload result
 */
export async function uploadMetadata(metadata) {
  try {
    const metadataJson = JSON.stringify(metadata);
    const buffer = Buffer.from(metadataJson);

    const result = await uploadContent(buffer);
    
    return {
      ...result,
      metadata,
    };

  } catch (error) {
    console.error('Metadata upload error:', error);
    throw new Error(`Failed to upload metadata: ${error.message}`);
  }
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}