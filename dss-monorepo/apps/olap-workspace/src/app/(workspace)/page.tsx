import Link from 'next/link';
import { ArrowRight, AppWindow, Code2, Database, Search } from 'lucide-react';
import { DashboardToolbar } from '@dss-monorepo/design-system';

export const metadata = { title: 'Inicio' };

export default function OlapWorkspacePage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <DashboardToolbar
        title="Tu espacio de análisis"
        description="Explora dashboards, consultas multidimensionales y experiencias analíticas avanzadas para profundizar en los datos institucionales."
        context="OLAP Workspace"
      />

      <section
        className="grid gap-4 lg:grid-cols-[1.2fr_1fr]"
        aria-label="Accesos al workspace"
      >
        <Link
          href="/dashboards"
          className="group flex min-h-64 flex-col justify-between rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-8 shadow-xs"
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
            href="/analysis"
            className="group flex min-h-36 items-center gap-5 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-xs"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">Explorador OLAP</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Lienzo drag-and-drop de dimensiones, filtros de miembros y celdas con drillthrough transaccional.
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                Iniciar análisis{' '}
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>

          <Link
            href="/workbench"
            className="group flex min-h-36 items-center gap-5 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-xs"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Code2 aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">MDX & SQL Workbench</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Consola con Monaco Editor para escribir consultas MDX directas y previsualizar la traducción a SQL.
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                Abrir Workbench{' '}
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>

          <Link
            href="/apps"
            className="group flex min-h-32 items-center gap-5 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-xs"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <AppWindow aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">Apps analíticas</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Experiencias estructuradas con múltiples páginas de análisis institucional.
              </span>
              <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                Ver apps{' '}
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-hover:translate-x-1"
                />
              </span>
            </span>
          </Link>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        El acceso a datos OLAP usa tu sesión institucional segura y se valida a través del BFF con Keycloak.
      </p>
    </div>
  );
}
