import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';
import { Button } from '../atoms/button';
import { Badge } from '../atoms/badge';
import { Input } from '../atoms/input';
import { Activity, Terminal, Shield, Cpu, Database } from 'lucide-react';

const meta: Meta<typeof Tabs> = {
  title: 'Molecules/Tabs',
  component: Tabs,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-[450px]">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="notifications">Alerts</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              Manage user credentials and academic role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase">
                User Handle
              </label>
              <Input defaultValue="krodriguez.sys" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase">
                Faculty Scope
              </label>
              <Input defaultValue="Ingeniería y Tecnología" disabled />
            </div>
          </CardContent>
          <CardFooter>
            <Button size="sm">Save Preferences</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="security">
        <Card>
          <CardHeader>
            <CardTitle>Security & Access</CardTitle>
            <CardDescription>
              Configure multi-factor tokens and JWT keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase">
                RS256 Decanal Passkey
              </label>
              <Input type="password" defaultValue="secret_token_117_xyz" />
            </div>
            <p className="text-xs text-muted-foreground">
              Session expires in 3,600 seconds under zero-trust policy.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              Rotate Passkey
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="notifications">
        <Card>
          <CardHeader>
            <CardTitle>System Notifications</CardTitle>
            <CardDescription>
              Broadcast feeds from ETL pipeline and ML inference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-md border border-primary/20 bg-background/50 p-3 text-xs font-mono flex items-center justify-between">
              <span>CRISP-DM Model Drift Monitor</span>
              <Badge variant="default" className="text-[10px]">
                Active
              </Badge>
            </div>
            <div className="rounded-md border border-primary/20 bg-background/50 p-3 text-xs font-mono flex items-center justify-between">
              <span>Go Load Manager Heartbeat</span>
              <Badge variant="outline" className="text-[10px]">
                Synced
              </Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" size="sm" className="w-full">
              View Audit Log
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

export const CyberpunkTerminal: Story = {
  render: () => (
    <div className="p-6 bg-background/95 rounded-xl border border-primary/30 shadow-md max-w-2xl font-mono">
      <div className="flex items-center justify-between border-b border-primary/20 pb-3 mb-4 text-xs">
        <div className="flex items-center gap-2 text-primary">
          <Terminal className="size-4 animate-pulse" />
          <span className="tracking-widest uppercase font-semibold">
            UATF.MAINFRAME // DECANAL_TELEMETRY
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-success animate-ping inline-block" />
          <span className="text-[11px] text-success">NODE:ONLINE</span>
        </div>
      </div>

      <Tabs defaultValue="sys_diag" className="w-full">
        <TabsList className="w-full grid grid-cols-4 bg-background/60 border border-primary/30 p-1">
          <TabsTrigger
            value="sys_diag"
            className="font-mono text-xs gap-1.5 data-[state=active]:border-primary data-[state=active]:bg-primary/25"
          >
            <Activity className="size-3 text-primary" />
            [SYS.DIAG]
          </TabsTrigger>
          <TabsTrigger
            value="ml_core"
            className="font-mono text-xs gap-1.5 data-[state=active]:border-primary data-[state=active]:bg-primary/25"
          >
            <Cpu className="size-3 text-primary" />
            [ML.CORE]
          </TabsTrigger>
          <TabsTrigger
            value="dw_graph"
            className="font-mono text-xs gap-1.5 data-[state=active]:border-primary data-[state=active]:bg-primary/25"
          >
            <Database className="size-3 text-warning" />
            [DW.GRAPH]
          </TabsTrigger>
          <TabsTrigger
            value="sec_vault"
            className="font-mono text-xs gap-1.5 data-[state=active]:border-primary data-[state=active]:bg-primary/25"
          >
            <Shield className="size-3 text-success" />
            [SEC.VAULT]
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sys_diag" className="mt-4 space-y-3">
          <div className="p-4 rounded-md bg-background/70 border border-primary/20 text-xs space-y-2">
            <div className="flex justify-between items-center text-muted-foreground border-b border-primary/10 pb-1.5">
              <span>SYSTEM_UPTIME</span>
              <span className="text-primary font-semibold">
                99.98% (214d 08h 12m)
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-b border-primary/10 pb-1.5">
              <span>GOROUTINE_POOL_ACTIVE</span>
              <span className="text-success">128 THREADS</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-b border-primary/10 pb-1.5">
              <span>HEAP_ALLOCATED</span>
              <span className="text-primary">48.2 MB / 512 MB</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>KERNEL_SIGNATURE</span>
              <span className="text-muted-foreground">
                0x9FA82...LINUX_AMD64
              </span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ml_core" className="mt-4 space-y-3">
          <div className="p-4 rounded-md bg-background/70 border border-primary/20 text-xs space-y-2">
            <div className="flex justify-between items-center text-muted-foreground border-b border-primary/10 pb-1.5">
              <span>ACTIVE_MODEL</span>
              <span className="text-primary font-semibold">
                XGBoost Student Retention v2.4
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-b border-primary/10 pb-1.5">
              <span>BALANCER_STATUS</span>
              <Badge
                variant="default"
                className="text-[10px] bg-primary/20 text-primary border-primary/40"
              >
                SMOTE: 1:1 RATIO
              </Badge>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-b border-primary/10 pb-1.5">
              <span>TEST_ACCURACY / AUC</span>
              <span className="text-success">94.8% / 0.962 ROC</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>EXPLAINABILITY_ENGINE</span>
              <span className="text-primary">
                SHAP TreeExplainer (Enabled)
              </span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dw_graph" className="mt-4 space-y-3">
          <div className="p-4 rounded-md bg-background/70 border border-warning/20 text-xs space-y-2">
            <div className="flex justify-between items-center text-muted-foreground border-b border-warning/10 pb-1.5">
              <span>POSTGRES_STAR_SCHEMA</span>
              <span className="text-warning font-semibold">
                HEFESTO v2 (synced)
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-b border-warning/10 pb-1.5">
              <span>FACT_TABLE_ROWS</span>
              <span className="text-primary font-mono">1,482,910 records</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-b border-warning/10 pb-1.5">
              <span>NEO4J_TOPOLOGY</span>
              <span className="text-warning">Bolt v5.1 // 12,450 Nodes</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>ETL_LOAD_MANAGER_LATENCY</span>
              <span className="text-success">12ms avg batch ingest</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sec_vault" className="mt-4 space-y-3">
          <div className="p-4 rounded-md bg-background/70 border border-success/20 text-xs space-y-2">
            <div className="flex justify-between items-center text-muted-foreground border-b border-success/10 pb-1.5">
              <span>AUTHORIZATION_GATEWAY</span>
              <span className="text-success font-semibold">
                RBAC + Row-Level Security
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-b border-success/10 pb-1.5">
              <span>DECANAL_ISOLATION</span>
              <span className="text-primary">
                ENFORCED (Carrera: Ing. Sistemas)
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>FIREWALL_STATUS</span>
              <Badge
                variant="outline"
                className="text-[10px] text-success border-success/40"
              >
                ZERO_TRUST_ARMED
              </Badge>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  ),
};

export const WithBadges: Story = {
  render: () => (
    <Tabs defaultValue="all" className="w-[500px]">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="all" className="gap-2">
          All Alerts
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            18
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="critical" className="gap-2">
          Critical
          <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
            3
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="resolved" className="gap-2">
          Resolved
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            15
          </Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="all"
        className="p-4 rounded-lg border border-primary/20 bg-background/50"
      >
        <p className="text-sm text-muted-foreground">
          Displaying 18 system alerts across all clusters.
        </p>
      </TabsContent>
      <TabsContent
        value="critical"
        className="p-4 rounded-lg border border-destructive/30 bg-destructive/5"
      >
        <p className="text-sm text-destructive">
          3 active anomalies detected in academic enrollment pipeline.
        </p>
      </TabsContent>
      <TabsContent
        value="resolved"
        className="p-4 rounded-lg border border-primary/20 bg-background/50"
      >
        <p className="text-sm text-success">
          15 alerts resolved within SLA.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

export const SegmentedPills: Story = {
  render: () => (
    <Tabs defaultValue="daily" className="w-[450px]">
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs font-mono uppercase text-muted-foreground">
          Aggregation Cadence
        </span>
        <TabsList className="h-8">
          <TabsTrigger value="daily" className="text-xs px-2.5 py-1">
            Daily
          </TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs px-2.5 py-1">
            Weekly
          </TabsTrigger>
          <TabsTrigger value="semester" className="text-xs px-2.5 py-1">
            Semester
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="daily"
        className="p-4 rounded-lg border border-primary/20 bg-muted/10 text-xs font-mono"
      >
        Aggregating student interactions per 24-hour cycle.
      </TabsContent>
      <TabsContent
        value="weekly"
        className="p-4 rounded-lg border border-primary/20 bg-muted/10 text-xs font-mono"
      >
        Aggregating weekly attendance & grade progress snapshots.
      </TabsContent>
      <TabsContent
        value="semester"
        className="p-4 rounded-lg border border-primary/20 bg-muted/10 text-xs font-mono"
      >
        Aggregating comprehensive semester academic outcome metrics.
      </TabsContent>
    </Tabs>
  ),
};
