'use client';

import * as React from 'react';
import { Button } from '@dss-monorepo/design-system';
import { FlaskConical, SlidersHorizontal } from 'lucide-react';

import {
  SEARCH_SPACE_PARAMETERS,
  parseGridValues,
  submitTrainingStudy,
  type MlJob,
  type MlTask,
  type SearchSpace,
} from '../../../data-access/ml-studio';
import { algorithmName, dateTime } from '../model-charts';
import { ErrorAlert, JobStatusBadge, Notice, Panel, errorMessage, jobError } from '../studio-ui';

type GridText = Record<string, Record<string, string>>;

/** Turns the optional grids into search_spaces; returns an error message when a value is invalid. */
export function buildSearchSpaces(algorithms: string[], grids: GridText): Record<string, SearchSpace> | string {
  const spaces: Record<string, SearchSpace> = {};
  for (const algorithm of algorithms) {
    const space: SearchSpace = {};
    for (const [name, text] of Object.entries(grids[algorithm] ?? {})) {
      if (!text.trim()) continue;
      const values = parseGridValues(text);
      if (!values) return `${algorithmName(algorithm)} · ${name}: escribe hasta 10 números separados por coma.`;
      space[name] = values;
    }
    if (Object.keys(space).length) spaces[algorithm] = space;
  }
  return spaces;
}

/**
 * Step 4: one training job per selected algorithm on the dataset, grouped as a study. Each job
 * tunes its hyperparameters with temporal, student-grouped cross-validation.
 */
export function TrainStep({
  task,
  datasetRef,
  studyId,
  jobs,
  jobsError,
  onStudy,
}: {
  task: MlTask;
  datasetRef: string;
  studyId: string | null;
  /** Jobs of the current study, polled by the wizard. */
  jobs: MlJob[];
  jobsError: string | null;
  onStudy: (studyId: string) => void;
}) {
  const [selected, setSelected] = React.useState<string[]>(task.algorithms);
  const [advanced, setAdvanced] = React.useState(false);
  const [grids, setGrids] = React.useState<GridText>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggle(algorithm: string) {
    setSelected((current) =>
      current.includes(algorithm) ? current.filter((item) => item !== algorithm) : [...current, algorithm],
    );
  }

  async function train(event: React.FormEvent) {
    event.preventDefault();
    if (selected.length === 0) {
      setError('Elige al menos un algoritmo.');
      return;
    }
    const spaces = advanced ? buildSearchSpaces(selected, grids) : {};
    if (typeof spaces === 'string') {
      setError(spaces);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const study = await submitTrainingStudy({
        dataset_ref: datasetRef,
        algorithms: selected,
        ...(Object.keys(spaces).length ? { search_spaces: spaces } : {}),
      });
      onStudy(study.study_id);
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo iniciar el entrenamiento.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Algoritmos"
        description={`Se entrena un candidato por algoritmo sobre ${datasetRef}. La selección de hiperparámetros usa solo validación cruzada; la prueba final queda para comparar.`}
      >
        <form className="space-y-5" onSubmit={(event) => void train(event)}>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="sr-only">Algoritmos</legend>
            {task.algorithms.map((algorithm) => (
              <label
                key={algorithm}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                  selected.includes(algorithm) ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(algorithm)}
                  onChange={() => toggle(algorithm)}
                  className="size-4 accent-primary"
                />
                {algorithmName(algorithm)}
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            aria-expanded={advanced}
            onClick={() => setAdvanced((value) => !value)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            {advanced ? 'Usar la grilla por defecto' : 'Ajustar hiperparámetros (opcional)'}
          </button>

          {advanced && (
            <div className="grid gap-5 lg:grid-cols-3">
              {selected.map((algorithm) => (
                <fieldset key={algorithm} className="space-y-3 rounded-lg border border-border p-4">
                  <legend className="px-1 text-sm font-semibold">{algorithmName(algorithm)}</legend>
                  {(SEARCH_SPACE_PARAMETERS[algorithm] ?? []).map((parameter) => (
                    <label key={parameter.name} className="block space-y-1 text-sm">
                      <span className="font-mono text-xs">{parameter.label}</span>
                      <input
                        aria-label={`${algorithmName(algorithm)} ${parameter.label}`}
                        value={grids[algorithm]?.[parameter.name] ?? ''}
                        onChange={(event) =>
                          setGrids((current) => ({
                            ...current,
                            [algorithm]: { ...current[algorithm], [parameter.name]: event.target.value },
                          }))
                        }
                        placeholder={parameter.hint}
                        className="h-9 w-full rounded-md border border-input bg-background px-3"
                      />
                    </label>
                  ))}
                </fieldset>
              ))}
              <p className="text-xs text-muted-foreground lg:col-span-3">
                Los campos vacíos usan la grilla por defecto. Máximo 10 valores por parámetro y 64 combinaciones.
              </p>
            </div>
          )}

          <ErrorAlert message={error} />
          <Button type="submit" disabled={submitting || selected.length === 0}>
            <FlaskConical aria-hidden="true" className="mr-2 size-4" />
            {submitting ? 'Enviando…' : studyId ? 'Entrenar otra vez' : 'Entrenar candidatos'}
          </Button>
        </form>
      </Panel>

      {studyId && (
        <Panel title="Entrenamientos del estudio" description={<span className="font-mono text-xs">{studyId}</span>}>
          <ErrorAlert message={jobsError} />
          {jobs.length === 0 ? (
            <Notice>Esperando a que el servicio registre los jobs…</Notice>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {jobs.map((job) => (
                <li key={job.job_id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="w-40 font-medium">{algorithmName(job.algorithm)}</span>
                  <JobStatusBadge status={job.status} />
                  <span className="text-xs text-muted-foreground">{dateTime(job.created_at)}</span>
                  {jobError(job) && <span className="w-full text-xs text-destructive">{jobError(job)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
