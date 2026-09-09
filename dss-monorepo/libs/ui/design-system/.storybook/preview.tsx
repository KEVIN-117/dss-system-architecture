import type { Preview } from '@storybook/react-vite';
import '../src/styles/globals.css';

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

            return (
                <div data-theme={theme} className={`p-6 bg-background text-foreground ${isDark ? 'dark' : ''}`}>
                    <Story />
                </div>
            )
        }
    ]
}


export default preview;