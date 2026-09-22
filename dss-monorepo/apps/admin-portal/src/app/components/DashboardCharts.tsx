'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@dss-monorepo/design-system';
import {
  AcademicBarChart,
  RiskDonutChart,
  TrendLineChart,
} from '@dss-monorepo/charts';
import type { ChartClickEvent } from '@dss-monorepo/charts';

const barData = [
  { label: 'Ingeniería', value: 1200 },
  { label: 'Derecho', value: 950 },
  { label: 'Medicina', value: 800 },
  { label: 'Economía', value: 1100 },
];

const donutData = [
  { label: 'Estables', value: 85 },
  { label: 'Riesgo Moderado', value: 10 },
  { label: 'Riesgo de Deserción', value: 5 },
];

const trendData = [
  { label: 'Sem 1', value: 65 },
  { label: 'Sem 2', value: 68 },
  { label: 'Sem 3', value: 62 },
  { label: 'Sem 4', value: 75 },
  { label: 'Sem 5', value: 80 },
];

export function DashboardCharts() {
  const handleChartClick = (params: ChartClickEvent) => {
    console.log('Chart clicked:', params.name, params.value);
    // Drill-down logic would go here
  };

  return (
    <>
      {/* CHARTS SECTION */}
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1 lg:col-span-2 border-primary/20 bg-background/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Enrollment by Faculty</CardTitle>
          </CardHeader>
          <CardContent className="h-87.5">
            <AcademicBarChart data={barData} onChartClick={handleChartClick} />
          </CardContent>
        </Card>

        <Card className="col-span-1 border-primary/20 bg-background/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Global Dropout Risk</CardTitle>
          </CardHeader>
          <CardContent className="h-87.5">
            <RiskDonutChart data={donutData} onChartClick={handleChartClick} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6">
        <Card className="col-span-1 border-primary/20 bg-background/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Approval Rate Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-87.5">
            <TrendLineChart data={trendData} onChartClick={handleChartClick} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
