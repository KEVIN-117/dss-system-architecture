'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Loader } from '@dss-monorepo/design-system';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react';

import { isJobActive, listMlTasks, type MlTask } from '../../../data-access/ml-studio';
import { ErrorAlert, errorMessage, useStudyJobs } from '../studio-ui';
import { ActivateStep } from './ActivateStep';
import { CompareStep, studyCandidateIds } from './CompareStep';
import { DataStep } from './DataStep';
import { ExploreStep } from './ExploreStep';
import { TaskStep } from './TaskStep';
import { TrainStep } from './TrainStep';

export const STUDIO_STEPS = [
  { id: 'task', title: 'Objetivo' },
  { id: 'data', title: 'Datos' },
  { id: 'explore', title: 'Explorar' },
  { id: 'train', title: 'Entrenar' },
  { id: 'compare', title: 'Comparar' },
  { id: 'activate', title: 'Activar' },
] as const;
export type StudioStepId = (typeof STUDIO_STEPS)[number]['id'];

export interface StudioState {
  step: StudioStepId;
  taskCode: string | null;
  extractionJobId: string | null;
  datasetRef: string | null;
  studyId: string | null;
  modelId: string | null;
}

const EMPTY_STATE: StudioState = {
  step: 'task',
  taskCode: null,
  extractionJobId: null,
  datasetRef: null,
  studyId: null,
  modelId: null,
};

/** Only ids are kept between reloads; jobs, datasets and models live in prediction-service. */
const STORAGE_KEY = 'dss.admin.ml-studio.v1';

function readStoredState(): StudioState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StudioState>;
    const step = STUDIO_STEPS.some((item) => item.id === parsed.step) ? (parsed.step as StudioStepId) : 'task';
    const text = (value: unknown) => (typeof value === 'string' && value.length <= 256 ? value : null);
    return {
      step,
      taskCode: text(parsed.taskCode),
      extractionJobId: text(parsed.extractionJobId),
      datasetRef: text(parsed.datasetRef),
      studyId: text(parsed.studyId),
      modelId: text(parsed.modelId),
    };
  } catch {
    return EMPTY_STATE;
  }
}

function storeState(state: StudioState): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode); the wizard still works for this visit.
  }
}

/** Whether a step can be opened with the choices made so far. */
export function stepAvailable(step: StudioStepId, state: StudioState, candidates: number): boolean {
  switch (step) {
    case 'task':
      return true;
    case 'data':
      return state.taskCode !== null;
    case 'explore':
    case 'train':
      return state.taskCode !== null && state.datasetRef !== null;
    case 'compare':
      return state.studyId !== null && candidates > 0;
    case 'activate':
      return state.modelId !== null;
  }
}

/**
 * ML Studio (PRED-107): guided lifecycle of a model from the admin portal: choose the target,
 * extract the dataset from the warehouse, explore it, train several algorithms, compare them and
 * activate one (with rollback and history). Forecast targets open the forecasts page instead.
 */
