const path = require('node:path');

/**
 * Shared settings for producing standalone servers from the Nx workspace root.
 * Next.js otherwise traces only inside each application's directory.
 */
module.exports = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
};
