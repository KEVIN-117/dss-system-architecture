/** @type {import('next').NextConfig} */
const nextConfig = {
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
