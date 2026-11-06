/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Privy Solana deps must stay external on the server only — see Privy
    // docs "Solana dependencies" (webpack; skip for Turbopack).
    // Applying this to client builds breaks chunk loading (app/layout.js).
    if (isServer) {
      config.externals = config.externals || {};
      if (!Array.isArray(config.externals)) {
        config.externals['@solana/kit'] = 'commonjs @solana/kit';
        config.externals['@solana-program/memo'] = 'commonjs @solana-program/memo';
        config.externals['@solana-program/system'] = 'commonjs @solana-program/system';
        config.externals['@solana-program/token'] = 'commonjs @solana-program/token';
      }
    }
    return config;
  },
};

module.exports = nextConfig;
