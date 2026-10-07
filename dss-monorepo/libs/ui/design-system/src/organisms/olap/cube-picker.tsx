'use client';

import * as React from 'react';
import { Database, LoaderCircle } from 'lucide-react';
import type { SaikuConnection, SaikuCube } from '@dss-monorepo/olap-models';
import { Label } from '../../atoms/label';
import { Select } from '../../atoms/select';

export interface CubePickerProps {
  connections: readonly SaikuConnection[];
  selectedCubeUniqueName?: string;
  onCubeChange: (cube: SaikuCube) => void;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** Select an OLAP cube from the available connections and catalogs. */
export function CubePicker({
  connections,
  selectedCubeUniqueName = '',
  onCubeChange,
  loading = false,
  error,
  disabled = false,
  label = 'Cubo',
  className,
}: CubePickerProps) {
  const selectId = React.useId();
  const helpId = `${selectId}-help`;
  const errorId = `${selectId}-error`;
  const options = React.useMemo(
    () =>
      connections.flatMap((connection) =>
        connection.catalogs.flatMap((catalog) =>
          catalog.schemas.flatMap((schema) =>
            schema.cubes
              .filter((cube) => cube.visible)
              .map((cube) => ({ connection, catalog, schema, cube })),
          ),
        ),
      ),
    [connections],
  );
  const selected = options.find(
    ({ cube }) => cube.uniqueName === selectedCubeUniqueName,
  );

  return (
    <section className={className} aria-busy={loading}>
      <div className="flex items-center gap-2">
        <Database aria-hidden="true" className="size-4 text-primary" />
        <Label htmlFor={selectId} className="text-sm font-semibold">
          {label}
        </Label>
      </div>
      <Select
        id={selectId}
        aria-label={label}
        value={selectedCubeUniqueName}
        disabled={disabled || loading || options.length === 0}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : loading ? undefined : helpId}
        className="mt-2"
        onChange={(event) => {
          const option = options.find(
            ({ cube }) => cube.uniqueName === event.target.value,
          );
          if (option) onCubeChange(option.cube);
        }}
      >
        <option value="" disabled>
          {loading
            ? 'Cargando cubos…'
            : options.length
              ? 'Selecciona un cubo'
              : 'No hay cubos disponibles'}
        </option>
        {connections.map((connection) => (
          <React.Fragment key={connection.name}>
            {connection.catalogs.map((catalog) => {
              const cubes = options.filter(
                (option) =>
                  option.connection.name === connection.name &&
                  option.catalog.name === catalog.name,
              );
              if (!cubes.length) return null;
              return (
                <optgroup
                  key={`${connection.name}:${catalog.name}`}
                  label={`${connection.name} · ${catalog.name}`}
                >
                  {cubes.map(({ schema, cube }) => (
                    <option
                      key={`${schema.name}:${cube.uniqueName}`}
                      value={cube.uniqueName}
                    >
                      {schema.name ? `${schema.name} · ` : ''}
                      {cube.caption}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </React.Fragment>
        ))}
      </Select>
      {loading ? (
        <p
          className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          Cargando conexiones y cubos…
        </p>
      ) : error ? (
        <p id={errorId} className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : selected ? (
        <p id={helpId} className="mt-2 truncate text-xs text-muted-foreground">
          {selected.connection.name} / {selected.catalog.name}
          {selected.schema.name ? ` / ${selected.schema.name}` : ''}
        </p>
      ) : (
        <p id={helpId} className="mt-2 text-xs text-muted-foreground">
          {options.length
            ? 'Elige el cubo que alimentará esta consulta.'
            : 'No se encontraron cubos visibles en las conexiones disponibles.'}
        </p>
      )}
    </section>
  );
}
