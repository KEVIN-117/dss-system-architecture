'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import {
  getSavedApp,
  type AppPage,
  type DashboardTile,
  type SaikuApp,
} from '@dss-monorepo/olap-data-access';
import {
  AppShell,
  Badge,
  Button,
  DashboardGrid,
  Loader,
  Tile,
} from '@dss-monorepo/design-system';
import { SavedTileQuery } from './saved-tile-query';

export function AppViewer({ path }: { path: string }) {
  const [app, setApp] = useState<SaikuApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [activePageId, setActivePageId] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getSavedApp(path)
      .then((value) => {
        if (!active) return;
        setApp(value);
        setActivePageId(value.pages[0]?.id);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudo abrir la app solicitada.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, path]);

  const appConfig = useMemo(() => {
    if (!app) return null;
    return {
      name: app.name,
      description: `App analítica · ${app.tags.join(' · ')}`,
      logoUrl: app.logo ?? undefined,
      navigation: app.nav.position,
      headerEyebrow: app.header?.eyebrow,
      showAssistant: app.assistantSlot.enabled,
      pages: app.pages.map((page) => ({
        id: page.id,
        title: page.title,
        description: page.subheading,
        content: <AppPagePreview page={page} />,
      })),
    };
  }, [app]);

  if (loading)
    return <Loader text="Cargando app…" fullScreen={false} className="rounded-xl" />;
  if (error || !app || !appConfig) {
    return (
      <section
        className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center"
        role="alert"
      >
        <AlertCircle
          aria-hidden="true"
          className="mx-auto size-7 text-destructive"
        />
        <h1 className="mt-3 text-lg font-semibold">No se pudo abrir la app</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error ?? 'No encontramos esa app en el repositorio.'}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Reintentar
          </Button>
          <Button asChild variant="ghost">
            <Link href="/apps">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Volver a apps
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Link
        href="/apps"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Todas las apps
      </Link>
      <AppShell
        app={appConfig}
        activePageId={activePageId}
        onPageChange={setActivePageId}
        emptyContent={
          <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
            <Badge variant="outline">Sin páginas</Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta app todavía no contiene páginas.
            </p>
          </div>
        }
      />
    </section>
  );
}

function AppPagePreview({ page }: { page: AppPage }) {
  const tiles = getTiles(page.grid);
  return (
    <div className="space-y-4">
      {page.heading && (
        <header className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {page.meta ?? 'Análisis'}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{page.heading}</h3>
          {page.subheading && (
            <p className="mt-1 text-sm text-muted-foreground">
              {page.subheading}
            </p>
          )}
        </header>
      )}
      {tiles.length ? (
        <DashboardGrid
          tiles={tiles.map((tile) => ({
            id: tile.id,
            defaultLayout: {
              id: tile.id,
              x: tile.x,
              y: tile.y,
              w: tile.w,
              h: tile.h,
            },
            content: (
              <Tile
                id={tile.id}
                title={tile.title || 'Bloque de análisis'}
                subtitle={tile.cube?.cubeName}
                statusLabel={tile.chartType ?? tile.type}
                empty={
                  (tile.type !== 'text' || !tile.text?.trim()) &&
                  (!tile.query ||
                    !['chart', 'table', 'kpi', 'custom'].includes(tile.type))
                }
                emptyMessage={
                  tile.type === 'filter'
                    ? 'Los filtros interactivos se habilitan desde el editor de la app.'
                    : 'Este bloque no tiene una consulta asociada.'
                }
              >
                {tile.type === 'text' && tile.text ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {tile.text}
                  </p>
                ) : tile.query &&
                  ['chart', 'table', 'kpi', 'custom'].includes(tile.type) ? (
                  <SavedTileQuery tile={tile} />
                ) : undefined}
              </Tile>
            ),
          }))}
        />
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background text-center">
          <Badge variant="outline">Página sin bloques</Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta página está lista para mostrar contenido de análisis.
          </p>
        </div>
      )}
    </div>
  );
}

function getTiles(grid: unknown): DashboardTile[] {
  if (
    !grid ||
    typeof grid !== 'object' ||
    !('tiles' in grid) ||
    !Array.isArray(grid.tiles)
  )
    return [];
  return grid.tiles.filter(isDashboardTile);
}

function isDashboardTile(value: unknown): value is DashboardTile {
  if (!value || typeof value !== 'object') return false;
  const tile = value as Partial<DashboardTile>;
  return (
    typeof tile.id === 'string' &&
    typeof tile.x === 'number' &&
    typeof tile.y === 'number' &&
    typeof tile.w === 'number' &&
    typeof tile.h === 'number' &&
    typeof tile.type === 'string'
  );
}
