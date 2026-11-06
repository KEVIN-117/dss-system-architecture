'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@dss-monorepo/design-system';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  Database,
  History,
  RefreshCw,
  Users,
} from 'lucide-react';

import { listAdminUsers } from '../data-access/auth-admin';
import {
  getDwClosureCapabilities,
  listAcademicClosures,
  listEtlExecutions,
  type AcademicClosure,
  type DwClosureCapabilities,
  type EtlExecutionSummary,
} from '../data-access/dw-control';
import {
  listOlapDatasources,
  listOlapSchemas,
} from '../data-access/olap-admin';

type ServiceState = 'available' | 'degraded' | 'unavailable' | 'planned';

interface ServiceReport {
  state: ServiceState;
  metric: string;
  description: string;
}

interface OverviewSnapshot {
  auth: ServiceReport;
  olap: ServiceReport;
  dw: ServiceReport;
  recentExecutions: EtlExecutionSummary[];
  recentClosures: AcademicClosure[];
}

const INITIAL_REPORT: ServiceReport = {
  state: 'unavailable',
  metric: '—',
  description: 'Aún no se consultó el servicio.',
};

const INITIAL_SNAPSHOT: OverviewSnapshot = {
  auth: { ...INITIAL_REPORT, state: 'unavailable' },
  olap: { ...INITIAL_REPORT, state: 'unavailable' },
  dw: { ...INITIAL_REPORT, state: 'unavailable' },
  recentExecutions: [],
  recentClosures: [],
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la consulta.';
}

async function loadAuthReport(): Promise<ServiceReport> {
  try {
    const result = await listAdminUsers({ page: 0, size: 1 });
    return {
      state: 'available',
      metric: new Intl.NumberFormat('es-BO').format(result.totalElements),
      description: 'cuentas registradas en Auth Service',
    };
  } catch (error) {
    return {
      state: 'unavailable',
      metric: 'Sin conexión',
      description: errorMessage(error),
    };
  }
}

async function loadOlapReport(): Promise<ServiceReport> {
  const [datasources, schemas] = await Promise.allSettled([
    listOlapDatasources(),
    listOlapSchemas(),
  ]);
  const available = [datasources, schemas].filter(
    (result) => result.status === 'fulfilled',
  ).length;

  if (available === 0) {
    const failure = [datasources, schemas].find(
      (result) => result.status === 'rejected',
    );
    return {
      state: 'unavailable',
      metric: 'Sin conexión',
      description:
        failure?.status === 'rejected'
          ? errorMessage(failure.reason)
          : 'No se pudo consultar OLAP Service.',
    };
  }

  const datasourceCount =
    datasources.status === 'fulfilled' ? datasources.value.length : null;
  const schemaCount =
    schemas.status === 'fulfilled' ? schemas.value.length : null;
  const hasPartialFailure = available < 2;
  return {
    state: hasPartialFailure ? 'degraded' : 'available',
    metric: `${datasourceCount ?? '—'} conexiones · ${schemaCount ?? '—'} esquemas`,
    description: hasPartialFailure
      ? 'Una parte del catálogo OLAP no respondió.'
      : 'Conectividad y catálogos administrativos disponibles.',
  };
}

interface DwReportResult {
  report: ServiceReport;
  executions: EtlExecutionSummary[];
  closures: AcademicClosure[];
}

async function loadDwReport(): Promise<DwReportResult> {
  let capabilities: DwClosureCapabilities;
  try {
    capabilities = await getDwClosureCapabilities();
  } catch (error) {
    return {
      report: {
        state: 'unavailable',
        metric: 'Sin conexión',
        description: errorMessage(error),
      },
      executions: [],
      closures: [],
    };
  }

  const [closures, executions] = await Promise.allSettled([
    capabilities.canReadClosures
      ? listAcademicClosures({ page: 0, size: 5 })
      : Promise.reject(
          new Error('El servicio no habilitó lectura de cierres.'),
        ),
    capabilities.canReadEtlExecutions
      ? listEtlExecutions({ page: 0, size: 5 })
      : Promise.reject(
          new Error('El servicio no habilitó lectura de ejecuciones ETL.'),
        ),
  ]);
  const successfulQueries = [closures, executions].filter(
    (result) => result.status === 'fulfilled',
  ).length;
  const closurePage = closures.status === 'fulfilled' ? closures.value : null;
  const executionPage =
    executions.status === 'fulfilled' ? executions.value : null;
  const failures = [closures, executions]
    .filter((result) => result.status === 'rejected')
    .map((result) =>
      result.status === 'rejected' ? errorMessage(result.reason) : '',
    );

  return {
    report: {
      state:
        successfulQueries === 2
          ? 'available'
          : successfulQueries === 1
            ? 'degraded'
            : 'unavailable',
      metric: `${closurePage?.totalElements ?? '—'} cierres · ${executionPage?.totalElements ?? '—'} ejecuciones`,
      description:
        successfulQueries === 2
          ? 'Gestión de cierres y seguimiento ETL disponibles.'
          : (failures[0] ?? 'Una parte de DW Control Service no respondió.'),
    },
    executions: executionPage?.items ?? [],
    closures: closurePage?.items ?? [],
  };
}

function stateLabel(state: ServiceState): string {
  switch (state) {
    case 'available':
      return 'Disponible';
    case 'degraded':
      return 'Parcial';
    case 'unavailable':
      return 'No disponible';
    case 'planned':
      return 'En desarrollo';
  }
}

function stateVariant(
  state: ServiceState,
): React.ComponentProps<typeof Badge>['variant'] {
  if (state === 'unavailable') return 'destructive';
  if (state === 'planned') return 'outline';
  return 'secondary';
}