export function MlStudioPage() {
  const [tasks, setTasks] = React.useState<MlTask[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<StudioState>(EMPTY_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    // ?task=CODE&dataset=REF opens a dataset uploaded from Operaciones ML directly in the Explore step.
    const params = new URLSearchParams(window.location.search);
    const taskCode = params.get('task');
    const dataset = params.get('dataset');
    setState(
      taskCode && dataset && taskCode.length <= 64 && dataset.length <= 256
        ? { ...EMPTY_STATE, taskCode, datasetRef: dataset, step: 'explore' }
        : readStoredState(),
    );
    setHydrated(true);
  }, []);
  React.useEffect(() => {
    if (hydrated) storeState(state);
  }, [state, hydrated]);

  const loadTasks = React.useCallback(async () => {
    setError(null);
    try {
      setTasks(await listMlTasks());
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo leer el catálogo de objetivos.'));
    }
  }, []);
  React.useEffect(() => void loadTasks(), [loadTasks]);

  const { jobs, error: jobsError } = useStudyJobs(state.studyId);
  const candidates = studyCandidateIds(jobs).length;
  const task = tasks?.find((item) => item.code === state.taskCode) ?? null;
  const stepIndex = STUDIO_STEPS.findIndex((item) => item.id === state.step);
  const next = STUDIO_STEPS[stepIndex + 1];
  const previous = STUDIO_STEPS[stepIndex - 1];
  const trainingRunning = jobs.some(isJobActive);

  const update = React.useCallback((patch: Partial<StudioState>) => setState((current) => ({ ...current, ...patch })), []);
  const goTo = (step: StudioStepId) => update({ step });

  const selectTask = (selected: MlTask) =>
    setState((current) =>
      current.taskCode === selected.code
        ? { ...current, step: 'data' }
        : { ...EMPTY_STATE, taskCode: selected.code, step: 'data' },
    );
  const selectDataset = React.useCallback(
    (datasetRef: string) =>
      setState((current) =>
        current.datasetRef === datasetRef ? current : { ...current, datasetRef, studyId: null, modelId: null },
      ),
    [],
  );
  const selectModel = React.useCallback((modelId: string) => update({ modelId }), [update]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-7 p-5 sm:p-7" aria-labelledby="ml-studio-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles aria-hidden="true" className="size-4" /> DSS · aprendizaje automático
          </p>
          <h1 id="ml-studio-title" className="text-3xl font-semibold tracking-tight">ML Studio</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Prepara los datos, entrena, compara y pon en servicio un modelo sin usar la consola.
            {task && (
              <>
                {' '}Objetivo actual: <span className="font-medium text-foreground">{task.title}</span>.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/ml-jobs" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
            Jobs ML
          </Link>
          <Button variant="outline" onClick={() => setState(EMPTY_STATE)} disabled={!state.taskCode}>
            <RotateCcw aria-hidden="true" className="mr-2 size-4" /> Empezar de nuevo
          </Button>
        </div>
      </header>

      <nav aria-label="Pasos de ML Studio">
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STUDIO_STEPS.map((item, index) => {
            const available = stepAvailable(item.id, state, candidates);
            const current = item.id === state.step;
            const done = index < stepIndex && available;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => goTo(item.id)}
                  disabled={!available}
                  aria-current={current ? 'step' : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    current ? 'border-primary bg-primary/10 font-semibold' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      done ? 'bg-primary text-primary-foreground' : current ? 'border-2 border-primary' : 'border border-border'
                    }`}
                  >
                    {done ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
                  </span>
                  {item.title}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <ErrorAlert message={error} />
      {!tasks && !error && <Loader text="Cargando el catálogo de objetivos…" fullScreen={false} className="py-16" />}

      {tasks && (
        <div>
          {state.step === 'task' && <TaskStep tasks={tasks} selectedCode={state.taskCode} onSelect={selectTask} />}
          {state.step === 'data' && task && (
            <DataStep
              task={task}
              extractionJobId={state.extractionJobId}
              datasetRef={state.datasetRef}
              onExtractionStarted={(jobId) => update({ extractionJobId: jobId })}
              onDataset={selectDataset}
            />
          )}
          {state.step === 'explore' && state.datasetRef && <ExploreStep datasetRef={state.datasetRef} />}
          {state.step === 'train' && task && state.datasetRef && (
            <TrainStep
              task={task}
              datasetRef={state.datasetRef}
              studyId={state.studyId}
              jobs={jobs}
              jobsError={jobsError}
              onStudy={(studyId) => update({ studyId, modelId: null })}
            />
          )}
          {state.step === 'compare' && <CompareStep jobs={jobs} selectedModelId={state.modelId} onSelect={selectModel} />}
          {state.step === 'activate' && state.modelId && <ActivateStep modelId={state.modelId} />}
          {state.step !== 'task' && !task && (
            <p className="text-sm text-muted-foreground">El objetivo elegido ya no está en el catálogo. Elige otro.</p>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button variant="outline" onClick={() => previous && goTo(previous.id)} disabled={!previous}>
          <ArrowLeft aria-hidden="true" className="mr-2 size-4" /> {previous ? previous.title : 'Atrás'}
        </Button>
        {state.step === 'train' && trainingRunning && (
          <span className="text-sm text-muted-foreground">Entrenando… puedes salir; los jobs siguen en el servicio.</span>
        )}
        {next && (
          <Button onClick={() => goTo(next.id)} disabled={!stepAvailable(next.id, state, candidates)}>
            {next.title} <ArrowRight aria-hidden="true" className="ml-2 size-4" />
          </Button>
        )}
      </footer>
    </section>
  );
}
