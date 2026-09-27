"use client";

import { motion } from "motion/react";
import { Sparkle, MagnifyingGlass } from "@phosphor-icons/react";

export function AiExplore() {
  return (
    <section className="py-32 relative overflow-hidden bg-background flex flex-col items-center justify-center">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-100 bg-dss-blue-500/10 rounded-[100%] blur-[120px] pointer-events-none" />

      <div className="text-center z-10 mb-12">
        <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
          Pregúntale a tus datos
        </h2>
        <p className="text-muted-foreground text-lg">
          Un asistente inteligente para generar reportes en segundos.
        </p>
      </div>

      <div className="relative w-full max-w-3xl px-6 z-20">
        {/* Mock background charts (Floating) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute -top-16 -left-12 md:-left-32 w-48 md:w-64 h-32 bg-foreground/2 border border-border/40 rounded-2xl p-4 backdrop-blur-sm hidden sm:block -rotate-6"
        >
          <div className="h-2 w-1/2 bg-foreground/10 rounded mb-4" />
          <div className="flex items-end h-16 gap-2">
            {[40, 70, 50, 90, 60].map((h, i) => (
              <div key={i} className="w-full bg-dss-blue-500/40 rounded-t-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="absolute -bottom-12 -right-8 md:-right-24 w-56 md:w-72 h-40 bg-foreground/2 border border-border/40 rounded-2xl p-4 backdrop-blur-sm hidden sm:block rotate-[4deg]"
        >
          <div className="h-2 w-1/3 bg-foreground/10 rounded mb-4" />
          <div className="relative h-20 w-full">
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path d="M0,80 Q20,60 40,75 T80,40 T100,20" fill="none" stroke="var(--color-dss-red-500)" strokeWidth="2" />
            </svg>
          </div>
        </motion.div>

        {/* Search Bar Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-linear-to-r from-dss-blue-500 via-dss-cyan-400 to-dss-blue-500 rounded-full blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-pulse" />

          <div className="relative flex items-center h-16 bg-card border border-border/60 rounded-full px-6 shadow-2xl">
            <MagnifyingGlass className="w-6 h-6 text-muted-foreground mr-4" />
            <input
              type="text"
              disabled
              placeholder="Ej. Generar gráfico de alumnos inscritos por carrera en 2026..."
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder-muted-foreground font-medium text-sm md:text-base"
            />
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-foreground/5 ml-4">
              <Sparkle weight="fill" className="w-4 h-4 text-dss-gold-400" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
