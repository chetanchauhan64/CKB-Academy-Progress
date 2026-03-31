/** @type {import('next').NextConfig} */
const nextConfig = {
  // CKB RPC responses routinely exceed Next.js's 2MB fetch cache limit.
  // Set cacheMaxMemorySize to 0 to disable in-memory caching and prevent "Failed to set Next.js data cache" errors.
  cacheMaxMemorySize: 0,
};

export default nextConfig;

