import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Generate a CID-like identifier from content
 * 
 * In production: This would use the actual CKBFS SDK
 * For now: Generate a realistic CID using SHA-256
 * 
 * CID Format: CIDv1 = base32(multibase) + version + codec + multihash
 * We simulate: bafkrei + sha256_hash (50 chars)
 */
export function generateCID(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const hash = createHash('sha256').update(buffer).digest('hex');
  
  // Simulate IPFS/CKBFS CIDv1 format
  // 'bafkrei' prefix for raw leaves in CIDv1
  return `bafkrei${hash.substring(0, 50)}`;
}

/**
 * Read file safely with proper error handling
 */
export async function readFileSafe(filepath) {
  try {
    if (!existsSync(filepath)) {
      throw new Error(`File not found: ${filepath}`);
    }
    return await readFile(filepath);
  } catch (error) {
    throw new Error(`Failed to read file ${filepath}: ${error.message}`);
  }
}

/**
 * Write file safely, creating directories if needed
 */
export async function writeFileSafe(filepath, content) {
  try {
    const dir = filepath.substring(0, filepath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(filepath, content);
  } catch (error) {
    throw new Error(`Failed to write file ${filepath}: ${error.message}`);
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

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Simulate CKBFS upload with delay
 */
export async function simulateUpload(sizeBytes) {
  // Simulate network delay based on file size
  const delayMs = Math.min(2000, 500 + (sizeBytes / 1000));
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Console log with emoji styling
 */
export const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
  upload: (msg) => console.log(`📤 ${msg}`),
  download: (msg) => console.log(`📥 ${msg}`),
  file: (msg) => console.log(`📝 ${msg}`),
  hash: (msg) => console.log(`🔑 ${msg}`),
  network: (msg) => console.log(`🌐 ${msg}`),
};
