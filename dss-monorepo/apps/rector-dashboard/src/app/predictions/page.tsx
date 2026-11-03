'use client';

import { AccessDenied } from '@dss-monorepo/design-system';
import { ProtectedRoute } from '@dss-monorepo/auth';
import { RoleGuard } from '@dss-monorepo/rbac';
import { useCallback, useEffect, useState } from 'react';

type PredictionResult = {
  subject_ref: string;
  program_ref: string;
  closure_id: string | number;
  predicted_class: 'POSITIVE_EVENT' | 'NEGATIVE_EVENT';
  event_probability: number | null;
  model_id: string;
  model_version: string;
  generated_at: string;
};

type Publication = {
  batch_id: string;
  status: 'QUEUED' | 'RUNNING' | 'PUBLISHED' | 'FAILED';
  program_ref: string;
  closure_id: string | number;
  model_id: string;
  model_version: string;
  result_count: number;
  result_offset?: number;
  result_limit?: number;
  has_more?: boolean;
  created_at: string;
  published_at?: string | null;
  error?: { detail?: string; code?: string } | null;
  results?: PredictionResult[];
};

type AcademicOptions = {
  programs: { program_ref: string; name: string; faculty_id: number }[];
  cuts: { program_ref: string; cut_id: string; academic_year: number; academic_period: number; cadence: string }[];
};

function predictionBffUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BFF_URL?.replace(/\/$/, '');
  if (!base) throw new Error('El BFF no está configurado.');
  return `${base}/api/prediction/${path.replace(/^\//, '')}`;
}

