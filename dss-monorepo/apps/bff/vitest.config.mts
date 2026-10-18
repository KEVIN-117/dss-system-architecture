import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/bff',
  plugins: [react()],
  resolve: {
    alias: {
      '@': join(import.meta.dirname, './src'),
      '@dss-monorepo/auth-connector': join(
        import.meta.dirname,
        '../../libs/connectors/auth-connector/src/index.ts',
      ),
      '@dss-monorepo/ml-connector': join(
        import.meta.dirname,
        '../../libs/connectors/ml-connector/src/index.ts',
      ),
    },
  },
  test: {
    name: '@dss-monorepo/bff',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: [
      '{src,app,pages,specs}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
