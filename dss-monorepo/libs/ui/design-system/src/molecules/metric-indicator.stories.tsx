import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetricIndicator } from './metric-indicator';
import { Activity, Server, Database, ShieldAlert } from 'lucide-react';

const meta: Meta<typeof MetricIndicator> = {
  title: 'Molecules/MetricIndicator',
  component: MetricIndicator,
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'The title/metric label.',
    },
    value: {
      control: 'text',
      description: 'The primary metric numerical or string value.',
    },
    trend: {
      control: 'select',
      options: ['up', 'down', 'neutral'],
      description: 'Direction of the trend indicator.',
    },
    trendValue: {
      control: 'text',
      description: 'The trend magnitude or label string.',
    },
    isCritical: {
      control: 'boolean',
      description: 'Whether the metric is in a critical alert state.',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MetricIndicator>;

export const Default: Story = {
  render: () => (
    <div className="max-w-xs">
      <MetricIndicator
        title="Tasa de Aprobación"
        value="82.4%"
        trend="up"
        trendValue="+4.1% vs gestión 2025"
      />
    </div>
  ),
};

export const CriticalState: Story = {
  render: () => (
    <div className="max-w-xs">
      <MetricIndicator
        title="Alerta de Deserción"
        value="38.7%"
        trend="down"
        trendValue="+12.5% sobre umbral"
        isCritical
      />
    </div>
  ),
};

export const TrendsComparison: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
      <MetricIndicator
        title="Matrícula Total"
        value="14,250"
        trend="up"
        trendValue="+6.8%"
      />
      <MetricIndicator
        title="Tasa de Reprobación"
        value="11.4%"
        trend="down"
        trendValue="-2.3%"
      />
      <MetricIndicator
        title="Créditos Semestrales"
        value="22.5"
        trend="neutral"
        trendValue="Estable"
      />
    </div>
  ),
};

export const CyberpunkTerminalDashboard: Story = {
  render: () => (
    <div className="p-6 bg-black/95 rounded-2xl border border-primary/30 space-y-6 max-w-4xl font-mono shadow-[0_0_40px_rgba(0,0,0,0.9)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-3">
        <div className="flex items-center gap-2 text-xs text-primary">
          <Activity className="size-4 animate-pulse text-primary" />
          <span className="font-bold tracking-widest">
            UATF-DSS TELEMETRY MONITOR • LIVE CORE
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Server className="size-3 text-emerald-400" /> CLUSTER: 8 NODES
          </span>
          <span className="flex items-center gap-1">
            <Database className="size-3 text-primary" /> POSTGRES: SYNCED
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricIndicator
          title="NEURAL THROUGHPUT"
          value="99.4%"
          trend="up"
          trendValue="8.4k req/s"
        />
        <MetricIndicator
          title="ETL INGESTION"
          value="1.4 GB/s"
          trend="up"
          trendValue="+15% peak"
        />
        <MetricIndicator
          title="ANOMALY RISK"
          value="92.6"
          trend="down"
          trendValue="SPIKE DETECTED"
          isCritical
        />
        <MetricIndicator
          title="QUERY LATENCY"
          value="14 ms"
          trend="neutral"
          trendValue="OPTIMAL"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 border-t border-primary/10 pt-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-3 text-destructive animate-pulse" />
          <span>SECURITY MONITOR: ISOLATION ZONE 03 ACTIVE</span>
        </div>
        <span>CYCLE: 2026-I-BATCH-09</span>
      </div>
    </div>
  ),
};
