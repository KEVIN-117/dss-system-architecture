'use client';

import * as React from 'react';
import {
  Responsive,
  useContainerWidth,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from 'react-grid-layout';
import type {
  DashboardBreakpoint,
  DashboardLayoutItem,
  DashboardLayouts,
} from '@dss-monorepo/dashboard-engine';
import { cn } from 'cn';
import {
  DashboardEditContext,
  type DashboardMoveDirection,
} from './dashboard-edit-context';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './dashboard-grid.css';

export interface DashboardGridTile {
  id: string;
  content: React.ReactNode;
  defaultLayout?: DashboardLayoutItem;
}

export interface DashboardGridProps {
  tiles: readonly DashboardGridTile[];
  layouts?: DashboardLayouts;
  editable?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  bounded?: boolean;
  externalDrop?: boolean;
  onDrop?: (position: DashboardLayoutItem | undefined, event: Event) => void;
  rowHeight?: number;
  onLayoutChange?: (
    breakpoint: DashboardBreakpoint,
    layout: DashboardLayoutItem[],
  ) => void;
  className?: string;
}

const breakpoints: Record<DashboardBreakpoint, number> = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};
const columns: Record<DashboardBreakpoint, number> = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
};
const breakpointOrder: DashboardBreakpoint[] = ['lg', 'md', 'sm', 'xs', 'xxs'];

function toGridLayout(items: readonly DashboardLayoutItem[]): Layout {
  return items.map(({ id, ...position }) => ({ i: id, ...position }));
}

function toDashboardLayout(items: Layout): DashboardLayoutItem[] {
  return items.map(
    ({ i, x, y, w, h, minW, minH, maxW, maxH, static: isStatic }) => ({
      id: i,
      x,
      y,
      w,
      h,
      ...(minW !== undefined && { minW }),
      ...(minH !== undefined && { minH }),
      ...(maxW !== undefined && { maxW }),
      ...(maxH !== undefined && { maxH }),
      ...(isStatic !== undefined && { static: isStatic }),
    }),
  );
}

/** Responsive, persisted-layout-compatible canvas for role-specific dashboard tiles. */
export function DashboardGrid({
  tiles,
  layouts,
  editable = false,
  draggable,
  resizable,
  bounded = true,
  externalDrop = false,
  onDrop,
  rowHeight = 42,
  onLayoutChange,
  className,
}: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
  });
  const showDragHandles = draggable ?? editable;
  const [localLayouts, setLocalLayouts] = React.useState<DashboardLayouts>({});
  const savedLayouts = layouts ?? localLayouts;
  const childrenLayouts = React.useMemo(() => {
    const result: ResponsiveLayouts<DashboardBreakpoint> = {};
    for (const breakpoint of breakpointOrder) {
      const saved = savedLayouts[breakpoint];
      const complete = saved?.length
        ? saved
        : tiles.map(
            (tile, index) =>
              tile.defaultLayout ?? {
                id: tile.id,
                x: (index % 2) * 6,
                y: Math.floor(index / 2) * 5,
                w: 6,
                h: 5,
                minW: 3,
                minH: 3,
              },
          );
      result[breakpoint] = toGridLayout(complete);
    }
    return result;
  }, [savedLayouts, tiles]);

  const handleLayoutChange = React.useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts<DashboardBreakpoint>) => {
      if (!onLayoutChange) {
        setLocalLayouts((current) => {
          const next = { ...current };
          for (const breakpoint of breakpointOrder) {
            const layout = allLayouts[breakpoint];
            if (layout) next[breakpoint] = toDashboardLayout(layout);
          }
          return next;
        });
        return;
      }
      for (const breakpoint of breakpointOrder) {
        const layout = allLayouts[breakpoint];
        if (layout) {
          const dashboardLayout = toDashboardLayout(layout);
          setLocalLayouts((current) => ({
            ...current,
            [breakpoint]: dashboardLayout,
          }));
          onLayoutChange(breakpoint, dashboardLayout);
        }
      }
    },
    [onLayoutChange],
  );
  const moveTile = React.useCallback(
    (tileId: string, direction: DashboardMoveDirection) => {
      const breakpoint =
        breakpointOrder.find((item) => width >= breakpoints[item]) ?? 'xxs';
      const layout = childrenLayouts[breakpoint];
      if (!layout) return;
      const currentItem = layout.find((item) => item.i === tileId);
      if (!currentItem) return;
      const delta =
        direction === 'left'
          ? [-1, 0]
          : direction === 'right'
            ? [1, 0]
            : direction === 'up'
              ? [0, -1]
              : [0, 1];
      const movedLayout = toDashboardLayout(
        layout.map((item) =>
          item.i === tileId
            ? {
                ...item,
                x: Math.max(
                  0,
                  Math.min(columns[breakpoint] - item.w, item.x + delta[0]),
                ),
                y: Math.max(0, item.y + delta[1]),
              }
            : item,
        ),
      );
      setLocalLayouts((current) => ({ ...current, [breakpoint]: movedLayout }));
      onLayoutChange?.(breakpoint, movedLayout);
    },
    [childrenLayouts, onLayoutChange, width],
  );

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Distribución del dashboard"
      className={cn(
        'dashboard-grid w-full',
        editable &&
          'rounded-xl outline outline-1 outline-dashed outline-border',
        className,
      )}
    >
      {!mounted ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          aria-label="Cargando distribución del dashboard"
        >
          {tiles.map((tile) => (
            <div key={tile.id} className="min-h-40">
              <DashboardEditContext.Provider
                value={{
                  showDragHandle:
                    showDragHandles && !tile.defaultLayout?.static,
                  moveTile: onLayoutChange
                    ? (direction) => moveTile(tile.id, direction)
                    : undefined,
                }}
              >
                {tile.content}
              </DashboardEditContext.Provider>
            </div>
          ))}
        </div>
      ) : (
        <Responsive
          width={width}
          breakpoints={breakpoints}
          cols={columns}
          layouts={childrenLayouts}
          rowHeight={rowHeight}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          dragConfig={{
            enabled: draggable ?? editable,
            handle: '.dashboard-grid-drag-handle',
            cancel: 'button, a, input, select, textarea, summary',
            bounded,
          }}
          resizeConfig={{ enabled: resizable ?? editable, handles: ['se'] }}
          dropConfig={
            externalDrop
              ? {
                  enabled: true,
                  defaultItem: { w: 4, h: 4 },
                  touchEnabled: true,
                }
              : undefined
          }
          droppingItem={
            externalDrop
              ? ({
                  i: '__dashboard-drop-placeholder__',
                  x: 0,
                  y: 0,
                  w: 4,
                  h: 4,
                } satisfies LayoutItem)
              : undefined
          }
          onDrop={
            externalDrop
              ? (_layout, item, event) =>
                  onDrop?.(
                    item ? toDashboardLayout([item])[0] : undefined,
                    event,
                  )
              : undefined
          }
          className={cn(
            '[&_.react-grid-item]:transition-[transform,width,height] [&_.react-grid-item]:duration-200',
            editable && '[&_.react-grid-item]:cursor-move',
          )}
          onLayoutChange={handleLayoutChange}
        >
          {tiles.map((tile) => (
            <div key={tile.id} className="h-full">
              <DashboardEditContext.Provider
                value={{
                  showDragHandle:
                    showDragHandles && !tile.defaultLayout?.static,
                  moveTile: onLayoutChange
                    ? (direction) => moveTile(tile.id, direction)
                    : undefined,
                }}
              >
                {tile.content}
              </DashboardEditContext.Provider>
            </div>
          ))}
        </Responsive>
      )}
    </div>
  );
}
