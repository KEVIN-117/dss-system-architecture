'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  Input,
  Loader,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@dss-monorepo/design-system';
import { ChevronLeft, ChevronRight, FileSearch, RefreshCw } from 'lucide-react';
import {
  AUDIT_ACTIONS,
  OUTCOMES,
  TARGET_TYPES,
  auditDiff,
  listAudit,
  type AuditEntry,
  type AuditFilters,
  type AuditOutcome,
  type AuditTargetType,
} from '../data-access/iam-audit';

const PAGE_SIZE = 20;
const EMPTY_FILTERS: AuditFilters = { actor: '', action: '', targetType: '', targetId: '', outcome: '', from: '', to: '' };

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'medium' }) : '—';

const actorName = (entry: AuditEntry) => entry.actor?.username || entry.actor?.keycloakId || 'Sistema';

const actionLabel = (action: string) => AUDIT_ACTIONS[action] ?? action;

function OutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  const tone = outcome === 'FAILURE' ? 'text-destructive' : outcome === 'PENDING' ? 'text-amber-700 dark:text-amber-400' : '';
  return <Badge variant={outcome === 'SUCCESS' ? 'secondary' : 'outline'} className={tone}>{OUTCOMES[outcome] ?? outcome}</Badge>;
}

/**
 * Administrative audit (IAM-018): who changed what in IAM, when and with what result. Read-only; the
 * detail shows the state before and after each change, with secrets already redacted by auth-service.
 */
