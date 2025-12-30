import express from 'express';
import multer from 'multer';
import { uploadContent, fetchContent, uploadMetadata, formatBytes } from '../services/ckbfsService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Configure multer for memory storage (no disk writes)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * POST /api/upload/content
 * Upload blog post content to CKBFS
 * 
 * Body: { content: string, title?: string }
 * Returns: { success: true, cid, size, url }
 */
router.post('/upload/content', async (req, res, next) => {
  try {
    const { content, title } = req.body;

    if (!content) {
      throw new AppError('Content is required', 400);
    }

    console.log(`📤 Uploading content${title ? `: "${title}"` : ''}...`);

    const result = await uploadContent(content);

    console.log(`✅ Content uploaded: ${result.cid}`);

    res.json({
      success: true,
      data: {
        cid: result.cid,
        size: result.size,
        sizeFormatted: formatBytes(result.size),
        url: result.url,
        uploadedAt: result.uploadedAt,
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/upload/metadata
 * Store blog post metadata
 * 
 * Body: { title, author, contentCID, excerpt, tags }
 * Returns: { success: true, post, metadataCID }
 */
router.post('/upload/metadata', async (req, res, next) => {
  try {
    const { title, author, contentCID, excerpt, tags } = req.body;

    // Validate required fields
    if (!title || !author || !contentCID) {
      throw new AppError('Title, author, and contentCID are required', 400);
    }

    console.log(`📚 Creating metadata for: "${title}"`);

    const post = {
      id: Date.now().toString(),
      cid: contentCID,
      title,
      author,
      timestamp: new Date().toISOString(),
      excerpt: excerpt || '',
      tags: tags || [],
    };

    // Upload metadata to CKBFS
    const result = await uploadMetadata(post);

    console.log(`✅ Metadata uploaded: ${result.cid}`);

    res.json({
      success: true,
      data: {
        post,
        metadataCID: result.cid,
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/content/:cid
 * Fetch content from CKBFS by CID
 * 
 * Returns: { success: true, content, cid }
 */
router.get('/content/:cid', async (req, res, next) => {
  try {
    const { cid } = req.params;

    if (!cid) {
      throw new AppError('CID is required', 400);
    }

    console.log(`📥 Fetching content: ${cid}`);

    const content = await fetchContent(cid);

    console.log(`✅ Content retrieved (${formatBytes(content.length)})`);

    res.json({
      success: true,
      data: {
        cid,
        content: content.toString('utf-8'),
        size: content.length,
        sizeFormatted: formatBytes(content.length),
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/upload/media
 * Upload image/media to CKBFS
 * 
 * Form data: file
 * Returns: { success: true, cid, url, format }
 */
router.post('/upload/media', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const { originalname, mimetype, buffer, size } = req.file;

    console.log(`🖼️  Uploading media: ${originalname} (${formatBytes(size)})`);

    const result = await uploadContent(buffer);

    console.log(`✅ Media uploaded: ${result.cid}`);

    res.json({
      success: true,
      data: {
        cid: result.cid,
        filename: originalname,
        mimetype,
        size,
        sizeFormatted: formatBytes(size),
        url: result.url,
        uploadedAt: result.uploadedAt,
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'CKBFS Blog API',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;