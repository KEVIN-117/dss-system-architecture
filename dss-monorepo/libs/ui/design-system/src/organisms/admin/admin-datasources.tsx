'use client';

import * as React from 'react';
import {
  Cable,
  Database,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

import { Badge } from '../../atoms/badge';
import { Button } from '../../atoms/button';
import { Input } from '../../atoms/input';
import { Label } from '../../atoms/label';
import { Select } from '../../atoms/select';
import { Skeleton } from '../../atoms/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../molecules/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../molecules/table';
import type {
  AdminDatasourceConnectionType,
  AdminDatasourceDraft,
  AdminDatasourceRecord,
} from './types';

export interface AdminDatasourcesProps {
  datasources: AdminDatasourceRecord[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onCreate: (datasource: AdminDatasourceDraft) => void | Promise<void>;
  onUpdate: (datasource: AdminDatasourceDraft) => void | Promise<void>;
  onDelete: (datasource: AdminDatasourceRecord) => void | Promise<void>;
  onReconnect: (datasource: AdminDatasourceRecord) => void | Promise<void>;
}

const CONNECTION_TYPES: Array<{
  value: AdminDatasourceConnectionType;
  label: string;
}> = [
  { value: 'MONDRIAN', label: 'Mondrian (JDBC)' },
  { value: 'XMLA', label: 'XMLA' },
  { value: 'OSSIE', label: 'Ossie (SQL semántico)' },
];

function connectionTypeLabel(value?: string): string {
  return (
    CONNECTION_TYPES.find((type) => type.value === value)?.label ??
    value ??
    'Sin tipo'
  );
}

function safeEndpoint(value?: string): string {
  if (!value) return 'No especificada';
  return value
    .replace(/(\/\/[^:/@\s]+:)[^/@\s]+@/g, '$1•••@')
    .replace(
      /((?:password|passwd|pwd|token|secret|username|user)=)[^;&\s]*/gi,
      '$1•••',
    );
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.';
}

function emptyDraft(): AdminDatasourceDraft {
  return {
    id: '',
    name: '',
    connectiontype: 'MONDRIAN',
    location: '',
    driver: '',
    schemaName: '',
    username: '',
    password: '',
    ossieYaml: '',
  };
}

export function AdminDatasources({
  datasources,
  loading = false,
  error,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onReconnect,
}: AdminDatasourcesProps) {
  const [query, setQuery] = React.useState('');
  const [draft, setDraft] = React.useState<AdminDatasourceDraft | null>(null);
  const [deleting, setDeleting] = React.useState<AdminDatasourceRecord | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [reconnectingId, setReconnectingId] = React.useState<string | null>(
    null,
  );
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const formId = React.useId();
  const isNew = draft?.id === '';
  const connectionType = draft?.connectiontype ?? 'MONDRIAN';
  const filteredDatasources = datasources.filter((datasource) =>
    [
      datasource.name,
      datasource.connectiontype,
      datasource.schemaName,
      datasource.location,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const closeEditor = () => {
    if (saving) return;
    setDraft(null);
    setMutationError(null);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setMutationError(null);
    setStatusMessage(null);
    const normalized: AdminDatasourceDraft = {
      ...draft,
      name: draft.name.trim(),
      location: draft.location?.trim() ?? '',
      driver: draft.driver?.trim() ?? '',
      schemaName: draft.schemaName?.trim() || null,
      username: draft.username?.trim() ?? '',
      password: draft.password?.trim() || undefined,
      ossieYaml: draft.ossieYaml?.trim() || null,
    };
    try {
      if (isNew) await onCreate(normalized);
      else await onUpdate(normalized);
      setDraft(null);
      setStatusMessage(isNew ? 'Conexión registrada.' : 'Cambios guardados.');
    } catch (cause) {
      setMutationError(safeErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    setMutationError(null);
    setStatusMessage(null);
    try {
      await onDelete(deleting);
      setDeleting(null);
      setStatusMessage('Conexión eliminada.');
    } catch (cause) {
      setMutationError(safeErrorMessage(cause));
    } finally {
      setRemoving(false);
    }
  };

  const reconnect = async (datasource: AdminDatasourceRecord) => {
    setReconnectingId(datasource.id);
    setMutationError(null);
    setStatusMessage(null);
    try {
      await onReconnect(datasource);
      setStatusMessage(`Conexión actualizada: ${datasource.name}.`);
    } catch (cause) {
      setMutationError(safeErrorMessage(cause));
    } finally {
      setReconnectingId(null);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="admin-datasources-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Cable className="size-4" aria-hidden="true" />
            OLAP Service
          </div>
          <h1
            id="admin-datasources-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Conexiones OLAP
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Registra y administra las fuentes que alimentan los esquemas y cubos
            analíticos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={!onRefresh || loading}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Actualizar lista
          </Button>
          <Button
            onClick={() => {
              setMutationError(null);
              setDraft(emptyDraft());
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Registrar conexión
          </Button>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
        Usa credenciales de solo lectura para las fuentes analíticas. Por
        seguridad, las contraseñas guardadas no se muestran; al editar, deja el
        campo vacío para conservarla.
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-medium">No se pudieron cargar las conexiones</p>
          <p className="mt-1">{error}</p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            Reintentar
          </Button>
        </div>
      )}
      {mutationError && !draft && !deleting && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {mutationError}
        </div>
      )}
      {statusMessage && (
        <p role="status" aria-live="polite" className="text-sm text-success">
          {statusMessage}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-medium">Fuentes registradas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading
                ? 'Cargando conexiones…'
                : `${filteredDatasources.length} ${filteredDatasources.length === 1 ? 'conexión' : 'conexiones'}`}
            </p>
          </div>
          <div className="w-full sm:w-80">
            <Input
              aria-label="Buscar conexiones OLAP"
              iconLeft={<Search className="size-4" aria-hidden="true" />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, tipo o esquema"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4" aria-label="Cargando conexiones">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredDatasources.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conexión</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Esquema / modelo</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="w-36 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDatasources.map((datasource) => (
                  <TableRow key={datasource.id || datasource.name}>
                    <TableCell className="min-w-40 font-medium">
                      {datasource.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {connectionTypeLabel(datasource.connectiontype)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-48 truncate text-muted-foreground"
                      title={datasource.schemaName ?? undefined}
                    >
                      {datasource.schemaName || 'Sin esquema asociado'}
                    </TableCell>
                    <TableCell
                      className="max-w-64 truncate font-mono text-xs text-muted-foreground"
                      title={safeEndpoint(datasource.location)}
                    >
                      {safeEndpoint(datasource.location)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actualizar conexión ${datasource.name}`}
                          title="Restablecer conexión"
                          onClick={() => void reconnect(datasource)}
                          disabled={reconnectingId !== null || loading}
                        >
                          <RefreshCw
                            className={`size-4 ${reconnectingId === datasource.id ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar conexión ${datasource.name}`}
                          title="Editar conexión"
                          onClick={() => {
                            setMutationError(null);
                            setDraft({ ...datasource, password: '' });
                          }}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Eliminar conexión ${datasource.name}`}
                          title="Eliminar conexión"
                          onClick={() => {
                            setMutationError(null);
                            setDeleting(datasource);
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
              <Database className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-medium">
                {datasources.length === 0
                  ? 'Aún no hay conexiones'
                  : 'Sin resultados'}
              </h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                {datasources.length === 0
                  ? 'Registra una fuente analítica para poder asociarla a esquemas y cubos.'
                  : 'Prueba con otro nombre, tipo de conexión o esquema.'}
              </p>
            </div>
            {datasources.length === 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setMutationError(null);
                  setDraft(emptyDraft());
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                Registrar conexión
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isNew ? 'Registrar conexión OLAP' : 'Editar conexión OLAP'}
            </DialogTitle>
            <DialogDescription>
              Define el tipo de fuente y los datos de acceso. Las credenciales
              viajan al servicio mediante la sesión autenticada del BFF.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              id={formId}
              onSubmit={(event) => void save(event)}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-name`}>Nombre de conexión *</Label>
                  <Input
                    id={`${formId}-name`}
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    autoComplete="off"
                    placeholder="UATF Warehouse"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-type`}>Tipo de conexión *</Label>
                  <Select
                    id={`${formId}-type`}
                    value={connectionType}
                    onChange={(event) =>
                      setDraft({ ...draft, connectiontype: event.target.value })
                    }
                    size="lg"
                    required
                  >
                    {CONNECTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${formId}-location`}>
                  {connectionType === 'XMLA'
                    ? 'URL del servidor XMLA *'
                    : 'URL JDBC *'}
                </Label>
                <Input
                  id={`${formId}-location`}
                  value={draft.location ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, location: event.target.value })
                  }
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    connectionType === 'XMLA'
                      ? 'https://olap.example.edu/xmla'
                      : 'jdbc:postgresql://postgres-dw:5432/dss_dw'
                  }
                  required
                />
              </div>

              {connectionType === 'MONDRIAN' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-driver`}>Driver JDBC *</Label>
                    <Input
                      id={`${formId}-driver`}
                      value={draft.driver ?? ''}
                      onChange={(event) =>
                        setDraft({ ...draft, driver: event.target.value })
                      }
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="org.postgresql.Driver"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-schema`}>
                      Esquema Mondrian *
                    </Label>
                    <Input
                      id={`${formId}-schema`}
                      value={draft.schemaName ?? ''}
                      onChange={(event) =>
                        setDraft({ ...draft, schemaName: event.target.value })
                      }
                      autoComplete="off"
                      placeholder="uatf-rendimiento-academico.xml"
                      required
                    />
                  </div>
                </div>
              )}

              {connectionType === 'XMLA' && (
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-xmla-schema`}>
                    Catálogo XMLA (opcional)
                  </Label>
                  <Input
                    id={`${formId}-xmla-schema`}
                    value={draft.schemaName ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, schemaName: event.target.value })
                    }
                    autoComplete="off"
                  />
                </div>
              )}

              {connectionType === 'OSSIE' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-model`}>Modelo semántico</Label>
                    <Input
                      id={`${formId}-model`}
                      value={draft.schemaName ?? ''}
                      onChange={(event) =>
                        setDraft({ ...draft, schemaName: event.target.value })
                      }
                      autoComplete="off"
                      placeholder="Academic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-yaml`}>
                      Ruta del modelo YAML *
                    </Label>
                    <Input
                      id={`${formId}-yaml`}
                      value={draft.ossieYaml ?? ''}
                      onChange={(event) =>
                        setDraft({ ...draft, ossieYaml: event.target.value })
                      }
                      autoComplete="off"
                      placeholder="/datasources/academic.sds.yaml"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-username`}>
                    Usuario de base de datos
                  </Label>
                  <Input
                    id={`${formId}-username`}
                    value={draft.username ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, username: event.target.value })
                    }
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-password`}>Contraseña</Label>
                  <Input
                    id={`${formId}-password`}
                    type="password"
                    value={draft.password ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, password: event.target.value })
                    }
                    autoComplete={isNew ? 'new-password' : 'current-password'}
                    placeholder={
                      isNew
                        ? 'Contraseña de solo lectura'
                        : 'Dejar vacío para conservar la guardada'
                    }
                  />
                </div>
              </div>

              {mutationError && (
                <p
                  role="alert"
                  className="whitespace-pre-wrap text-sm text-destructive"
                >
                  {mutationError}
                </p>
              )}
            </form>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeEditor}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form={formId}
              loading={saving}
              disabled={!draft?.name.trim() || !draft.location?.trim()}
            >
              Guardar conexión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !removing) {
            setDeleting(null);
            setMutationError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar conexión?</DialogTitle>
            <DialogDescription>
              Se quitará <strong>{deleting?.name}</strong> del catálogo de
              Saiku. Los cubos que dependan de esta fuente dejarán de poder
              consultarse.
            </DialogDescription>
          </DialogHeader>
          {mutationError && (
            <p role="alert" className="text-sm text-destructive">
              {mutationError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={removing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void remove()}
              loading={removing}
            >
              Eliminar conexión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
