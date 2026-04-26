import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Keep heavy Lumos packages server-side only (not bundled into browser JS)
  serverExternalPackages: ['@ckb-lumos/lumos', '@ckb-lumos/base', '@ckb-lumos/hd', '@ckb-lumos/codec'],

  // ── Turbopack config (Next.js 16 default bundler) ──────────────────────────
  turbopack: {
    // Pin workspace root to THIS directory so Next.js doesn't accidentally pick
    // up the monorepo root lockfile at /Users/chetan/package-lock.json
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
