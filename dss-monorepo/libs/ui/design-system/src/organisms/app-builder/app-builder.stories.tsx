import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { AppEditor } from './app-editor';
import type { AppBuilderConfig } from './types';

const starterApp: AppBuilderConfig = {
  name: 'Academic insights',
  description: 'A shared space for enrollment and student success indicators.',
  navigation: 'rail',
  headerEyebrow: 'Institutional analytics',
  showAssistant: true,
  pages: [
    {
      id: 'overview',
      title: 'Overview',
      description: 'Enrollment, progression, and outcomes at a glance.',
    },
    {
      id: 'retention',
      title: 'Retention',
      description: 'Explore student persistence by program and cohort.',
    },
  ],
};

const meta: Meta<typeof AppEditor> = {
  title: 'Organisms/App Builder/AppEditor',
  component: AppEditor,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { initialApp: starterApp, onAppChange: fn(), onSave: fn() },
};

export default meta;
type Story = StoryObj<typeof AppEditor>;

export const Editor: Story = {};

export const TopNavigation: Story = {
  args: { initialApp: { ...starterApp, navigation: 'top' } },
};

export const ConfigureAndPreview: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Pages' }));
    const addPageButtons = canvas.getAllByRole('button', { name: 'Add page' });
    await userEvent.click(addPageButtons[addPageButtons.length - 1]);
    await expect(
      canvas.getByRole('textbox', { name: 'Page 3' }),
    ).toBeInTheDocument();
    await expect(args.onAppChange).toHaveBeenCalledWith(
      expect.objectContaining({
        pages: expect.arrayContaining([
          expect.objectContaining({ title: 'Page 3' }),
        ]),
      }),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Preview' }));
    await expect(
      canvas.getByRole('button', { name: 'Edit' }),
    ).toBeInTheDocument();
  },
};

export const SaveApp: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save app' }));
    await expect(args.onSave).toHaveBeenCalledWith(starterApp);
  },
};
