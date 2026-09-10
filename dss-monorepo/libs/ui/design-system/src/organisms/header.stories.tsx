import type { Meta, StoryObj } from '@storybook/react-vite';
import { Header } from './header';

const meta: Meta<typeof Header> = {
  title: 'Organisms/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#09090b' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background">
        <Story />
        <div className="p-8 text-primary/50 text-sm">
          Content area below header...
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  args: {
    user: {
      name: 'Neo Anderson',
      email: 'neo@matrix.sys',
      avatarUrl: 'https://github.com/shadcn.png',
    },
    onMenuClick: () => console.log('Menu clicked'),
    onSearch: (q) => console.log('Searching:', q),
    onDisconnect: () => console.log('Disconnecting...'),
  },
};

export const Guest: Story = {
  args: {
    onMenuClick: () => console.log('Menu clicked'),
    onSearch: (q) => console.log('Searching:', q),
  },
};

export const CyberpunkTerminal: Story = {
  args: {
    user: {
      name: 'Case',
      email: 'case@sprawl.net',
    },
    onMenuClick: () => console.log('Menu clicked'),
    onSearch: (q) => console.log('Searching:', q),
  },
  parameters: {
    // Customization specific to this story could go here
  },
};
