import createMDX from '@next/mdx';
import sharedConfig from '../../next.config.shared.js';

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX({
  ...sharedConfig,
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
});
