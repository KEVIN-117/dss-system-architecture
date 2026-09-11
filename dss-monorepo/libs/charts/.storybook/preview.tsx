import type { Preview } from '@storybook/react-vite';
import '../src/styles/tokens.css';
import '../src/styles/tailwind.css';
import React from 'react';

const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    theme: {
      description: 'Paleta funcional del DSS',
      defaultValue: 'admin',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'admin', title: 'Admin' },
          { value: 'rector', title: 'Rector' },
          { value: 'decano', title: 'Decano' },
          { value: 'director', title: 'Director' },
        ],
        dynamicTitle: true,
      },
    },
    colorMode: {
      description: 'Modo Claro / Oscuro',
      defaultValue: 'dark',
      toolbar: {
        title: 'Mode',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'admin';
      const colorMode = context.globals.colorMode || 'dark';
      const isDark = colorMode === 'dark';

      React.useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
          root.classList.add('dark');
          root.setAttribute('data-theme', 'dark');
        } else {
          root.classList.remove('dark');
          root.removeAttribute('data-theme');
        }
      }, [isDark, theme]);

      return (
        <div
          style={{
            padding: '1.5rem',
            minHeight: '100vh',
            backgroundColor: 'hsl(var(--bg))',
            color: 'hsl(var(--fg))',
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
