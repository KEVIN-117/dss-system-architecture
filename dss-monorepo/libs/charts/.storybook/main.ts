import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { StorybookConfig } from '@storybook/react-vite';

const storybookDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(storybookDirectory, '../../..');
const designSystemStyles = resolve(
  workspaceRoot,
  'libs/ui/design-system/src/styles/globals.css',
);

const config: StorybookConfig = {
  stories: ['../src/lib/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  addons: [getAbsolutePath('@storybook/addon-docs')],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {
      builder: {
        viteConfigPath: 'vite.config.mts',
      },
    },
  },
  async viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@dss-monorepo/design-system/styles/globals.css': designSystemStyles,
    };
    config.server ??= {};
    config.server.fs ??= {};
    config.server.fs.allow = [
      ...(config.server.fs.allow ?? []),
      workspaceRoot,
    ];
    // Playwright writes screenshots and traces below this package. Without
    // ignoring them, Vite reloads the preview while the browser suite runs.
    config.server.watch = {
      ...config.server.watch,
      ignored: ['**/test-output/**', '**/storybook-static/**'],
    };
    return config;
  },
};

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
