import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@dss-monorepo/auth-models',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
