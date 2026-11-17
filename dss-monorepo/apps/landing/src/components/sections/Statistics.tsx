"use client";

import { motion } from "motion/react";
import { Brain, Database, IdentificationBadge, SquaresFour } from "@phosphor-icons/react";

const stats = [
  {
    icon: Database,
    value: "1",
    label: "Data Warehouse",
    detail: "Esquema estrella con el historial académico de todas las facultades.",
  },
  {
    icon: Brain,
    value: "2",
    label: "Modelos predictivos",
    detail: "Bajo rendimiento y deserción, entrenados con scikit-learn y XGBoost.",
  },
  {
    icon: SquaresFour,
    value: "4",
    label: "Tableros por rol",
    detail: "Rectorado, decanatos, direcciones de carrera y administración.",
  },
  {
    icon: IdentificationBadge,
    value: "100%",
    label: "Acceso institucional",
    detail: "Ingreso con cuenta UATF y permisos por facultad y carrera.",
  },
];

export function Statistics() {
  return (
    <section aria-labelledby="stats-title" className="relative bg-background py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <h2 id="stats-title" className="sr-only">
          Qué integra el DSS académico
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.li
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-6 transition-colors duration-300 hover:border-uatf-accent/50"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-uatf-sky/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100 md:opacity-60"
              />
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-uatf-accent/10 text-uatf-accent-text">
                  <stat.icon weight="duotone" className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums md:text-5xl">
                  {stat.value}
                </span>
              </div>
              <p className="mt-6 text-base font-semibold text-foreground">{stat.label}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{stat.detail}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
