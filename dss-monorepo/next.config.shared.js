const path = require('node:path');

/**
 * Shared settings for producing standalone servers from the Nx workspace root.
 * Next.js otherwise traces only inside each application's directory.
 */
module.exports = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  // E2E suites can launch more than one BFF dev server in the same Nx run.
  // Give each suite a separate Next.js output directory to avoid `.next/dev/lock`
  // collisions while keeping the normal `.next` directory for regular builds.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};
