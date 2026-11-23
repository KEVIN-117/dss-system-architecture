'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@dss-monorepo/design-system';
import {
  CircleAlert,
  CircleCheck,
  History,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

import {
  createEtlSchedule,
  deleteEtlSchedule,
  getLoadManagerCapabilities,
  listEtlLaunches,
  listEtlProcesses,
  listEtlSchedules,
  previewEtlSchedule,
  setEtlScheduleEnabled,
  updateEtlSchedule,
  type EtlLaunch,
  type EtlProcess,
  type EtlSchedule,
  type LoadManagerCapabilities,
  type SchedulePreview,
} from '../data-access/load-manager';
import { dateLabel, relativeLabel } from './etl/etl-format';
import { StatusPill } from './etl/EtlUi';
import { CRON_PRESETS, LAUNCH_STATUS_META, processLabel } from './etl/load-manager-format';

const DEFAULT_TIMEZONE = 'America/La_Paz';

function message(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export function AdminEtlSchedulesPage() {
  const [capabilities, setCapabilities] = React.useState<LoadManagerCapabilities | null>(null);
  const [schedules, setSchedules] = React.useState<EtlSchedule[]>([]);
  const [processes, setProcesses] = React.useState<EtlProcess[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editor, setEditor] = React.useState<{ schedule: EtlSchedule | null } | null>(null);
  const [toDelete, setToDelete] = React.useState<EtlSchedule | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [historyOf, setHistoryOf] = React.useState<EtlSchedule | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    getLoadManagerCapabilities(controller.signal)
      .then(setCapabilities)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(message(cause, 'No se pudo verificar el acceso.'));
      });
    return () => controller.abort();
  }, []);

  const canRead = capabilities?.canReadEtlExecutions === true;
  const canManage = capabilities?.canManageEtlSchedules === true;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nextSchedules, nextProcesses] = await Promise.all([listEtlSchedules(), listEtlProcesses()]);
      setSchedules(nextSchedules);
      setProcesses(nextProcesses);
      setError(null);
    } catch (cause) {
      setError(message(cause, 'No se pudieron cargar las programaciones.'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  async function toggle(schedule: EtlSchedule) {
    setBusyId(schedule.id);
    try {
      const updated = await setEtlScheduleEnabled(schedule.id, !schedule.enabled, schedule.rowVersion);
      setSchedules((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setError(null);
    } catch (cause) {
      setError(message(cause, 'No se pudo cambiar el estado de la programación.'));
      void load();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteEtlSchedule(toDelete.id, toDelete.rowVersion);
      setSchedules((current) => current.filter((item) => item.id !== toDelete.id));
      setToDelete(null);
    } catch (cause) {
      setError(message(cause, 'No se pudo eliminar la programación.'));
      setToDelete(null);
      void load();
    } finally {
      setDeleting(false);
    }
  }

  if (capabilities && !canRead)
    return (
      <section className="m-6 rounded-md border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no tiene permiso para consultar las programaciones ETL.
        </p>
      </section>
    );

  return (
    <section className="space-y-6 p-4 md:p-6" aria-labelledby="schedules-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Servicio de control del almacén de datos · Load Manager</p>
          <h1 id="schedules-title" className="mt-1 text-2xl font-semibold">Programaciones ETL</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Actualizaciones automáticas del Data Warehouse. Solo se aceptan horarios fuera del
            horario operativo de la DSA, y cada disparo queda registrado con su fecha y resultado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={loading} onClick={() => void load()}>
            <RefreshCw aria-hidden="true" className={`mr-2 size-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />
            Actualizar
          </Button>
          {canManage ? (
            <Button onClick={() => setEditor({ schedule: null })}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              Nueva programación
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Proceso</TableHead>
              <TableHead>Cron</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Próxima ejecución</TableHead>
              <TableHead>Último disparo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  {loading ? 'Cargando…' : 'No hay programaciones. Crea una para actualizar el DW por la noche o el fin de semana.'}
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-sans font-medium">{schedule.name}</TableCell>
                  <TableCell className="font-sans text-sm">{processLabel(schedule.processCode, processes)}</TableCell>
                  <TableCell className="font-sans">
                    <code className="whitespace-nowrap text-xs">{schedule.cronExpression}</code>
                    <p className="text-xs text-muted-foreground">{schedule.timezone}</p>
                  </TableCell>
                  <TableCell className="font-sans">
                    {schedule.firing ? (
                      <StatusPill size="sm" tone="running" label="Disparando" />
                    ) : schedule.enabled ? (
                      <StatusPill size="sm" tone="success" label="Activa" />
                    ) : (
                      <StatusPill size="sm" tone="neutral" label="Pausada" />
                    )}
                  </TableCell>
                  <TableCell className="font-sans whitespace-nowrap text-sm">
                    {schedule.nextFireAt ? (
                      <span title={relativeLabel(schedule.nextFireAt)}>{dateLabel(schedule.nextFireAt)}</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="font-sans whitespace-nowrap text-sm">
                    {schedule.lastLaunchId ? (
                      <Link href={`/etl/launches/${schedule.lastLaunchId}`} className="text-primary hover:underline">
                        {dateLabel(schedule.lastFiredAt)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="font-sans">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setHistoryOf(schedule)} aria-label={`Historial de ${schedule.name}`}>
                        <History aria-hidden="true" className="size-4" />
                      </Button>
                      {canManage ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={schedule.firing}
                            onClick={() => setEditor({ schedule })}
                            aria-label={`Editar ${schedule.name}`}
                          >
                            <Pencil aria-hidden="true" className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={busyId === schedule.id}
                            disabled={schedule.firing}
                            onClick={() => void toggle(schedule)}
                            aria-label={`${schedule.enabled ? 'Pausar' : 'Activar'} ${schedule.name}`}
                          >
                            {schedule.enabled ? (
                              <Pause aria-hidden="true" className="size-4" />
                            ) : (
                              <Play aria-hidden="true" className="size-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={schedule.firing}
                            onClick={() => setToDelete(schedule)}
                            aria-label={`Eliminar ${schedule.name}`}
                          >
                            <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!canManage && capabilities ? (
        <p className="text-xs text-muted-foreground">
          Para crear o modificar programaciones se requiere el permiso dw:etl-schedule:manage.
        </p>
      ) : null}

      {editor ? (
        <ScheduleEditor
          schedule={editor.schedule}
          processes={processes.filter((process) => process.schedulable)}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            setSchedules((current) =>
              current.some((item) => item.id === saved.id)
                ? current.map((item) => (item.id === saved.id ? saved : item))
                : [...current, saved],
            );
            setEditor(null);
          }}
        />
      ) : null}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar programación</DialogTitle>
            <DialogDescription>
              «{toDelete?.name}» dejará de dispararse. Su historial de ejecuciones se conserva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" loading={deleting} onClick={() => void confirmDelete()}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FireHistory schedule={historyOf} onClose={() => setHistoryOf(null)} />
    </section>
  );
}

/** Create or edit a schedule with a live preview against the DSA operating hours. */
function ScheduleEditor({
  schedule,
  processes,
  onClose,
  onSaved,
}: {
  schedule: EtlSchedule | null;
  processes: EtlProcess[];
  onClose: () => void;
  onSaved: (schedule: EtlSchedule) => void;
}) {
  const [processCode, setProcessCode] = React.useState(schedule?.processCode ?? processes[0]?.code ?? '');
  const [name, setName] = React.useState(schedule?.name ?? '');
  const [cron, setCron] = React.useState(schedule?.cronExpression ?? CRON_PRESETS[0].cron);
  const [timezone, setTimezone] = React.useState(schedule?.timezone ?? DEFAULT_TIMEZONE);
  const [preview, setPreview] = React.useState<SchedulePreview | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const trimmed = cron.trim();
    if (trimmed.split(/\s+/).length !== 6) {
      setPreview(null);
      setPreviewError('La expresión debe tener seis campos: segundo minuto hora día mes día-de-semana.');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      previewEtlSchedule(trimmed, timezone.trim() || undefined, 6, controller.signal)
        .then((result) => {
          setPreview(result);
          setPreviewError(null);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setPreview(null);
          setPreviewError(message(cause, 'No se pudo calcular la vista previa.'));
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cron, timezone]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = schedule
        ? await updateEtlSchedule(schedule.id, {
            name: name.trim(),
            cronExpression: cron.trim(),
            timezone: timezone.trim() || undefined,
            rowVersion: schedule.rowVersion,
          })
        : await createEtlSchedule({
            processCode,
            name: name.trim(),
            cronExpression: cron.trim(),
            timezone: timezone.trim() || undefined,
          });
      onSaved(saved);
    } catch (cause) {
      setError(message(cause, 'No se pudo guardar la programación.'));
    } finally {
      setSaving(false);
    }
  }

  const selected = processes.find((process) => process.code === processCode);
  const valid = preview?.valid === true;
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{schedule ? 'Editar programación' : 'Nueva programación'}</DialogTitle>
          <DialogDescription>
            Las cargas programadas deben ejecutarse fuera del horario operativo de la DSA.
          </DialogDescription>
        </DialogHeader>
        <form id="etl-schedule-form" onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="schedule-process" className="text-sm font-medium">Proceso</label>
            <Select
              id="schedule-process"
              value={processCode}
              disabled={schedule !== null}
              onChange={(event) => setProcessCode(event.target.value)}
            >
              {schedule && !processes.some((process) => process.code === schedule.processCode) ? (
                <option value={schedule.processCode}>{processLabel(schedule.processCode)}</option>
              ) : null}
              {processes.map((process) => (
                <option key={process.code} value={process.code}>{process.displayName}</option>
              ))}
            </Select>
            {selected?.scheduleMode === 'AUTO_PENDING_CLOSURES' ? (
              <p className="text-xs text-muted-foreground">
                En cada disparo se carga el cierre académico CERRADO más antiguo que aún no se procesó. Si
                no hay ninguno, el disparo queda registrado como omitido.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="schedule-name" className="text-sm font-medium">
              Nombre <span aria-hidden="true">*</span>
            </label>
            <Input
              id="schedule-name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Carga nocturna del DW"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="space-y-1.5">
              <label htmlFor="schedule-cron" className="text-sm font-medium">
                Expresión cron <span aria-hidden="true">*</span>
              </label>
              <Input
                id="schedule-cron"
                required
                maxLength={120}
                value={cron}
                onChange={(event) => setCron(event.target.value)}
                className="font-mono"
                aria-describedby="schedule-cron-help"
              />
              <p id="schedule-cron-help" className="text-xs text-muted-foreground">
                Seis campos: segundo minuto hora día mes día-de-semana. Ej. <code>0 0 2 * * *</code>.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="schedule-timezone" className="text-sm font-medium">Zona horaria</label>
              <Input
                id="schedule-timezone"
                maxLength={64}
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CRON_PRESETS.map((preset) => (
              <Button
                key={preset.cron}
                type="button"
                size="xs"
                variant={cron.trim() === preset.cron ? 'secondary' : 'outline'}
                onClick={() => setCron(preset.cron)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <section aria-live="polite" className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">Próximas ejecuciones</p>
            {previewError ? (
              <p className="text-sm text-destructive">{previewError}</p>
            ) : preview ? (
              <>
                <p className={`flex items-start gap-1.5 text-sm ${valid ? 'text-success' : 'text-destructive'}`}>
                  {valid ? (
                    <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  )}
                  {valid ? 'Fuera del horario operativo de la DSA.' : preview.validationMessage}
                </p>
                <ul className="space-y-1 text-sm">
                  {preview.occurrences.map((occurrence) => (
                    <li
                      key={occurrence.at}
                      className={occurrence.insideOperatingWindow ? 'text-destructive' : 'text-muted-foreground'}
                    >
                      {dateLabel(occurrence.at)}
                      {occurrence.insideOperatingWindow ? ' · dentro del horario DSA' : ''}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Horario DSA: {preview.operatingWindow}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Calculando…</p>
            )}
          </section>

          {error ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="etl-schedule-form" loading={saving} disabled={!valid || !processCode}>
            {schedule ? 'Guardar cambios' : 'Crear programación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Fire history of a schedule: date and result of each fire, including skipped ones. */
function FireHistory({ schedule, onClose }: { schedule: EtlSchedule | null; onClose: () => void }) {
  const [items, setItems] = React.useState<EtlLaunch[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!schedule) return;
    setItems(null);
    setError(null);
    const controller = new AbortController();
    listEtlLaunches({ scheduleId: schedule.id, page: 0, size: 30 }, controller.signal)
      .then((page) => setItems(page.items))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(message(cause, 'No se pudo cargar el historial.'));
      });
    return () => controller.abort();
  }, [schedule]);

  return (
    <Sheet open={schedule !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Historial · {schedule?.name}</SheetTitle>
          <SheetDescription>Fecha y resultado de cada disparo, incluidos los omitidos.</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 p-4">
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {items === null && !error ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
          {items?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta programación todavía no se disparó.</p>
          ) : null}
          <ul className="space-y-2">
            {items?.map((launch) => (
              <li key={launch.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/etl/launches/${launch.id}`} className="text-sm font-medium hover:underline">
                    {dateLabel(launch.requestedAt)}
                  </Link>
                  <StatusPill size="sm" {...LAUNCH_STATUS_META[launch.status]} />
                </div>
                {launch.resultSummary ? (
                  <p className="mt-1 text-xs text-muted-foreground">{launch.resultSummary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
