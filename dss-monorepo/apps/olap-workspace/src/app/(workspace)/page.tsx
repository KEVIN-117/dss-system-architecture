import Link from 'next/link';
import { ArrowRight, AppWindow, Database, Search } from 'lucide-react';
import { DashboardToolbar } from '@dss-monorepo/design-system';

export const metadata = { title: 'Inicio' };

export default function OlapWorkspacePage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <DashboardToolbar
        title="Tu espacio de análisis"
        description="Explora dashboards y experiencias analíticas guardadas para profundizar en los datos institucionales."
        context="OLAP Workspace"
      />

      <section
        className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"
        aria-label="Accesos al workspace"
      >
        <Link
          href="/dashboards"
          className="group flex min-h-64 flex-col justify-between rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-8"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database aria-hidden="true" className="size-5" />
          </span>
          <span className="mt-8 block max-w-xl">
            <span className="block text-xl font-semibold tracking-tight">
              Dashboards
            </span>
            <span className="mt-2 block text-sm leading-6 text-muted-foreground">
              Abre análisis guardados, revisa cómo se relacionan sus bloques y
              continúa explorando sus resultados.
            </span>
          </span>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">
            Explorar dashboards
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </span>
        </Link>

        <div className="grid gap-4">
          <Link
            href="/apps"
            className="group flex min-h-40 items-center gap-5 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <AppWindow aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Apps analíticas</span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                Experiencias con varias páginas de análisis.
              </span>
              <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
                Ver apps{' '}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-1"
                />
              </span>
            </span>
          </Link>

          <Link
            href="/analysis"
            className="group flex min-h-40 items-center gap-5 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Análisis OLAP</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Explora cubos, combina dimensiones y ejecuta consultas
                detalladas.
              </p>
              <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
                Iniciar análisis{' '}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        El acceso a datos OLAP usa tu sesión institucional y se valida a través
        del BFF.
      </p>
    </div>
  );
}
