'use client';

import * as React from 'react';
import {
  Download,
  Edit3,
  LayoutDashboard,
  LoaderCircle,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '../../atoms/badge';
import { Button } from '../../atoms/button';
import { cn } from 'cn';

export interface DashboardToolbarAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: React.ComponentProps<typeof Button>['variant'];
  disabled?: boolean;
  loading?: boolean;
}

export interface DashboardToolbarProps {
  title: string;
  description?: string;
  context?: string;
  periodLabel?: string;
  lastUpdated?: string;
  editMode?: boolean;
  onEditModeChange?: (enabled: boolean) => void;
  onSave?: () => void;
  saving?: boolean;
  onExport?: () => void;
  onFilters?: () => void;
  filtersActive?: boolean;
  actions?: readonly DashboardToolbarAction[];
  className?: string;
}

/** Dashboard heading and actions that adapt to a portal's role and available operations. */
export function DashboardToolbar({
  title,
  description,
  context,
  periodLabel,
  lastUpdated,
  editMode = false,
  onEditModeChange,
  onSave,
  saving = false,
  onExport,
  onFilters,
  filtersActive = false,
  actions = [],
  className,
}: DashboardToolbarProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-5 border-b border-border pb-5 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <LayoutDashboard aria-hidden="true" className="size-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {context && <Badge variant="secondary">{context}</Badge>}
          {periodLabel && <Badge variant="outline">{periodLabel}</Badge>}
        </div>
        {description && (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Actualizado {lastUpdated}
          </p>
        )}
      </div>
      <nav
        aria-label="Acciones del dashboard"
        className="flex flex-wrap items-center gap-2"
      >
        {onFilters && (
          <Button
            type="button"
            variant="outline"
            onClick={onFilters}
            aria-pressed={filtersActive}
          >
            <SlidersHorizontal aria-hidden="true" />
            Filtros{filtersActive ? ' activos' : ''}
          </Button>
        )}
        {onExport && (
          <Button type="button" variant="outline" onClick={onExport}>
            <Download aria-hidden="true" />
            Exportar
          </Button>
        )}
        {actions.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant={action.variant ?? 'outline'}
            disabled={action.disabled}
            loading={action.loading}
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        {onEditModeChange && (
          <Button
            type="button"
            variant={editMode ? 'secondary' : 'outline'}
            aria-pressed={editMode}
            onClick={() => onEditModeChange(!editMode)}
          >
            <Edit3 aria-hidden="true" />
            {editMode ? 'Terminar edición' : 'Personalizar'}
          </Button>
        )}
        {editMode && onSave && (
          <Button type="button" onClick={onSave} loading={saving}>
            {saving ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            Guardar diseño
          </Button>
        )}
      </nav>
    </header>
  );
}
