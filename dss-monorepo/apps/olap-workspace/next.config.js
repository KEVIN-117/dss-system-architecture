const sharedNextConfig = require('../../next.config.shared');

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...sharedNextConfig,
  // The browser connector and AuthProvider must use the same BFF origin.
  // Next.js embeds NEXT_PUBLIC variables into client bundles at build time.
  env: {
    ...sharedNextConfig.env,
    ...(process.env.NODE_ENV === 'development' &&
    !process.env.NEXT_PUBLIC_BFF_URL
      ? { NEXT_PUBLIC_BFF_URL: 'http://localhost:3006' }
      : {}),
    ...(process.env.NODE_ENV === 'development'
      ? {
          NEXT_PUBLIC_ADMIN_PORTAL_URL:
            process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || 'http://localhost:3001',
          NEXT_PUBLIC_DECANO_DASHBOARD_URL:
            process.env.NEXT_PUBLIC_DECANO_DASHBOARD_URL ||
            'http://localhost:3002',
          NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL:
            process.env.NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL ||
            'http://localhost:3003',
          NEXT_PUBLIC_RECTOR_DASHBOARD_URL:
            process.env.NEXT_PUBLIC_RECTOR_DASHBOARD_URL ||
            'http://localhost:3004',
        }
      : {}),
  },
  // Compile workspace libraries from their source entrypoints. This keeps Next.js
  // from bundling the design system's all-components distribution barrel during
  // App Router server rendering.
  transpilePackages: [
    '@dss-monorepo/auth',
    '@dss-monorepo/charts',
    '@dss-monorepo/design-system',
    '@dss-monorepo/olap-connector',
    '@dss-monorepo/olap-data-access',
    '@dss-monorepo/olap-models',
  ],
  webpack(config) {
    // Workspace libraries use NodeNext-style `.js` specifiers in TypeScript
    // source. When Next resolves the source condition, map those specifiers
    // back to their TypeScript files during bundling.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

module.exports = nextConfig;
