import type { Meta, StoryObj } from '@storybook/react-vite';
import { Typography } from './typography';

const meta: Meta<typeof Typography> = {
  title: 'Atoms/Typography',
  component: Typography,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Typography>;

export const Default: Story = {
  args: {
    children: 'The quick brown fox jumps over the lazy dog.',
    variant: 'p',
  },
};

export const Headings: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Typography variant="h1">Heading 1</Typography>
      <Typography variant="h2">Heading 2</Typography>
      <Typography variant="h3">Heading 3</Typography>
      <Typography variant="h4">Heading 4</Typography>
    </div>
  ),
};

export const CyberpunkNeon: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-background p-8 rounded-lg border border-primary/20">
      <Typography variant="neon">System Online</Typography>
      <Typography variant="p" className="text-muted-foreground">
        Authentication sequence accepted. Welcome to the mainframe.
      </Typography>
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Typography variant="large" color="primary">
        Primary Accent
      </Typography>
      <Typography variant="large" color="secondary">
        Secondary Accent
      </Typography>
      <Typography variant="large" color="destructive">
        Destructive Error
      </Typography>
      <Typography variant="large" color="muted">
        Muted Subtext
      </Typography>
    </div>
  ),
};

export const Elements: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-[500px]">
      <Typography variant="blockquote">
        "I've seen things you people wouldn't believe. Attack ships on fire off
        the shoulder of Orion."
      </Typography>
      <Typography variant="inlineCode">sudo rm -rf /</Typography>
      <Typography variant="list">
        <li>Initialize neural link</li>
        <li>Bypass firewall proxy</li>
        <li>Extract encrypted data</li>
      </Typography>
    </div>
  ),
};
