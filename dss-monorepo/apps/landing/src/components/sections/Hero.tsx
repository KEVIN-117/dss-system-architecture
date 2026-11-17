"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Brain,
  Cube,
  Database,
  Sparkle,
  ChalkboardTeacher,
  Bank,
  Student,
  UserGear,
  ChartBar,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

const features = [
  {
    icon: Database,
    title: "Data Warehouse",
    text: "Inscripciones, notas y admisiones de todas las facultades en una sola fuente histórica.",
    href: "#plataforma",
  },
  {
    icon: Cube,
    title: "Cubos OLAP",
    text: "Cruza gestión, facultad, carrera y materia sin escribir consultas.",
    href: "#plataforma",
  },
  {
    icon: Brain,
    title: "Machine Learning",
    text: "Modelos que estiman el riesgo de bajo rendimiento y de deserción.",
    href: "#prediccion",
  },
  {
    icon: Sparkle,
    title: "Asistente IA",
    text: "Pregunta en lenguaje natural y obtén reportes en segundos.",
    href: "#asistente",
  },
];

const roles = [
  { icon: Bank, label: "Rectorado" },
  { icon: ChalkboardTeacher, label: "Decanatos" },
  { icon: Student, label: "Direcciones de carrera" },
  { icon: UserGear, label: "Administración" },
  { icon: ChartBar, label: "Analistas OLAP" },
];

/* Paneles flotantes de la escena: datos ilustrativos, no reales. */
function Panel({
  className,
  delay,
  children,
}: {
  className?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay, ease }}
      className={cn("absolute z-20", className)}
    >
      <div
        className="rounded-2xl border border-uatf-accent/25 bg-uatf-panel p-3.5 backdrop-blur-xl shadow-[0_20px_50px_-20px_color-mix(in_srgb,var(--uatf-accent)_45%,transparent)] animate-[float-y_7s_ease-in-out_infinite]"
        style={{ animationDelay: `${delay * 1.6}s` }}
      >
        {children}
      </div>
    </motion.div>
  );
}

