const sharedNextConfig = require('../../next.config.shared');

module.exports = {
  ...sharedNextConfig,
  turbopack: {},
  transpilePackages: [
    '@dss-monorepo/auth-connector',
    '@dss-monorepo/auth-models',
    '@dss-monorepo/dw-control-connector',
    '@dss-monorepo/ml-connector',
    '@dss-monorepo/olap-connector',
    '@dss-monorepo/rbac-server',
  ],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

