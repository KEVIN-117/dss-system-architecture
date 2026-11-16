import { Card, CardContent } from '@dss-monorepo/design-system';
import { AcademicSparkline } from '@dss-monorepo/academic-analytics';

import { CARD_CLASS } from '../../../utils/constants';
import type { ChartPoint } from '../../../utils/types';

export function MetricCard({
  icon,
  label,
  formattedValue,
  unit,
  series = [],
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  formattedValue: string;
  unit: string;
  series?: ChartPoint[];
  loading: boolean;
}) {
  return (
    <Card className={CARD_CLASS}>
      <CardContent className="grid min-h-40 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <div
              className="mt-3 h-9 w-28 animate-pulse rounded bg-muted"
              aria-label="Cargando indicador"
            />
          ) : (
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {formattedValue}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{unit}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        {series.length > 0 && !loading ? (
          <div className="col-span-2 flex items-center justify-between gap-4 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              Tendencia · {series.length} periodos
            </span>
            <AcademicSparkline
              label={label}
              data={series}
              className="h-8 w-28 shrink-0 text-(--role-accent,var(--primary))"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
