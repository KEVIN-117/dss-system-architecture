"use client";

import { motion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";

export function Cta() {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-dss-blue-500/20 rounded-full blur-[150px] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10 text-center flex flex-col items-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6"
        >
          Es hora de tomar mejores <br className="hidden md:block" /> decisiones académicas.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-lg md:text-xl max-w-2xl mb-10"
        >
          Únete a la nueva plataforma de inteligencia académica de la UATF.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <button className="h-14 px-8 rounded-full bg-primary text-primary-foreground font-medium text-lg flex items-center gap-2 hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95 shadow-[0_0_40px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
            Solicitar Acceso
            <ArrowRight weight="bold" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
