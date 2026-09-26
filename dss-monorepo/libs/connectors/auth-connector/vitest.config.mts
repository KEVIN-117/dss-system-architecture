import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@dss-monorepo/auth-connector',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
