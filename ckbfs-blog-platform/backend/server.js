import express from 'express';
import cors from 'cors';
import { validateEnvironment, config } from './middleware/validateEnv.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import blogRoutes from './routes/blogRoutes.js';

/**
 * CKBFS Blog Platform - Express API Server
 * 
 * This server provides REST endpoints for the frontend to interact
 * with CKBFS (CKB File System) for decentralized blog content storage.
 */

// Validate environment variables before starting
validateEnvironment();

const app = express();

// Middleware
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', blogRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CKBFS Blog API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      uploadContent: 'POST /api/upload/content',
      uploadMetadata: 'POST /api/upload/metadata',
      uploadMedia: 'POST /api/upload/media',
      fetchContent: 'GET /api/content/:cid',
    },
    documentation: 'https://github.com/yourrepo/ckbfs-blog-platform',
  });
});

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 CKBFS Blog API Server');
  console.log('='.repeat(50));
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`📍 Local:   http://localhost:${PORT}`);
  console.log(`🌐 CKBFS:   ${config.ckbfs.gatewayUrl}`);
  console.log(`🔧 Mode:    ${config.env}`);
  console.log('\n📚 Available endpoints:');
  console.log(`   GET  /api/health`);
  console.log(`   POST /api/upload/content`);
  console.log(`   POST /api/upload/metadata`);
  console.log(`   POST /api/upload/media`);
  console.log(`   GET  /api/content/:cid`);
  console.log('\n' + '='.repeat(50) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;