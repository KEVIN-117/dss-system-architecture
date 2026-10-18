import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: '@dss-monorepo/ml-connector',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
