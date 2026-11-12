import createMDX from '@next/mdx';
import sharedConfig from '../../next.config.shared.js';

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    // GitHub-flavoured Markdown: tables, task lists and autolinks in guides.
    remarkPlugins: ['remark-gfm'],
  },
});

export default withMDX({
  ...sharedConfig,
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  async redirects() {
    return [{ source: '/docs/administracion', destination: '/docs/guia-portal-administracion', permanent: true }];
  },
  // The API catalog and the search index read these files with `fs` at request
  // time. Next.js cannot trace dynamic reads, so they are copied explicitly into
  // the standalone output used by the Docker image.
  outputFileTracingIncludes: {
    '/**': ['./openapi/**/*.yaml', './src/content/**/*.mdx'],
  },
});