export function AdminAuditPage() {
  const [draft, setDraft] = React.useState<AuditFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = React.useState<AuditFilters>(EMPTY_FILTERS);
  const [page, setPage] = React.useState(0);
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [totalElements, setTotalElements] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<AuditEntry | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAudit(filters, page, PAGE_SIZE, signal);
      setEntries(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la auditoría.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters, page]);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const field = (key: keyof AuditFilters) => ({
    value: draft[key] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((current) => ({ ...current, [key]: event.target.value })),
  });

  const start = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalElements);
  const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to);

  return (
    <section className="space-y-6" aria-labelledby="admin-audit-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Administración · servicio de autenticación</p>
          <h1 id="admin-audit-title" className="text-2xl font-semibold tracking-tight">Auditoría</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cambios administrativos sobre usuarios, roles, permisos y aplicaciones, del más reciente al más antiguo.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Actualizar
        </Button>
      </header>

      <form
        aria-label="Filtros de auditoría"
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (invalidRange) return;
          setFilters(draft);
          setPage(0);
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="audit-actor" className="text-sm font-medium">Actor</label>
          <Input id="audit-actor" maxLength={255} placeholder="Usuario exacto" {...field('actor')} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="audit-action" className="text-sm font-medium">Acción</label>
          <Select id="audit-action" {...field('action')}>
            <option value="">Todas las acciones</option>
            {Object.entries(AUDIT_ACTIONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="audit-target-type" className="text-sm font-medium">Tipo de objetivo</label>
          <Select id="audit-target-type" {...field('targetType')}>
            <option value="">Todos</option>
            {(Object.keys(TARGET_TYPES) as AuditTargetType[]).map((value) => (
              <option key={value} value={value}>{TARGET_TYPES[value]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="audit-target-id" className="text-sm font-medium">Objetivo</label>
          <Input id="audit-target-id" maxLength={255} placeholder="Id o nombre exacto" {...field('targetId')} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="audit-outcome" className="text-sm font-medium">Resultado</label>
          <Select id="audit-outcome" {...field('outcome')}>
            <option value="">Todos</option>
            {(Object.keys(OUTCOMES) as AuditOutcome[]).map((value) => (
              <option key={value} value={value}>{OUTCOMES[value]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="audit-from" className="text-sm font-medium">Desde</label>
          <Input id="audit-from" type="date" {...field('from')} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="audit-to" className="text-sm font-medium">Hasta</label>
          <Input id="audit-to" type="date" {...field('to')} aria-invalid={invalidRange || undefined} />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={invalidRange}>Filtrar</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setFilters(EMPTY_FILTERS);
              setPage(0);
            }}
          >
            Limpiar
          </Button>
        </div>
        {invalidRange && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
            La fecha «Desde» no puede ser posterior a «Hasta».
          </p>
        )}
      </form>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">No se pudo cargar la auditoría</p>
          <p className="mt-1">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Reintentar</Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card" aria-busy={loading}>
        <Table aria-label="Registros de auditoría">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap font-sans text-sm">{formatDate(entry.occurredAt)}</TableCell>
                <TableCell className="font-mono text-xs">{actorName(entry)}</TableCell>
                <TableCell className="font-sans text-sm">{actionLabel(entry.action)}</TableCell>
                <TableCell className="text-sm">
                  <span className="block font-sans text-xs text-muted-foreground">{TARGET_TYPES[entry.targetType] ?? entry.targetType}</span>
                  <span className="font-mono text-xs">{entry.targetId ?? '—'}</span>
                </TableCell>
                <TableCell><OutcomeBadge outcome={entry.outcome} /></TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Ver detalle: ${actionLabel(entry.action)} ${entry.targetId ?? ''}`.trim()}
                    onClick={() => setSelected(entry)}
                  >
                    <FileSearch aria-hidden="true" className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center font-sans text-muted-foreground">
                  {error ? 'Verifica la conexión e inténtalo de nuevo.' : 'No hay registros que coincidan con estos filtros.'}
                </TableCell>
              </TableRow>
            )}
            {loading && entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} role="status">
                  <Loader text="Cargando auditoría…" fullScreen={false} className="min-h-24" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <nav aria-label="Paginación de auditoría" className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
          <p className="text-sm text-muted-foreground">Mostrando {start}–{end} de {totalElements}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Página {totalPages === 0 ? 0 : page + 1} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Página anterior"
              disabled={loading || page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Página siguiente"
              disabled={loading || page + 1 >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </nav>
      </div>

      <AuditDetailSheet entry={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function renderValue(value: unknown) {
  if (value === undefined) return <span className="text-muted-foreground">—</span>;
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === 'object') {
    return <pre className="whitespace-pre-wrap break-all font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }
  return <span className="break-all font-mono text-xs">{String(value)}</span>;
}

function AuditDetailSheet({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const rows = entry ? auditDiff(entry.before, entry.after) : [];
  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-6 pt-6">
          <SheetTitle>Detalle de auditoría</SheetTitle>
          <SheetDescription>{entry ? `${actionLabel(entry.action)} · ${entry.action}` : ''}</SheetDescription>
        </SheetHeader>
        {entry && (
          <div className="space-y-6 px-6 py-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Fecha</dt>
              <dd>{formatDate(entry.occurredAt)}</dd>
              <dt className="text-muted-foreground">Completado</dt>
              <dd>{formatDate(entry.completedAt)}</dd>
              <dt className="text-muted-foreground">Actor</dt>
              <dd className="font-mono text-xs">
                {actorName(entry)}
                {entry.actor?.ipAddress && <span className="text-muted-foreground"> · {entry.actor.ipAddress}</span>}
              </dd>
              <dt className="text-muted-foreground">Objetivo</dt>
              <dd>
                {TARGET_TYPES[entry.targetType] ?? entry.targetType}{' '}
                <span className="font-mono text-xs">{entry.targetId ?? '—'}</span>
              </dd>
              <dt className="text-muted-foreground">Resultado</dt>
              <dd><OutcomeBadge outcome={entry.outcome} /></dd>
              {entry.failureReason && (
                <>
                  <dt className="text-muted-foreground">Motivo</dt>
                  <dd className="text-destructive">{entry.failureReason}</dd>
                </>
              )}
            </dl>

            <section aria-labelledby="audit-diff-title" className="space-y-2">
              <h3 id="audit-diff-title" className="text-sm font-semibold">Antes y después</h3>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Esta operación no registró estado.</p>
              ) : (
                <Table aria-label="Cambios registrados">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>Antes</TableHead>
                      <TableHead>Después</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.key} data-changed={row.changed} className={row.changed ? 'bg-amber-500/10' : ''}>
                        <TableCell className="align-top font-mono text-xs">
                          {row.key}
                          {row.changed && <span className="sr-only"> (cambió)</span>}
                        </TableCell>
                        <TableCell className="align-top">{renderValue(row.before)}</TableCell>
                        <TableCell className="align-top">{renderValue(row.after)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        )}
        <SheetFooter className="border-t border-border px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
