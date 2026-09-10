import type { Preview } from '@storybook/react-vite';
import '../../ui/design-system/src/styles/globals.css';
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
            }
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
            }
        }
    },
    decorators: [
        (Story, context) => {
            const theme = context.globals.theme || 'admin';
            const colorMode = context.globals.colorMode || 'dark';
            const isDark = colorMode === 'dark';
            
            // We need to inject the classes directly onto the <html> tag for our ECharts MutationObserver to pick it up properly.
            // But doing it here also works if the observer is looking at documentElement.
            React.useEffect(() => {
                if (isDark) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
                document.documentElement.setAttribute('data-theme', theme);
            }, [isDark, theme]);

            return (
                <div className={`p-6 bg-background text-foreground min-h-screen ${isDark ? 'dark' : ''}`} data-theme={theme}>
                    <Story />
                </div>
            )
        }
    ]
}

export default preview;