function HeroStage() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]" aria-hidden="true">
      {/* Halo y anillos del pedestal */}
      <div className="absolute left-1/2 top-[44%] h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-uatf-accent/20 blur-[90px]" />
      <div className="absolute left-1/2 top-[44%] h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-uatf-accent/25" />
      <div className="absolute left-1/2 top-[44%] h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-uatf-accent/50 animate-[pulse-ring_3.6s_ease-out_infinite]" />

      {/* Escudo DSA flotando */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.2, ease }}
        className="absolute left-1/2 top-[44%] z-10 w-[42%] -translate-x-1/2 -translate-y-1/2"
      >
        <div className="animate-[float-y_6s_ease-in-out_infinite]">
          <Image
            src="/images/dsa.png"
            alt=""
            width={500}
            height={500}
            priority
            className="h-auto w-full drop-shadow-[0_24px_40px_color-mix(in_srgb,var(--uatf-accent)_45%,transparent)]"
          />
        </div>
      </motion.div>

      {/* Pedestal */}
      <div className="absolute bottom-[8%] left-1/2 z-0 h-[16%] w-[66%] -translate-x-1/2">
        <div className="absolute inset-0 rounded-[50%] border border-foreground/10 bg-linear-to-b from-foreground/10 to-transparent" />
        <div className="absolute inset-x-[14%] top-[18%] h-[52%] rounded-[50%] border border-uatf-accent/40 bg-uatf-accent/10" />
        <div className="absolute inset-x-[34%] top-[30%] h-[26%] rounded-[50%] bg-uatf-accent blur-md opacity-80" />
        <div className="absolute left-1/2 bottom-[60%] h-[260%] w-[30%] -translate-x-1/2 bg-linear-to-t from-uatf-accent/35 to-transparent blur-xl" />
      </div>

      {/* Riesgo de deserción por gestión */}
      <Panel className="left-0 top-[4%] w-[42%] sm:-left-[4%]" delay={0.5}>
        <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
          <span>Riesgo de deserción</span>
          <span className="text-uatf-sky-text">−6,1%</span>
        </div>
        <svg viewBox="0 0 120 48" className="mt-2 h-12 w-full" preserveAspectRatio="none">
          <path
            d="M0 40 L12 34 L24 37 L36 26 L48 30 L60 20 L72 24 L84 15 L96 18 L108 9 L120 12 L120 48 L0 48 Z"
            fill="var(--uatf-ribbon)"
            opacity="0.18"
          />
          <path
            d="M0 40 L12 34 L24 37 L36 26 L48 30 L60 20 L72 24 L84 15 L96 18 L108 9 L120 12"
            fill="none"
            stroke="var(--uatf-ribbon)"
            strokeWidth="1.8"
          />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>1/2024</span>
          <span>2/2026</span>
        </div>
      </Panel>

      {/* Alerta temprana */}
      <Panel className="left-0 top-[52%] w-[34%] sm:-left-[2%]" delay={0.75}>
        <div className="text-[11px] font-semibold text-foreground">Alerta temprana</div>
        <div className="mt-2 flex items-center gap-3">
          <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="4" className="text-foreground/10" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="var(--uatf-sky)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="94.2"
              strokeDashoffset="17"
            />
          </svg>
          <div className="flex flex-col gap-1.5">
            <span className="h-1.5 w-10 rounded-full bg-foreground/25" />
            <span className="h-1.5 w-7 rounded-full bg-foreground/15" />
            <span className="h-1.5 w-9 rounded-full bg-foreground/15" />
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground">82% de casos atendidos</div>
      </Panel>

      {/* Cubo OLAP */}
      <Panel className="right-0 top-[10%] w-[36%] sm:-right-[4%]" delay={0.6}>
        <div className="text-[11px] font-semibold text-foreground">Cubo OLAP</div>
        <div className="relative mt-2 grid grid-cols-3 gap-x-1 gap-y-2 text-[8px] sm:text-[9px] text-muted-foreground">
          {["Gestión", "Facultad", "Carrera"].map((d, i) => (
            <div key={d} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md border",
                  i === 1
                    ? "border-uatf-accent/60 bg-uatf-accent/15 text-uatf-accent-text"
                    : "border-foreground/15 bg-foreground/5 text-foreground",
                )}
              >
                <Cube weight="duotone" className="h-3.5 w-3.5" />
              </span>
              {d}
            </div>
          ))}
          <span className="absolute left-[18%] right-[18%] top-3 -z-10 h-px bg-uatf-accent/40" />
        </div>
      </Panel>

      {/* Rendimiento por facultad */}
      <Panel className="right-0 top-[50%] w-[40%] sm:-right-[6%]" delay={0.9}>
        <div className="text-[11px] font-semibold text-foreground">Rendimiento por facultad</div>
        <div className="mt-2 flex h-14 items-end gap-1.5">
          {[48, 72, 56, 88, 64, 94, 70].map((h, i) => (
            <span
              key={i}
              className={cn("w-full rounded-t-sm", i === 5 ? "bg-uatf-sky" : "bg-uatf-accent/45")}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-background pt-28 md:pt-32">
      {/* Fondo: retícula tenue y halo rojo institucional */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--foreground) 18%, transparent) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
        }}
      />
      <div className="pointer-events-none absolute -top-40 right-[-10%] h-[36rem] w-[36rem] rounded-full bg-uatf-accent/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-uatf-sky/15 blur-[140px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
        <div className="flex flex-col items-start">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-foreground/[0.03] px-3.5 py-1.5 text-xs font-medium text-foreground/80 backdrop-blur"
          >
            <span className="h-2 w-2 rounded-full bg-uatf-sky shadow-[0_0_10px_var(--uatf-sky)]" aria-hidden="true" />
            DSS Académico · Universidad Autónoma Tomás Frías
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease }}
            className="mt-7 text-[2.5rem] leading-[1.04] font-bold tracking-[-0.035em] text-foreground sm:text-[3.4rem] lg:text-[3.6rem] xl:text-[4rem]"
          >
            Datos que deciden.
            <br />
            Estudiantes que <span className="text-uatf-accent-text">permanecen.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease }}
            className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            El Sistema de Apoyo a la Decisión de la UATF integra Data Warehouse,
            cubos OLAP, machine learning e inteligencia artificial para anticipar
            el rendimiento y la deserción estudiantil, con tableros para cada
            autoridad universitaria.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-uatf-accent px-6 text-sm font-semibold text-white shadow-[0_12px_30px_-10px_var(--uatf-accent)] transition-colors hover:bg-uatf-accent-strong active:scale-[0.98]"
            >
              Ingresar al sistema
              <ArrowRight weight="bold" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link
              href="#flujo"
              className="group inline-flex h-12 items-center gap-2 rounded-full border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:border-uatf-accent/50 hover:bg-foreground/[0.03]"
            >
              Ver cómo funciona
              <ArrowRight weight="bold" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-8 text-sm text-muted-foreground"
          >
            Dirección de Servicios Académicos · Potosí, Bolivia
          </motion.p>
        </div>

        <div className="relative">
          <HeroStage />
          <p className="-mt-2 text-center text-[11px] text-muted-foreground/80">
            Vista ilustrativa con datos de demostración
          </p>
        </div>
      </div>

      {/* Capas del sistema */}
      <h2 className="sr-only">Capas de la plataforma</h2>
      <div id="plataforma" className="relative mx-auto mt-16 grid max-w-7xl scroll-mt-24 grid-cols-1 gap-4 px-5 sm:grid-cols-2 md:px-8 lg:mt-10 lg:grid-cols-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 * i, ease }}
          >
            <Link
              href={f.href}
              className={cn(
                "group relative flex h-full flex-col rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1",
                i === 0
                  ? "border-uatf-accent/50 bg-linear-to-br from-uatf-accent/15 to-transparent shadow-[0_20px_50px_-25px_var(--uatf-accent)]"
                  : "border-border/70 bg-card/60 hover:border-uatf-accent/40",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  i === 0 ? "bg-uatf-accent text-white" : "bg-foreground/[0.06] text-foreground",
                )}
              >
                <f.icon weight="duotone" className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-8 text-base font-semibold text-foreground">{f.title}</h3>
              <div className="mt-1.5 flex items-end justify-between gap-4">
                <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 text-foreground transition-colors group-hover:border-uatf-accent group-hover:bg-uatf-accent group-hover:text-white">
                  <ArrowRight weight="bold" className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Horizonte y roles */}
      <div className="relative mt-20 pb-10">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[22rem] w-[160%] -translate-x-1/2 rounded-[100%] border-t border-uatf-accent/60 shadow-[0_-20px_60px_-20px_var(--uatf-accent)] md:w-[120%]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-[60%] -translate-x-1/2 bg-uatf-accent/20 blur-[60px]" />
        <div className="relative mx-auto max-w-6xl px-5 pt-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Un tablero para cada autoridad
          </p>
          <ul id="tableros" className="mt-6 flex scroll-mt-24 flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {roles.map((r) => (
              <li key={r.label} className="flex items-center gap-2 text-base font-semibold text-foreground/70 transition-colors hover:text-foreground md:text-lg">
                <r.icon weight="duotone" className="h-6 w-6 text-uatf-accent-text" aria-hidden="true" />
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
