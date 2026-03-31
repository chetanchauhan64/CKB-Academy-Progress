/** @type {import('next').NextConfig} */
const nextConfig = {
  // CKB RPC responses routinely exceed Next.js's 2MB fetch cache limit.
  // Disable the internal fetch cache to prevent "Failed to set Next.js data cache" errors.
  experimental: {
    fetchCache: false,
  },
};

export default nextConfig;

