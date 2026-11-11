'use client';

import { useEffect, useRef } from 'react';
import type { EChartsType } from 'echarts/core';
import { init } from '../core/engine';
import { resolveChartTheme } from '../core/theme';
import type {
  ChartClickEvent,
  ChartOption,
  ChartOptionFactory,
  CommonChartProps,
} from '../core/types';

export interface BaseChartProps extends CommonChartProps {
  option: ChartOption | ChartOptionFactory;
  empty?: boolean;
  invalid?: boolean;
}

/** Owns the complete canvas lifecycle; data builders stay independent of React. */
export function BaseChart(props: BaseChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const scheduleUpdate = useRef<(() => void) | null>(null);

  useEffect(() => {
    latest.current = props;
    scheduleUpdate.current?.();
  });

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let chart: EChartsType | undefined;
    let frame: number | undefined;
    let active = true;
    let lastWidth = 0;
    let lastHeight = 0;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const click = (event: ChartClickEvent) => {
      const current = latest.current;
      if (
        event.componentType === 'series' &&
        !current.loading &&
        !current.empty &&
        !current.invalid
      ) {
        current.onChartClick?.(event);
      }
    };
    const update = () => {
      frame = undefined;
      if (!active || element.clientWidth <= 0 || element.clientHeight <= 0)
        return;
      const current = latest.current;
      if (!current.loading && (current.empty || current.invalid)) {
        chart?.hideLoading();
        chart?.clear();
        return;
      }
      const theme = resolveChartTheme(undefined, element, current.themeTokens);
      if (!chart) {
        chart = init(element, undefined, { renderer: 'canvas' });
        chart.on('click', click);
        lastWidth = element.clientWidth;
        lastHeight = element.clientHeight;
      } else if (element.clientWidth !== lastWidth || element.clientHeight !== lastHeight) {
        lastWidth = element.clientWidth;
        lastHeight = element.clientHeight;
        chart.resize();
      }
      // Never send invalid data to ECharts, including while showing loading.
      const option =
        current.invalid || current.empty
          ? {}
          : typeof current.option === 'function'
            ? current.option(theme, element.clientWidth, element.clientHeight)
            : current.option;
      chart.setOption(
        {
          ...option,
          ...(option.tooltip
            ? {
                tooltip: Array.isArray(option.tooltip)
                  ? option.tooltip.map((tooltip) => ({
                      confine: true,
                      ...tooltip,
                    }))
                  : { confine: true, ...option.tooltip },
              }
            : {}),
          animation: motion.matches ? false : option.animation,
          aria: {
            enabled: true,
            ...option.aria,
            label: {
              enabled: true,
              ...option.aria?.label,
              ...(current.ariaLabel ? { description: current.ariaLabel } : {}),
            },
          },
        },
        { notMerge: true },
      );
      if (current.loading) {
        chart.showLoading('default', {
          text: 'Cargando…',
          color: theme.primary ?? theme.chartColors[0],
          textColor: theme.foreground,
          maskColor: theme.alpha(theme.background, 0.85),
          showSpinner: !motion.matches,
        });
      } else {
        chart.hideLoading();
      }
    };
    const schedule = () => {
      if (active && frame === undefined) frame = requestAnimationFrame(update);
    };
    scheduleUpdate.current = schedule;
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    // Only ancestors' theme attributes: ECharts' own DOM mutations must not loop.
    const mutations = new MutationObserver(schedule);
    for (
      let parent: HTMLElement | null = element.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      mutations.observe(parent, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style'],
      });
    }
    motion.addEventListener('change', schedule);
    schedule();
    return () => {
      active = false;
      scheduleUpdate.current = null;
      if (frame !== undefined) cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      motion.removeEventListener('change', schedule);
      chart?.off('click', click);
      chart?.dispose();
      chart = undefined;
    };
  }, []);

  const message = props.loading
    ? 'Cargando…'
    : props.invalid
      ? (props.invalidMessage ??
        'Datos inválidos: se requieren valores finitos y no negativos.')
      : props.empty
        ? (props.emptyMessage ?? 'Sin datos disponibles')
        : null;
  return (
    <div
      className={props.className}
      data-chart-state={
        props.loading
          ? 'loading'
          : props.invalid
            ? 'invalid'
            : props.empty
              ? 'empty'
              : 'ready'
      }
      style={{
        position: 'relative',
        width: '100%',
        height: props.height ?? 360,
        minWidth: 0,
        ...props.style,
      }}
      aria-busy={props.loading || undefined}
    >
      <div
        ref={host}
        role="img"
        aria-label={props.ariaLabel ?? props.title ?? 'Gráfico de datos'}
        style={{
          width: '100%',
          height: '100%',
          visibility: message && !props.loading ? 'hidden' : 'visible',
        }}
      />
      {message && (
        <div
          role={props.invalid && !props.loading ? 'alert' : 'status'}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            color: 'var(--foreground, #172033)',
            pointerEvents: 'none',
            ...(props.loading
              ? {
                  clipPath: 'inset(50%)',
                  width: 1,
                  height: 1,
                  overflow: 'hidden',
                }
              : {}),
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
