const sharedNextConfig = require('../../next.config.shared');

module.exports = {
  ...sharedNextConfig,
  transpilePackages: [
    '@dss-monorepo/academic-analytics',
    '@dss-monorepo/auth',
    '@dss-monorepo/charts',
    '@dss-monorepo/design-system',
    '@dss-monorepo/olap-connector',
    '@dss-monorepo/olap-data-access',
    '@dss-monorepo/olap-models',
  ],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};