export default function PredictionsPage() {
  const [programRef, setProgramRef] = useState('');
  const [cutId, setCutId] = useState('');
  const [academicOptions, setAcademicOptions] = useState<AcademicOptions>({ programs: [], cuts: [] });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadOptions = async () => {
      setOptionsLoading(true);
      try {
        const response = await fetch(predictionBffUrl('v1/academic-options'), {
          credentials: 'include',
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail ?? payload.error ?? 'No se pudieron cargar los programas autorizados.');
        const options = payload as AcademicOptions;
        if (cancelled) return;
        setAcademicOptions(options);
        const initialProgram = options.programs[0]?.program_ref ?? '';
        const initialCut = options.cuts.find((cut) => cut.program_ref === initialProgram)?.cut_id ?? '';
        setProgramRef(initialProgram);
        setCutId(initialCut);
        if (!initialProgram) setMessage('No hay programas con cierres procesados dentro de tu ámbito académico.');
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los programas autorizados.');
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    void loadOptions();
    return () => { cancelled = true; };
  }, []);

  const availableCuts = academicOptions.cuts.filter((cut) => cut.program_ref === programRef);

  const readCurrent = useCallback(async (requestedOffset = 0) => {
    if (!programRef.trim() || !cutId.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const bffBaseUrl = process.env.NEXT_PUBLIC_BFF_URL?.replace(/\/$/, '');
      if (!bffBaseUrl) throw new Error('El BFF no está configurado.');
      const response = await fetch(`${bffBaseUrl}/api/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          query: `query PredictionPublication($programRef: String!, $cutId: String!, $limit: Int, $offset: Int) {
            predictionPublication(programRef: $programRef, cutId: $cutId, limit: $limit, offset: $offset) { publication }
          }`,
          variables: { programRef: programRef.trim(), cutId: cutId.trim(), limit: 100, offset: requestedOffset },
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.[0]?.message ?? 'No se pudo consultar la publicación.');
      const result = payload.data?.predictionPublication?.publication ?? null;
      setPublication(result);
      setOffset(result?.result_offset ?? 0);
      if (!result) setMessage('No hay una publicación completa para este programa y corte.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al consultar las predicciones.');
    } finally {
      setLoading(false);
    }
  }, [programRef, cutId]);

  const submitBatch = async () => {
    if (!programRef.trim() || !cutId.trim()) {
      setMessage('Indica el programa y el identificador de un cierre procesado.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(predictionBffUrl('v1/prediction-batches'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        credentials: 'include',
        body: JSON.stringify({ contract_version: '1.0', event_type: 'program_dropout', program_ref: programRef.trim(), academic_cut: { cut_id: cutId.trim() } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? payload.error ?? 'No se pudo iniciar el cálculo.');
      setPublication(payload as Publication);
      setMessage('Cálculo encolado. La publicación aparecerá cuando el lote termine por completo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al iniciar el cálculo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!publication || !['QUEUED', 'RUNNING'].includes(publication.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(predictionBffUrl(`v1/prediction-batches/${publication.batch_id}`), { credentials: 'include', cache: 'no-store' });
        const payload = await response.json();
        if (response.ok) {
          setPublication(payload as Publication);
          if (payload.status === 'PUBLISHED') setMessage('Lote completo y publicado.');
          if (payload.status === 'FAILED') setMessage(payload.error?.detail ?? 'El cálculo falló; no se publicó un lote parcial.');
        }
      } catch {
        setMessage('No se pudo actualizar el estado del lote. Intenta consultar nuevamente.');
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [publication]);

  return (
    <ProtectedRoute unauthenticatedFallback={<LoginRequired />}>
      <RoleGuard rolesAllowed={['RECTOR', 'DECANO', 'DIRECTOR']} fallback={<AccessDenied portalName="del rector" logoutHref={`${process.env.NEXT_PUBLIC_BFF_URL}/api/auth/logout`} />}>
        <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 md:px-12">
          <div className="mx-auto max-w-7xl space-y-8">
            <header className="space-y-3">
              <a className="text-sm text-cyan-300 hover:underline" href="/">← Panel institucional</a>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">PRED-007 · Analítica autorizada</p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Riesgo de abandono del programa</h1>
              <p className="max-w-3xl text-slate-300">Consulta una publicación completa por programa y cierre. Las predicciones apoyan la revisión académica y no reemplazan decisiones institucionales.</p>
            </header>

            <section className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 md:grid-cols-[1fr_1fr_auto_auto] md:items-end" aria-label="Filtros de publicación">
              <label className="space-y-2 text-sm text-slate-300">Programa
                <select className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60" value={programRef} onChange={(event) => {
                  const nextProgram = event.target.value;
                  setProgramRef(nextProgram);
                  setCutId(academicOptions.cuts.find((cut) => cut.program_ref === nextProgram)?.cut_id ?? '');
                  setPublication(null);
                  setMessage('');
                }} disabled={optionsLoading || academicOptions.programs.length === 0}>
                  <option value="" disabled>{optionsLoading ? 'Cargando programas…' : 'Selecciona un programa'}</option>
                  {academicOptions.programs.map((program) => <option key={program.program_ref} value={program.program_ref}>{program.name} ({program.program_ref})</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">Cierre académico
                <select className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60" value={cutId} onChange={(event) => {
                  setCutId(event.target.value);
                  setPublication(null);
                  setMessage('');
                }} disabled={optionsLoading || availableCuts.length === 0}>
                  <option value="" disabled>{optionsLoading ? 'Cargando cierres…' : 'Selecciona un cierre'}</option>
                  {availableCuts.map((cut) => <option key={cut.cut_id} value={cut.cut_id}>Cierre {cut.cut_id} · Gestión {cut.academic_year} · Período {cut.academic_period} ({cut.cadence === 'ANUAL' ? 'Anual' : 'Semestral'})</option>)}
                </select>
              </label>
              <button className="rounded-lg border border-slate-600 px-4 py-2 font-medium hover:bg-slate-800 disabled:opacity-50" onClick={() => readCurrent()} disabled={loading || optionsLoading || !programRef || !cutId}>Consultar</button>
              <button className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-cyan-950 hover:bg-cyan-200 disabled:opacity-50" onClick={submitBatch} disabled={loading || optionsLoading || !programRef || !cutId}>Calcular y publicar</button>
            </section>

            {message && <p role="status" className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">{loading ? 'Procesando… ' : ''}{message}</p>}

            {publication && <section className="space-y-5" aria-live="polite">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Estado del lote" value={publication.status} />
                <Metric label="Estudiantes publicados" value={publication.status === 'PUBLISHED' ? String(publication.result_count) : '—'} />
                <Metric label="Corte" value={String(publication.closure_id)} />
                <Metric label="Modelo" value={`${publication.model_id} · ${publication.model_version}`} />
              </div>
              {publication.status === 'PUBLISHED' && <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-5 py-4">
                  <h2 className="font-semibold">Resultados del lote</h2>
                  <p className="mt-1 text-xs text-slate-400">Publicado {publication.published_at ? new Date(publication.published_at).toLocaleString() : '—'} · lote {publication.batch_id}</p>
                </div>
                {!publication.results?.length ? <p className="p-6 text-sm text-slate-400">El lote está completo, pero no contiene perfiles elegibles para este corte.</p> : <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Estudiante</th><th className="px-5 py-3">Programa</th><th className="px-5 py-3">Resultado</th><th className="px-5 py-3">Probabilidad</th><th className="px-5 py-3">Generada</th></tr></thead>
                    <tbody className="divide-y divide-slate-800">{publication.results.map((row) => <tr key={row.subject_ref}>
                      <td className="px-5 py-3 font-mono">{row.subject_ref}</td><td className="px-5 py-3">{row.program_ref}</td>
                      <td className="px-5 py-3">{row.predicted_class === 'POSITIVE_EVENT' ? 'Evento previsto' : 'Sin evento previsto'}</td>
                      <td className="px-5 py-3">{row.event_probability === null ? 'No disponible' : `${(row.event_probability * 100).toFixed(1)}%`}</td>
                      <td className="px-5 py-3 text-slate-400">{new Date(row.generated_at).toLocaleString()}</td>
                    </tr>)}</tbody>
                  </table>
                  <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
                    <span>Filas {offset + 1}–{Math.min(offset + (publication.results?.length ?? 0), publication.result_count)} de {publication.result_count}</span>
                    <div className="flex gap-2">
                      <button className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800 disabled:opacity-40" onClick={() => readCurrent(Math.max(0, offset - 100))} disabled={loading || offset === 0}>Anterior</button>
                      <button className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800 disabled:opacity-40" onClick={() => readCurrent(offset + 100)} disabled={loading || !publication.has_more}>Siguiente</button>
                    </div>
                  </div>
                </div>}
              </div>}
              {publication.status === 'FAILED' && <p className="rounded-lg border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">El lote falló y no se considera una publicación completa. Referencia: {publication.batch_id}</p>}
            </section>}

            <p className="text-xs leading-5 text-slate-500">La ejecución con Faker valida integración y controles de acceso; no demuestra calidad predictiva institucional ni autoriza el uso operativo de un modelo.</p>
          </div>
        </main>
      </RoleGuard>
    </ProtectedRoute>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 truncate text-lg font-semibold">{value}</p></div>;
}

function LoginRequired() {
  return <main className="grid min-h-screen place-content-center gap-3 bg-slate-950 p-8 text-slate-100"><h1 className="text-2xl font-semibold">Sesión requerida</h1><p>Inicia sesión para consultar las publicaciones analíticas.</p><a className="text-cyan-300 underline" href="/login">Iniciar sesión</a></main>;
}
