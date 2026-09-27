import type { Meta, StoryObj } from '@storybook/react-vite';

import { AccessDenied } from './access-denied';

const meta: Meta<typeof AccessDenied> = {
  title: 'Organisms/AccessDenied',
  component: AccessDenied,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { portalName: 'del rector' },
};

export default meta;
type Story = StoryObj<typeof AccessDenied>;

export const Default: Story = {};

export const WithLogout: Story = {
  args: { logoutHref: '/api/auth/logout' },
};
