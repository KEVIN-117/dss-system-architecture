import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { AdminUsers } from './admin-users';
import type { AdminUserRecord } from './types';

const users: AdminUserRecord[] = [
  {
    id: 1,
    username: 'maria.lopez',
    email: 'maria.lopez@uatf.edu.bo',
    roles: ['ROLE_USER', 'ROLE_ADMIN'],
  },
  {
    id: 2,
    username: 'analyst',
    email: 'analyst@uatf.edu.bo',
    roles: ['ROLE_USER'],
  },
];

const meta: Meta<typeof AdminUsers> = {
  title: 'Organisms/Admin/Users',
  component: AdminUsers,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    users,
    onRefresh: fn(),
    onCreate: fn(),
    onUpdate: fn(),
    onDelete: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof AdminUsers>;

export const Directory: Story = {};
export const Loading: Story = { args: { loading: true } };
export const LoadError: Story = {
  args: { users: [], error: 'The BFF returned 503. Try again in a moment.' },
};
export const Empty: Story = { args: { users: [] } };

export const SearchUsers: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Search users' }),
      'maria',
    );
    await expect(canvas.getByText('maria.lopez')).toBeInTheDocument();
    await expect(canvas.queryByText('analyst')).not.toBeInTheDocument();
  },
};

export const CreateUser: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Add user' }));
    const dialog = within(canvasElement.ownerDocument.body);
    await userEvent.type(
      dialog.getByRole('textbox', { name: /Username/ }),
      'new.operator',
    );
    await userEvent.type(
      dialog.getByRole('textbox', { name: /Email/ }),
      'operator@uatf.edu.bo',
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Save user' }));
    await expect(args.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'new.operator',
        email: 'operator@uatf.edu.bo',
        roles: ['ROLE_USER'],
      }),
    );
  },
};

export const DeleteUser: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete analyst' }),
    );
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole('button', {
        name: 'Delete user',
      }),
    );
    await expect(args.onDelete).toHaveBeenCalledWith(users[1]);
  },
};
