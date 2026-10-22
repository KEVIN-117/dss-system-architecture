import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { AdminSchemas } from './admin-schemas';
import type { AdminSchemaRecord } from './types';

const schemas: AdminSchemaRecord[] = [
  {
    id: 'academic',
    name: 'Academic',
    path: '/datasources/Academic.xml',
    type: 'Mondrian',
  },
  {
    id: 'retention',
    name: 'Retention',
    path: '/datasources/Retention.xml',
    type: 'Mondrian',
  },
];

const meta: Meta<typeof AdminSchemas> = {
  title: 'Organisms/Admin/Schemas',
  component: AdminSchemas,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    schemas,
    onRefresh: fn(),
    onView: fn(),
    onUpload: fn(),
    onDelete: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof AdminSchemas>;

export const Repository: Story = {};
export const Loading: Story = { args: { loading: true } };
export const LoadError: Story = {
  args: { schemas: [], error: 'The BFF returned 503. Try again in a moment.' },
};
export const Empty: Story = { args: { schemas: [] } };

export const UploadSchema: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Upload schema' }),
    );
    const dialog = within(canvasElement.ownerDocument.body);
    await userEvent.type(
      dialog.getByRole('textbox', { name: /Schema name/ }),
      'Student success',
    );
    await userEvent.type(
      dialog.getByRole('textbox', { name: /XML content/ }),
      '<Schema name="Student success"/>',
    );
    await userEvent.click(
      dialog.getByRole('button', { name: 'Upload schema' }),
    );
    await expect(args.onUpload).toHaveBeenCalledWith(
      'Student success',
      '<Schema name="Student success"/>',
    );
  },
};

export const DeleteSchema: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete Academic' }),
    );
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole('button', {
        name: 'Delete schema',
      }),
    );
    await expect(args.onDelete).toHaveBeenCalledWith(schemas[0]);
  },
};
