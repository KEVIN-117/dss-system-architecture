import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { DateRange } from 'react-day-picker';
import { Calendar } from './calendar';
import { CalendarIcon, TerminalIcon, CpuIcon } from 'lucide-react';

const meta: Meta<typeof Calendar> = {
  title: 'Atoms/Calendar',
  component: Calendar,
  tags: ['autodocs'],
  argTypes: {
    showOutsideDays: {
      control: 'boolean',
      description: 'Whether to show days from previous and next months.',
    },
    captionLayout: {
      control: 'select',
      options: ['label', 'dropdown'],
      description: 'The layout mode for the month and year captions.',
    },
    buttonVariant: {
      control: 'select',
      options: ['ghost', 'outline', 'default', 'secondary'],
      description: 'The button variant used for navigation and controls.',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Calendar>;

function DefaultRender() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={setSelectedDate}
        className="rounded-lg border shadow-sm p-3 bg-card"
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
        <CalendarIcon className="size-3.5 text-primary" />
        <span>
          Selected Date:{' '}
          {selectedDate ? selectedDate.toLocaleDateString() : 'None'}
        </span>
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <DefaultRender />,
};

function DateRangeSelectionRender() {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [range, setRange] = useState<DateRange | undefined>({
    from: today,
    to: nextWeek,
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <Calendar
        mode="range"
        selected={range}
        onSelect={setRange}
        className="rounded-lg border shadow-sm p-3 bg-card"
      />
      <div className="text-xs text-muted-foreground font-mono">
        Range: {range?.from ? range.from.toLocaleDateString() : '...'} -{' '}
        {range?.to ? range.to.toLocaleDateString() : '...'}
      </div>
    </div>
  );
}

export const DateRangeSelection: Story = {
  render: () => <DateRangeSelectionRender />,
};

export const Variations: Story = {
  render: () => {
    const today = new Date();

    return (
      <div className="flex flex-wrap gap-8 justify-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Outline Button Navigation
          </span>
          <Calendar
            mode="single"
            selected={today}
            buttonVariant="outline"
            className="rounded-lg border p-3 bg-card"
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Without Outside Days
          </span>
          <Calendar
            mode="single"
            selected={today}
            showOutsideDays={false}
            className="rounded-lg border p-3 bg-card"
          />
        </div>
      </div>
    );
  },
};

function CyberpunkRender() {
  const today = new Date();
  const examDate = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);

  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    examDate,
  );

  return (
    <div className="p-6 bg-background rounded-lg border border-primary/40 font-mono max-w-md mx-auto space-y-4 shadow-md">
      <div className="flex items-center justify-between border-b border-primary/20 pb-3">
        <div className="flex items-center gap-2 text-xs text-primary font-bold tracking-widest uppercase">
          <CpuIcon className="size-4 text-primary animate-pulse" />
          CRON-DISPATCH // MATRIX
        </div>
        <span className="text-[10px] text-success bg-success/15 border border-success/40 px-2 py-0.5 rounded">
          SYNCED: UTC-4
        </span>
      </div>

      <Calendar
        mode="single"
        selected={scheduledDate}
        onSelect={setScheduledDate}
        className="rounded-lg border border-primary/30 bg-card/20 backdrop-blur-md p-3 text-foreground"
      />

      <div className="bg-card/40 border border-primary/20 rounded p-3 text-xs space-y-1">
        <div className="flex items-center gap-1 text-primary font-semibold">
          <TerminalIcon className="size-3.5" />
          <span>SCHEDULED EVENT QUEUE</span>
        </div>
        <p className="text-muted-foreground text-[11px]">
          Target Date:{' '}
          <span className="text-foreground font-mono">
            {scheduledDate
              ? scheduledDate.toISOString().split('T')[0]
              : 'STANDBY'}
          </span>
        </p>
        <p className="text-success/90 text-[11px]">
          Task: BATCH_EVALUATION_DESERCIÓN_UATF.RUN
        </p>
      </div>
    </div>
  );
}

export const Cyberpunk: Story = {
  render: () => <CyberpunkRender />,
};
