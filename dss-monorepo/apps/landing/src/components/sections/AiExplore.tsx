"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkle, MagnifyingGlass, ChartBar, Warning, TrendUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Demo = {
  question: string;
  icon: typeof ChartBar;
  answer: string;
  rows: { label: string; value: number; tone: "accent" | "sky" | "ribbon" }[];
  unit: string;
};

/* Respuestas de demostración: ilustran el tipo de consulta, no son datos reales. */
const demos: Demo[] = [
  {
    question: "¿Qué carreras tienen más estudiantes en riesgo esta gestión?",
    icon: Warning,
    answer: "Tres carreras concentran la mayor parte de las alertas tempranas de la gestión.",
    unit: "estudiantes con alerta",
    rows: [
      { label: "Carrera A", value: 86, tone: "ribbon" },
      { label: "Carrera B", value: 64, tone: "ribbon" },
      { label: "Carrera C", value: 41, tone: "accent" },
    ],
  },
  {
    question: "Compara la tasa de aprobación por facultad entre 1/2025 y 1/2026",
    icon: ChartBar,
    answer: "La aprobación sube en dos facultades y baja en una; el detalle está en el cubo OLAP.",
    unit: "% de aprobación",
    rows: [
      { label: "Facultad A", value: 78, tone: "sky" },
      { label: "Facultad B", value: 71, tone: "sky" },
      { label: "Facultad C", value: 58, tone: "accent" },
    ],
  },
  {
    question: "¿Cómo evolucionó la retención de la cohorte 2024?",
    icon: TrendUp,
    answer: "La retención de la cohorte se mantiene estable tras la segunda gestión.",
    unit: "% retenido",
    rows: [
      { label: "1/2024", value: 100, tone: "accent" },
      { label: "2/2024", value: 88, tone: "accent" },
      { label: "1/2025", value: 81, tone: "sky" },
    ],
  },
];

const toneClass = {
  accent: "bg-uatf-accent",
  sky: "bg-uatf-sky",
  ribbon: "bg-uatf-ribbon",
};

export function AiExplore() {
  const [active, setActive] = useState(0);
  const demo = demos[active];

  return (
    <section
      id="asistente"
      aria-labelledby="asistente-title"
      className="relative scroll-mt-24 overflow-hidden bg-background py-24 md:py-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-100 w-200 -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-uatf-accent/10 blur-[120px]"
      />

      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkle weight="fill" className="h-3.5 w-3.5 text-uatf-sky" aria-hidden="true" />
          Asistente IA
        </span>
        <h2
          id="asistente-title"
          className="mt-5 text-3xl font-bold tracking-tight text-foreground md:text-5xl"
        >
          Pregúntale a los datos de la UATF
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
          Un asistente sobre los cubos OLAP que responde en lenguaje natural y
          respeta los permisos de cada rol. Elige una pregunta de ejemplo.
        </p>
      </div>

      <div className="relative mx-auto mt-10 max-w-3xl px-5">
        {/* Barra de consulta (vista de demostración) */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-0.5 rounded-2xl bg-linear-to-r from-uatf-accent via-uatf-sky to-uatf-accent opacity-30 blur"
          />
          <div className="relative flex min-h-16 items-center gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 text-left shadow-xl">
            <MagnifyingGlass className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="flex-1 text-sm font-medium text-foreground md:text-base">
              {demo.question}
            </p>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-uatf-accent text-white">
              <Sparkle weight="fill" className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* Preguntas de ejemplo */}
        <div
          role="group"
          aria-label="Preguntas de ejemplo"
          className="mt-4 flex flex-wrap justify-center gap-2"
        >
          {demos.map((d, i) => (
            <button
              key={d.question}
              type="button"
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-left text-sm transition-colors",
                i === active
                  ? "border-uatf-accent bg-uatf-accent/10 text-foreground"
                  : "border-border/70 text-muted-foreground hover:border-uatf-accent/50 hover:text-foreground",
              )}
            >
              <d.icon weight="duotone" className="h-4 w-4 shrink-0 text-uatf-accent-text" aria-hidden="true" />
              <span className="line-clamp-1">{d.question}</span>
            </button>
          ))}
        </div>

        {/* Respuesta */}
        <div
          aria-live="polite"
          className="mt-6 rounded-2xl border border-border/70 bg-card/70 p-5 text-left backdrop-blur md:p-6"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-sm font-medium text-foreground md:text-base">{demo.answer}</p>
              <ul className="mt-5 flex flex-col gap-3">
                {demo.rows.map((row) => (
                  <li key={row.label} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-foreground/10">
                      <motion.span
                        className={cn("block h-full rounded-full", toneClass[row.tone])}
                        initial={{ width: 0 }}
                        animate={{ width: `${row.value}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </span>
                    <span className="text-right font-semibold tabular-nums text-foreground">{row.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                {demo.unit} · Respuesta de demostración, sin datos reales.
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
