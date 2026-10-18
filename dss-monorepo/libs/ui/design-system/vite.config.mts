import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import tailwindcss from '@tailwindcss/vite';
import * as path from 'path';

const externalPackages = [
  'react',
  'react-dom',
  '@base-ui/react',
  '@dss-monorepo/dashboard-engine',
  '@dss-monorepo/olap-models',
  '@fontsource-variable/geist',
  '@monaco-editor/react',
  '@xyflow/react',
  'class-variance-authority',
  'cn',
  'date-fns',
  'lucide-react',
  'next-themes',
  'radix-ui',
  'react-day-picker',
  'react-grid-layout',
  'react-resizable',
  'shadcn',
  'sonner',
  'tw-animate-css',
];

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/ui/design-system',
  plugins: [
    react(),
    tailwindcss(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  // Configuration for building your library.
  // See: https://vite.dev/guide/build.html#library-mode
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: '@dss-monorepo/design-system',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const],
    },
    rolldownOptions: {
      // External packages that should not be bundled into your library.
      // Keeping the UI dependencies external also prevents Vite/Rolldown from
      // embedding their CommonJS React shims (which use dynamic require()).
      external: (id) => externalPackages.some(
        (packageName) => id === packageName || id.startsWith(`${packageName}/`),
      ),
      output: {
        // Next.js consumes the package as a Client Component boundary. Vite's
        // library output otherwise drops the source directive.
        banner: '"use client";',
      },
    },
  },
}));
