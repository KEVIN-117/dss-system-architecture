'use client';

import * as React from 'react';
import { Button, Loader, Select } from '@dss-monorepo/design-system';
import { Plus, Trash2 } from 'lucide-react';
import {
  getAcademicCatalog,
  replaceAdminUserContexts,
  type AcademicCatalog,
  type AcademicContext,
  type AdminUserDirectoryEntry,
} from '../data-access/auth-admin';

/** auth-service accepts at most this many contexts per user (IAM-009). */
export const MAX_CONTEXTS = 20;

interface Entry {
  key: number;
  facultyId: string;
  careerId: string;
}

interface AcademicContextsPanelProps {
  user: AdminUserDirectoryEntry;
  canWrite: boolean;
  onSaved: (contexts: AcademicContext[]) => void;
}

/**
 * Several academic contexts per user (IAM-009): faculty scope (analytics:faculty) holds one or more faculties,
 * career scope (analytics:career) one or more careers. The scope comes from `user.academicScope`, not from role names. The whole list replaces the current one in a single call.
 */
export function AcademicContextsPanel({ user, canWrite, onSaved }: AcademicContextsPanelProps) {
  const scope = user.academicScope;
  const needsCareer = scope === 'CAREER';
  const usesContexts = scope === 'FACULTY' || scope === 'CAREER';
  const nextKey = React.useRef(0);
  const toEntries = React.useCallback((contexts: AcademicContext[]): Entry[] =>
    contexts.map((context) => ({
      key: nextKey.current++,
      facultyId: context.facultyId === null ? '' : String(context.facultyId),
      careerId: context.careerId ?? '',
    })), []);
  const [entries, setEntries] = React.useState<Entry[]>(() => toEntries(user.academicContexts));
  const [catalog, setCatalog] = React.useState<AcademicCatalog | null>(null);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadCatalog = React.useCallback(() => {
    setCatalogError(null);
    getAcademicCatalog()
      .then(setCatalog)
      .catch((cause: unknown) =>
        setCatalogError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo académico.'));
  }, []);

  React.useEffect(() => {
    if (usesContexts) loadCatalog();
  }, [loadCatalog, usesContexts]);

  React.useEffect(() => {
    setEntries(toEntries(user.academicContexts));
    setError(null);
    setMessage(null);
  }, [toEntries, user.academicContexts, user.id]);

  if (!usesContexts) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm" role="status">
        <p className="font-medium">Este usuario no utiliza contexto académico.</p>
        <p className="mt-1 text-muted-foreground">
          {scope === 'GLOBAL'
            ? 'Ve todas las facultades (analytics:global) y no lleva contextos.'
            : 'Sus roles no tienen analytics:faculty ni analytics:career. Asígnale un rol con alguno de esos permisos para poder definir contextos.'}
        </p>
      </div>
    );
  }

  const update = (key: number, change: Partial<Entry>) =>
    setEntries((current) => current.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)));

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (entries.length === 0) {
      setError('Agrega al menos un contexto académico.');
      return;
    }
    if (entries.some((entry) => !entry.facultyId || (needsCareer && !entry.careerId))) {
      setError(needsCareer ? 'Cada contexto necesita facultad y carrera.' : 'Cada contexto necesita una facultad.');
      return;
    }
    const contexts = entries.map((entry) => ({
      facultyId: Number(entry.facultyId),
      careerId: needsCareer ? entry.careerId : null,
    }));
    const keys = contexts.map((context) => `${context.facultyId}/${context.careerId}`);
    if (new Set(keys).size !== keys.length) {
      setError('Hay contextos repetidos.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await replaceAdminUserContexts(user.id, contexts);
      onSaved(saved);
      setMessage('Contextos académicos actualizados.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los contextos.');
    } finally {
      setSaving(false);
    }
  };

  const facultyName = (id: string) =>
    catalog?.faculties.find((faculty) => String(faculty.id) === id)?.name ?? `Facultad ${id}`;

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-4" aria-label="Contextos académicos">
      <p className="text-sm text-muted-foreground">
        {needsCareer
          ? 'Alcance por carrera (analytics:career): elige una o más carreras. Ve los datos de todas ellas.'
          : 'Alcance por facultad (analytics:faculty): elige una o más facultades. Ve los datos de todas ellas.'}
      </p>
      {catalogError && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p>No se pudo cargar el catálogo académico: {catalogError}</p>
          <Button type="button" size="sm" variant="outline" onClick={loadCatalog}>Reintentar</Button>
        </div>
      )}
      {!catalog && !catalogError && (
        <Loader text="Cargando facultades y carreras…" fullScreen={false} className="min-h-24" />
      )}
      {catalog && (
        <ul className="space-y-3" aria-label="Contextos asignados">
          {entries.length === 0 && (
            <li className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Sin contextos asignados.</li>
          )}
          {entries.map((entry, index) => (
            <li key={entry.key} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
              <div className="min-w-40 flex-1 space-y-1">
                <label htmlFor={`context-faculty-${entry.key}`} className="text-xs font-medium">
                  Facultad {index + 1}
                </label>
                <Select
                  id={`context-faculty-${entry.key}`}
                  value={entry.facultyId}
                  disabled={!canWrite || saving}
                  onChange={(event) => update(entry.key, { facultyId: event.target.value, careerId: '' })}
                >
                  <option value="">Selecciona una facultad</option>
                  {catalog.faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                  ))}
                </Select>
              </div>
              {needsCareer && (
                <div className="min-w-40 flex-1 space-y-1">
                  <label htmlFor={`context-career-${entry.key}`} className="text-xs font-medium">
                    Carrera {index + 1}
                  </label>
                  <Select
                    id={`context-career-${entry.key}`}
                    value={entry.careerId}
                    disabled={!canWrite || saving || !entry.facultyId}
                    onChange={(event) => update(entry.key, { careerId: event.target.value })}
                  >
                    <option value="">{entry.facultyId ? 'Selecciona una carrera' : 'Primero elige la facultad'}</option>
                    {catalog.careers
                      .filter((career) => String(career.facultyId) === entry.facultyId)
                      .map((career) => (
                        <option key={`${career.facultyId}-${career.id}`} value={career.id}>{career.name}</option>
                      ))}
                  </Select>
                </div>
              )}
              {canWrite && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  aria-label={`Quitar ${entry.facultyId ? facultyName(entry.facultyId) : `contexto ${index + 1}`}`}
                  onClick={() => setEntries((current) => current.filter((item) => item.key !== entry.key))}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}
      {message && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">{message}</p>}
      {canWrite && catalog && (
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || entries.length >= MAX_CONTEXTS}
            onClick={() =>
              setEntries((current) => [...current, { key: nextKey.current++, facultyId: '', careerId: '' }])}
          >
            <Plus aria-hidden="true" className="size-4" />
            {needsCareer ? 'Agregar carrera' : 'Agregar facultad'}
          </Button>
          <Button type="submit" size="sm" loading={saving} disabled={saving}>Guardar contextos</Button>
        </div>
      )}
    </form>
  );
}
