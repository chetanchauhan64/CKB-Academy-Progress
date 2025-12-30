import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate required environment variables on server startup
 */
export function validateEnvironment() {
  const required = [
    'CKBFS_GATEWAY_URL',
    'PORT'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n💡 Please check your .env file\n');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

export const config = {
  port: process.env.PORT || 3001,
  ckbfs: {
    gatewayUrl: process.env.CKBFS_GATEWAY_URL,
    apiKey: process.env.CKBFS_API_KEY || '',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
  env: process.env.NODE_ENV || 'development',
};