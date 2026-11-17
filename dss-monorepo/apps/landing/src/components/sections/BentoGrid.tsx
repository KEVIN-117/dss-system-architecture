"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Brain, Cube, Database, ShieldCheck, ListMagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

function Card({
  className,
  index,
  children,
}: {
  className?: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: index * 0.08, ease }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-6 transition-colors duration-300 hover:border-uatf-accent/50 md:p-8",
        className,
      )}
    >
      {children}
    </motion.article>
  );
}

function CardHeader({
  icon: Icon,
  tag,
  title,
  text,
}: {
  icon: typeof Brain;
  tag: string;
  title: string;
  text: string;
}) {
  return (
    <div className="relative z-10">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-uatf-accent/10 text-uatf-accent-text">
          <Icon weight="duotone" className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold text-uatf-sky-text">{tag}</span>
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-tight text-foreground md:text-2xl">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">{text}</p>
    </div>
  );
}

const riesgo = [
  { label: "Asistencia", value: 72 },
  { label: "Materias reprobadas", value: 58 },
  { label: "Promedio de admisión", value: 34 },
];

export function BentoGrid() {
  return (
    <section
      id="prediccion"
      aria-labelledby="prediccion-title"
      className="relative scroll-mt-24 bg-background py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center md:mb-20">
          <h2
            id="prediccion-title"
            className="text-3xl font-bold tracking-tight text-foreground md:text-5xl"
          >
            Del dato a la alerta temprana
          </h2>
          <p className="mt-5 text-base text-muted-foreground md:text-lg">
            Data Warehouse, OLAP y machine learning trabajando juntos para que
            cada autoridad de la UATF actúe antes del abandono.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
          {/* Predicción: tarjeta principal */}
          <Card index={0} className="md:col-span-4 md:row-span-2">
            <CardHeader
              icon={Brain}
              tag="Machine learning"
              title="Predicción de rendimiento y deserción"
              text="Modelos entrenados con el historial académico estiman el riesgo de cada estudiante y explican qué factores pesan, para que la tutoría llegue a tiempo."
            />
            <div className="relative z-10 mt-8 grid gap-6 md:mt-auto md:grid-cols-[1fr_auto] md:items-end md:pt-10">
              <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">Factores de la alerta</span>
                  <span className="rounded-full bg-uatf-ribbon/10 px-2.5 py-0.5 text-xs font-semibold text-uatf-ribbon-text">
                    Riesgo alto
                  </span>
                </div>
                <ul className="mt-4 flex flex-col gap-3">
                  {riesgo.map((f, i) => (
                    <li key={f.label} className="text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{f.label}</span>
                        <span className="tabular-nums">{f.value}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/10">
                        <motion.div
                          className={cn("h-full rounded-full", i === 0 ? "bg-uatf-ribbon" : "bg-uatf-accent")}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${f.value}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: 0.2 + i * 0.1, ease }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">Ejemplo ilustrativo</p>
              </div>
              <div className="relative mx-auto hidden h-44 w-44 md:block" aria-hidden="true">
                <div className="absolute inset-0 rounded-full bg-uatf-sky/20 blur-2xl" />
                <Image
                  src="/images/asset_brain.jpg"
                  alt=""
                  fill
                  sizes="176px"
                  className="rounded-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105 dark:mix-blend-screen"
                />
              </div>
            </div>
          </Card>

          {/* Data Warehouse */}
          <Card index={1} className="md:col-span-2">
            <CardHeader
              icon={Database}
              tag="Datos"
              title="Data Warehouse"
              text="Inscripciones, notas y admisiones en un esquema estrella sobre PostgreSQL, cargado con Apache Hop."
            />
          </Card>

          {/* OLAP */}
          <Card index={2} className="md:col-span-2">
            <CardHeader
              icon={Cube}
              tag="Análisis"
              title="Cubos OLAP"
              text="Sube al total de la universidad o baja hasta un paralelo."
            />
            <ul className="relative z-10 mt-5 flex flex-wrap gap-2" aria-label="Dimensiones del cubo">
              {["Gestión", "Facultad", "Carrera", "Materia", "Cohorte"].map((d) => (
                <li
                  key={d}
                  className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium text-foreground/80"
                >
                  {d}
                </li>
              ))}
            </ul>
          </Card>

          {/* Explicabilidad */}
          <Card index={3} className="md:col-span-3">
            <CardHeader
              icon={ListMagnifyingGlass}
              tag="Transparencia"
              title="Alertas explicables"
              text="Cada alerta muestra sus razones. La predicción orienta; la decisión siempre es de una persona: el docente, el director o el decano."
            />
          </Card>

          {/* Seguridad */}
          <Card index={4} className="md:col-span-3">
            <CardHeader
              icon={ShieldCheck}
              tag="Acceso"
              title="Seguridad por rol"
              text="Ingreso con cuenta institucional. Rector, decanos y directores ven solo su facultad o su carrera."
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 opacity-40 transition-opacity duration-500 group-hover:opacity-70"
            >
              <Image
                src="/images/asset_shield.jpg"
                alt=""
                fill
                sizes="160px"
                className="rounded-full object-cover mix-blend-multiply dark:mix-blend-screen"
              />
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
