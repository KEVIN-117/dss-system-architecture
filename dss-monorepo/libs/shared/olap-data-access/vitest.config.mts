import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: '@dss-monorepo/olap-data-access',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
