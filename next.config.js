/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Short MCP URLs: https://<site>/mcp/... proxies to the Lambda endpoint.
    // Destination is build-time env with the current Lambda URL as fallback —
    // if the backend redeploys with a new URL, update NEXT_PUBLIC_MCP_BASE_URL.
    const dest =
      (process.env.NEXT_PUBLIC_MCP_BASE_URL ?? '').replace(/\/$/, '') ||
      'https://xh5gkive4e43mnzdlwdcavshvq0lnmhd.lambda-url.ap-southeast-1.on.aws';
    return [{ source: '/mcp/:path*', destination: `${dest}/mcp/:path*` }];
  },
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
