'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Database, FolderSearch, RefreshCw } from 'lucide-react';
import {
  listSavedDashboards,
  type SavedDashboardSummary,
} from '@dss-monorepo/olap-data-access';
import { Badge, Button, Skeleton } from '@dss-monorepo/design-system';

export function DashboardCatalog() {
  const [dashboards, setDashboards] = useState<SavedDashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void listSavedDashboards()
      .then((items) => {
        if (active) setDashboards(items);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudo cargar el catálogo de dashboards.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <section
      className="space-y-6"
      aria-labelledby="dashboards-heading"
      aria-busy={loading}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Database aria-hidden="true" className="size-4 text-primary" />
            Biblioteca de análisis
          </p>
          <h1
            id="dashboards-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Dashboards
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Abre una vista guardada y explora su distribución de análisis.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setAttempt((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Actualizar
        </Button>
      </header>

      {loading ? (
        <div
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Cargando dashboards"
        >
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-6"
        >
          <h2 className="font-semibold">No se pudo cargar el catálogo</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Reintentar
          </Button>
        </div>
      ) : dashboards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <FolderSearch
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <h2 className="mt-3 font-semibold">
            Todavía no hay dashboards guardados
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Cuando guardes análisis en el repositorio de Saiku, aparecerán aquí.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dashboards.map((dashboard) => (
            <li key={dashboard.path}>
              <Link
                href={`/dashboards/${encodePath(dashboard.path)}`}
                className="group flex h-full min-h-32 flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database aria-hidden="true" className="size-4" />
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </span>
                <span className="mt-4 truncate font-medium">
                  {dashboard.name}
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">Dashboard</Badge>
                  <span className="truncate">{dashboard.path}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}