function stateTone(state: ServiceState): string {
  if (state === 'available') return 'text-success';
  if (state === 'degraded') return 'text-warning';
  if (state === 'unavailable') return 'text-destructive';
  return 'text-muted-foreground';
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function runStatusLabel(status: EtlExecutionSummary['status']): string {
  const labels: Record<EtlExecutionSummary['status'], string> = {
    SOLICITADA: 'Solicitada',
    EN_EJECUCION: 'En ejecución',
    PUBLICANDO: 'Publicando',
    EXITOSA: 'Exitosa',
    FALLIDA: 'Fallida',
    CANCELADA: 'Cancelada',
  };
  return labels[status];
}

function runStatusVariant(
  status: EtlExecutionSummary['status'],
): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'EXITOSA') return 'secondary';
  if (status === 'FALLIDA') return 'destructive';
  if (status === 'CANCELADA') return 'outline';
  return 'default';
}

function closureStatusLabel(status: AcademicClosure['status']): string {
  const labels: Record<AcademicClosure['status'], string> = {
    PENDIENTE: 'Pendiente',
    CERRADO: 'Cerrado',
    REABIERTO: 'Reabierto',
    PROCESADO: 'Procesado',
  };
  return labels[status];
}

function ServiceCard({
  title,
  href,
  icon: Icon,
  report,
  loading,
}: {
  title: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  report: ServiceReport;
  loading: boolean;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {!loading && (
          <Badge
            variant={stateVariant(report.state)}
            className={
              report.state === 'degraded'
                ? 'border-warning/40 text-warning'
                : undefined
            }
          >
            {stateLabel(report.state)}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <>
            <p className="text-xl font-semibold tracking-tight">
              {report.metric}
            </p>
            <p className={`mt-1 text-sm leading-5 ${stateTone(report.state)}`}>
              {report.description}
            </p>
            <Link
              href={href}
              className="mt-auto inline-flex min-h-11 items-center gap-2 pt-4 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Abrir gestión <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminOverviewPage() {
  const [snapshot, setSnapshot] = React.useState(INITIAL_SNAPSHOT);
  const [loading, setLoading] = React.useState(true);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [auth, olap, dw] = await Promise.all([
      loadAuthReport(),
      loadOlapReport(),
      loadDwReport(),
    ]);
    setSnapshot({
      auth,
      olap,
      dw: dw.report,
      recentExecutions: dw.executions,
      recentClosures: dw.closures,
    });
    setUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const services = [
    {
      title: 'Auth Service',
      href: '/users',
      icon: Users,
      report: snapshot.auth,
    },
    {
      title: 'OLAP Service',
      href: '/datasources',
      icon: Database,
      report: snapshot.olap,
    },
    {
      title: 'DW Control Service',
      href: '/academic-closures',
      icon: CalendarClock,
      report: snapshot.dw,
    },
    {
      title: 'ML Service',
      href: '/ml-operations',
      icon: BrainCircuit,
      report: {
        state: 'degraded' as const,
        metric: 'Dataset sintético',
        description:
          'Los jobs de entrenamiento están habilitados. El catálogo institucional de modelos y datasets pertenece a la siguiente etapa.',
      },
    },
  ];

  return (
    <main
      className="mx-auto w-full max-w-7xl space-y-8"
      aria-labelledby="admin-overview-title"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1
            id="admin-overview-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Resumen operativo
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Estado consultado en vivo de los servicios administrativos y acceso
            rápido a su gestión.
          </p>
          {updatedAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Actualizado {formatDate(updatedAt)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-2 size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`}
            aria-hidden="true"
          />
          Actualizar estado
        </Button>
      </header>

      <section
        aria-label="Estado de servicios"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {services.map((service) => (
          <ServiceCard key={service.title} {...service} loading={loading} />
        ))}
      </section>

      <section
        className="grid gap-6 xl:grid-cols-2"
        aria-label="Actividad administrativa reciente"
      >
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">
                Ejecuciones ETL recientes
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Actividad más reciente reportada por DW Control Service.
              </p>
            </div>
            <Activity
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-12 w-full" />
                ))}
              </div>
            ) : snapshot.recentExecutions.length ? (
              <ul className="divide-y divide-border">
                {snapshot.recentExecutions.slice(0, 5).map((run) => (
                  <li
                    key={run.runId}
                    className="flex min-h-14 items-center justify-between gap-4 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {run.runId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(run.requestedAt)}
                      </p>
                    </div>
                    <Badge variant={runStatusVariant(run.status)}>
                      {runStatusLabel(run.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {snapshot.dw.state === 'unavailable'
                  ? 'No se pudo consultar la actividad ETL. Revisa la conexión o los permisos del servicio.'
                  : 'No hay ejecuciones recientes disponibles.'}
              </p>
            )}
            <Link
              href="/etl-executions"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver todas las ejecuciones{' '}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">
                Cierres académicos recientes
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Periodos gestionados desde DW Control Service.
              </p>
            </div>
            <History
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-12 w-full" />
                ))}
              </div>
            ) : snapshot.recentClosures.length ? (
              <ul className="divide-y divide-border">
                {snapshot.recentClosures.slice(0, 5).map((closure) => (
                  <li
                    key={closure.closureId}
                    className="flex min-h-14 items-center justify-between gap-4 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        Gestión {closure.gestion} · Periodo {closure.periodo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(closure.updatedAt)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        closure.status === 'CERRADO' ||
                        closure.status === 'PROCESADO'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {closureStatusLabel(closure.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {snapshot.dw.state === 'unavailable'
                  ? 'No se pudo consultar la actividad de cierres. Revisa la conexión o los permisos del servicio.'
                  : 'No hay cierres recientes disponibles.'}
              </p>
            )}
            <Link
              href="/academic-closures"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Administrar cierres{' '}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
