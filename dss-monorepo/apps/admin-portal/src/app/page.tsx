import { 
  DashboardTemplate, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  MetricIndicator,
  Button,
  Typography
} from '@dss-monorepo/design-system';
import { 
  AcademicBarChart, 
  RiskDonutChart, 
  TrendLineChart 
} from '@dss-monorepo/charts';

const barData = [
  { label: 'Ingeniería', value: 1200 },
  { label: 'Derecho', value: 950 },
  { label: 'Medicina', value: 800 },
  { label: 'Economía', value: 1100 }
];

const donutData = [
  { label: 'Estables', value: 85 },
  { label: 'Riesgo Moderado', value: 10 },
  { label: 'Riesgo de Deserción', value: 5 }
];

const trendData = [
  { label: 'Sem 1', value: 65 },
  { label: 'Sem 2', value: 68 },
  { label: 'Sem 3', value: 62 },
  { label: 'Sem 4', value: 75 },
  { label: 'Sem 5', value: 80 }
];

export default function Index() {
  const handleChartClick = (params: any) => {
    console.log('Chart clicked:', params.name, params.value);
    // Drill-down logic would go here
  };

  return (
    <DashboardTemplate
      sidebarTitle="DSS ADMIN"
      navItems={[
        { title: 'System Overview', href: '#' },
        { title: 'Network Security', href: '#' },
        { title: 'Access Logs', href: '#' },
        { title: 'Node Cluster', href: '#' },
      ]}
      user={{
        name: 'Root Operator',
        email: 'admin@uatf.edu.bo'
      }}
    >
      <div className="flex items-center justify-between mb-8">
        <Typography variant="h2" className="border-none font-bold">
          MAINFRAME STATUS
        </Typography>
        <Button variant="outline" className="border-primary text-primary hover:bg-primary/20">
          Run Diagnostics
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricIndicator 
          title="CORE LOAD"
          value="89%"
          trend="up"
          trendValue="+14%"
          isCritical
        />
        <MetricIndicator 
          title="ACTIVE SESSIONS"
          value="1,024"
          trend="up"
          trendValue="+12"
        />
        <MetricIndicator 
          title="INTRUSION ATTEMPTS"
          value="0"
          trend="neutral"
          trendValue="0"
        />
        <MetricIndicator 
          title="QUERY LATENCY"
          value="4ms"
          trend="down"
          trendValue="-1ms"
        />
      </div>

      {/* CHARTS SECTION */}
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1 lg:col-span-2 border-primary/20 bg-background/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Enrollment by Faculty</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
             <AcademicBarChart 
               data={barData} 
               onChartClick={handleChartClick} 
             />
          </CardContent>
        </Card>

        <Card className="col-span-1 border-primary/20 bg-background/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Global Dropout Risk</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
             <RiskDonutChart 
               data={donutData} 
               onChartClick={handleChartClick} 
             />
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-6 grid gap-6">
        <Card className="col-span-1 border-primary/20 bg-background/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Approval Rate Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
             <TrendLineChart 
               data={trendData} 
               onChartClick={handleChartClick} 
             />
          </CardContent>
        </Card>
      </div>
    </DashboardTemplate>
  );
}
