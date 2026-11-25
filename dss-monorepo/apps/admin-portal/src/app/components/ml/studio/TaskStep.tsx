'use client';

import Link from 'next/link';
import { Badge } from '@dss-monorepo/design-system';
import { CheckCircle2, GraduationCap, LineChart, NotebookPen } from 'lucide-react';

import type { MlTask } from '../../../data-access/ml-studio';
import { KIND_LABELS, SUBJECT_LABELS } from '../studio-ui';

const SUBJECT_ORDER: Array<MlTask['subject']> = ['student', 'enrollment', 'series'];
const SUBJECT_ICONS = {
  student: GraduationCap,
  enrollment: NotebookPen,
  series: LineChart,
} as const;
const SUBJECT_HINTS: Record<MlTask['subject'], string> = {
  student: 'Una fila por estudiante, carrera y corte académico.',
  enrollment: 'Una fila por inscripción a una materia en un corte.',
  series: 'Conteos por carrera y periodo, proyectados con regresión lineal.',
};

/** Step 1: choose the target from the prediction-service catalog, grouped by what each row describes. */
export function TaskStep({
  tasks,
  selectedCode,
  onSelect,
}: {
  tasks: MlTask[];
  selectedCode: string | null;
  onSelect: (task: MlTask) => void;
}) {
  return (
    <div className="space-y-8">
      {SUBJECT_ORDER.map((subject) => {
        const group = tasks.filter((task) => task.subject === subject);
        if (group.length === 0) return null;
        const Icon = SUBJECT_ICONS[subject];
        return (
          <section key={subject} aria-labelledby={`subject-${subject}`} className="space-y-3">
            <div>
              <h2 id={`subject-${subject}`} className="flex items-center gap-2 font-semibold">
                <Icon aria-hidden="true" className="size-4 text-primary" /> {SUBJECT_LABELS[subject]}
              </h2>
              <p className="text-sm text-muted-foreground">{SUBJECT_HINTS[subject]}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.map((task) =>
                task.kind === 'forecast' ? (
                  <Link
                    key={task.code}
                    href={`/ml-forecasts?series=${encodeURIComponent(task.code)}`}
                    className="group flex flex-col rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/60"
                  >
                    <TaskCardBody task={task} />
                    <span className="mt-4 text-sm font-medium text-primary group-hover:underline">Abrir pronósticos →</span>
                  </Link>
                ) : (
                  <button
                    key={task.code}
                    type="button"
                    aria-pressed={task.code === selectedCode}
                    onClick={() => onSelect(task)}
                    className={`flex flex-col rounded-xl border p-5 text-left transition-colors hover:border-primary/60 ${
                      task.code === selectedCode ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'
                    }`}
                  >
                    <TaskCardBody task={task} selected={task.code === selectedCode} />
                  </button>
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskCardBody({ task, selected = false }: { task: MlTask; selected?: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{task.title}</h3>
        {selected && <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />}
      </div>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{task.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{KIND_LABELS[task.kind]}</Badge>
        {task.cadences.map((cadence) => (
          <Badge key={cadence} variant="outline">{cadence === 'SEMESTRAL' ? 'Semestral' : 'Anual'}</Badge>
        ))}
        {!task.servable && task.kind !== 'forecast' && <Badge variant="outline">Sin servicio en línea</Badge>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Objetivo: <span className="text-foreground">{task.target_label}</span>
        {task.target_unit ? ` (${task.target_unit})` : ''}
      </p>
    </>
  );
}
