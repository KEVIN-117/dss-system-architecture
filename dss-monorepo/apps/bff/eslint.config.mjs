import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react-typescript'],
  {
    ignores: ['.next/**/*', '**/out-tsc'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@dss-monorepo/auth',
              message: 'The BFF must use @dss-monorepo/auth-connector and auth-models.',
            },
            {
              name: '@dss-monorepo/rbac',
              message: 'The BFF may only use the server-safe @dss-monorepo/rbac/server entry point.',
            },
          ],
        },
      ],
    },
  },
];
