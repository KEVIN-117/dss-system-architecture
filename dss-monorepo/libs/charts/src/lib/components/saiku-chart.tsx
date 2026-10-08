'use client';

import { useEffect, useMemo, useState } from 'react';
import { use as registerEChartsModules } from 'echarts/core';
import { DataZoomInsideComponent } from 'echarts/components';

import { BaseChart } from './base-chart';
import type { ChartOption, CommonChartProps } from '../core/types';
import type { ChartThemeTokens } from '../core/theme';
import {
  applyColorBlindSafe,
  toSaikuTheme,
} from '../saiku/chart-theme';
import {
  DEFAULT_CHART_OPTIONS,
  type ChartOptions,
  type ChartType,
} from '../saiku/chart-types';
import {
  buildChartOption,
  type ChartGeometry,
  type ChartProjection,
} from '../saiku/build';

// Saiku's cartesian builders emit dataZoom.inside. Register it here so the
// shared ECharts instance can render those options even when the base engine
// has not imported the optional data-zoom component.
registerEChartsModules([DataZoomInsideComponent]);

export interface SaikuChartProps extends CommonChartProps {
  chartType: ChartType;
  projection: ChartProjection;
  options?: Partial<ChartOptions>;
  geometry?: ChartGeometry;
  colorBlindSafe?: boolean;
  invalid?: boolean;
}

/** React adapter for Saiku's shared ECharts builder. */
export function SaikuChart({
  chartType,
  projection,
  options,
  geometry,
  colorBlindSafe = false,
  invalid = false,
  loading = false,
  title,
  ...commonProps
}: SaikuChartProps) {
  const [worldMapReady, setWorldMapReady] = useState(chartType !== 'map');
  const [worldMapFailed, setWorldMapFailed] = useState(false);

  useEffect(() => {
    if (chartType !== 'map') {
      setWorldMapReady(true);
      setWorldMapFailed(false);
      return;
    }

    let active = true;
    setWorldMapReady(false);
    setWorldMapFailed(false);
    void import('../saiku/register-world-map')
      .then(({ ensureWorldMapRegistered }) => ensureWorldMapRegistered())
      .then(() => {
        if (active) setWorldMapReady(true);
      })
      .catch(() => {
        if (active) setWorldMapFailed(true);
      });

    return () => {
      active = false;
    };
  }, [chartType]);

  const chartOptions = useMemo<ChartOptions>(
    () => ({ ...DEFAULT_CHART_OPTIONS, ...options, ...(title ? { title } : {}) }),
    [options, title],
  );

  const option = useMemo(
    () => (tokens: ChartThemeTokens, width: number) => {
      // BaseChart keeps the chart mounted while a loading state is active and
      // still evaluates its option factory. Do not emit the map series until
      // the asynchronous GeoJSON registration has completed.
      if (chartType === 'map' && !worldMapReady) return {} as ChartOption;

      const saikuTokens = applyColorBlindSafe(toSaikuTheme(tokens), colorBlindSafe);
      const built = buildChartOption(projection, chartType, chartOptions, saikuTokens, {
        ...geometry,
        chartWidth: geometry?.chartWidth ?? width,
      });

      // A single-measure proportional chart already has a chart title. Saiku's
      // builder also adds the measure name as a small-multiple heading, which
      // collides with that title when there is only one cell.
      if (
        ['pie', 'donut', 'treemap', 'sunburst'].includes(chartType) &&
        projection.columnCategories.length === 1 &&
        built &&
        Array.isArray(built.title)
      ) {
        return { ...built, title: built.title.slice(0, 1) } as ChartOption;
      }

      return (built ?? {}) as ChartOption;
    },
    [chartType, chartOptions, colorBlindSafe, geometry, projection, worldMapReady],
  );

  const noData = projection.matrix.length === 0 ||
    projection.rowCategories.length === 0 ||
    projection.columnCategories.length === 0;

  return (
    <BaseChart
      {...commonProps}
      title={title ?? chartOptions.title}
      option={option}
      loading={loading || (chartType === 'map' && !worldMapReady && !worldMapFailed)}
      empty={noData}
      invalid={invalid || worldMapFailed}
      invalidMessage={worldMapFailed ? 'No se pudo cargar el mapa geográfico.' : undefined}
    />
  );
}
