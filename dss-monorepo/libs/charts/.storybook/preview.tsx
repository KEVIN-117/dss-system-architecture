import type { Preview } from '@storybook/react-vite';
import '@dss-monorepo/design-system/styles/globals.css';

const preview: Preview = {
  tags: ['autodocs'],
  initialGlobals: { theme: 'admin', colorMode: 'light' },
  globalTypes: {
    theme: {
      description: 'Ámbito del DSS',
      toolbar: {
        title: 'Ámbito',
        items: ['admin', 'rector', 'decano', 'director'],
        dynamicTitle: true,
      },
    },
    colorMode: {
      description: 'Modo de color',
      toolbar: {
        title: 'Modo',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, { globals }) => (
      <div
        data-theme={globals.theme}
        className={globals.colorMode === 'dark' ? 'dark' : ''}
        style={{
          padding: 24,
          minHeight: '100vh',
          background: 'var(--background)',
          color: 'var(--foreground)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <Story />
      </div>
    ),
  ],
};
export default preview;
