'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChartNoAxesColumn,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import {
  getSavedDashboard,
  type Dashboard,
  type DashboardTile,
} from '@dss-monorepo/olap-data-access';
import {
  Badge,
  Button,
  DashboardGrid,
  DashboardToolbar,
  Loader,
  Tile,
} from '@dss-monorepo/design-system';
import { SavedTileQuery } from './saved-tile-query';

export function DashboardViewer({ dashboardPath }: { dashboardPath: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getSavedDashboard(dashboardPath)
      .then((value) => {
        if (active) setDashboard(value);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudo abrir el dashboard solicitado.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, dashboardPath]);

  if (loading) {
    return <Loader text="Cargando dashboard…" fullScreen={false} className="rounded-xl" />;
  }

  if (error || !dashboard) {
    return (
      <section
        className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center"
        role="alert"
      >
        <AlertCircle
          aria-hidden="true"
          className="mx-auto size-7 text-destructive"
        />
        <h1 className="mt-3 text-lg font-semibold">
          No se pudo abrir el dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error ?? 'No encontramos ese archivo en el repositorio.'}
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
            <Link href="/dashboards">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Volver a dashboards
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const gridTiles = dashboard.layout.tiles.map((tile) => ({
    id: tile.id,
    content: <DashboardTilePreview tile={tile} />,
    defaultLayout: {
      id: tile.id,
      x: tile.x,
      y: tile.y,
      w: tile.w,
      h: tile.h,
    },
  }));

  return (
    <section className="space-y-6" aria-label={dashboard.name}>
      <Link
        href="/dashboards"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Todos los dashboards
      </Link>
      <DashboardToolbar
        title={dashboard.name}
        description="Vista de análisis guardada en el repositorio."
        context="Dashboard"
        periodLabel={`${dashboard.layout.tiles.length} bloques`}
      />
      {dashboard.tags?.length ? (
        <div
          className="flex flex-wrap gap-2"
          aria-label="Etiquetas del dashboard"
        >
          {dashboard.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
      {gridTiles.length ? (
        <DashboardGrid tiles={gridTiles} />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <ChartNoAxesColumn
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <h2 className="mt-3 font-semibold">
            Este dashboard todavía no tiene bloques
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Su distribución está vacía. Puedes volver al catálogo para abrir
            otro análisis.
          </p>
        </div>
      )}
    </section>
  );
}

function DashboardTilePreview({ tile }: { tile: DashboardTile }) {
  const isText = tile.type === 'text' && Boolean(tile.text?.trim());
  const hasQuery =
    Boolean(tile.query) &&
    ['chart', 'table', 'kpi', 'custom'].includes(tile.type);
  return (
    <Tile
      id={tile.id}
      title={tile.title || tile.cube?.cubeName || 'Bloque de análisis'}
      subtitle={
        tile.cube?.cubeName
          ? `${tile.cube.schema} · ${tile.cube.cubeName}`
          : undefined
      }
      statusLabel={
        tile.type === 'text' ? 'Texto' : (tile.chartType ?? tile.type)
      }
      empty={!isText && !hasQuery}
      emptyMessage={
        tile.type === 'filter'
          ? 'Los filtros interactivos se habilitan desde el editor del dashboard.'
          : 'Este bloque no tiene una consulta asociada.'
      }
    >
      {isText ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {tile.text}
        </p>
      ) : hasQuery ? (
        <SavedTileQuery tile={tile} />
      ) : undefined}
    </Tile>
  );
}
