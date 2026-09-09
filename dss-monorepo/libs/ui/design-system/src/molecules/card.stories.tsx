import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, CardAction } from './card';
import { Button } from '../atoms/button';

const meta: Meta<typeof Card> = {
  title: 'Molecules/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>System Status</CardTitle>
        <CardDescription>Real-time server diagnostics.</CardDescription>
        <CardAction>
          <Button size="icon-sm" variant="ghost">?</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 font-mono text-xs">
          <div className="flex justify-between border-b border-primary/20 pb-2">
            <span>UPTIME</span>
            <span className="text-primary">99.99%</span>
          </div>
          <div className="flex justify-between border-b border-primary/20 pb-2">
            <span>LOAD</span>
            <span className="text-emerald-500">Normal</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Initialize</Button>
      </CardFooter>
    </Card>
  )
};
