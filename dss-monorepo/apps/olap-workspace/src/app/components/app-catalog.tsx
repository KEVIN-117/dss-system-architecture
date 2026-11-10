'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppWindow, ArrowUpRight, RefreshCw } from 'lucide-react';
import { listSavedApps, type AppSummary } from '@dss-monorepo/olap-data-access';
import { Badge, Button, Loader } from '@dss-monorepo/design-system';

export function AppCatalog() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void listSavedApps()
      .then((items) => {
        if (active) setApps(items);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudo cargar el catálogo de apps.',
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
      aria-labelledby="apps-heading"
      aria-busy={loading}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <AppWindow aria-hidden="true" className="size-4 text-primary" />
            Experiencias publicadas
          </p>
          <h1
            id="apps-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Apps analíticas
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Abre aplicaciones que reúnen dashboards y páginas para un flujo de
            análisis.
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
        <Loader text="Cargando apps…" fullScreen={false} className="rounded-xl" />
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
      ) : apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <AppWindow
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <h2 className="mt-3 font-semibold">No hay apps publicadas</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Las apps creadas para compartir análisis aparecerán en esta
            biblioteca.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <li key={app.path}>
              <Link
                href={`/apps/${encodePath(app.path)}`}
                className="group flex h-full min-h-32 flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <AppWindow aria-hidden="true" className="size-4" />
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </span>
                <span className="mt-4 truncate font-medium">{app.name}</span>
                <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">App</Badge>
                  <span className="truncate">{app.path}</span>
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
