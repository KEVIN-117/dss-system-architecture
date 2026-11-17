"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, EnvelopeSimple, MapPin } from "@phosphor-icons/react";

export function Cta() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden px-5 py-24 md:px-8 md:py-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[2rem] border border-uatf-accent/30 bg-card p-8 md:grid-cols-[1fr_auto] md:p-14"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-uatf-sky/20 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-uatf-accent/25 blur-[110px]"
        />

        <div className="relative">
          <h2
            id="cta-title"
            className="text-3xl font-bold tracking-tight text-foreground md:text-5xl"
          >
            Cada estudiante cuenta.
            <br />
            <span className="text-uatf-accent-text">Cada decisión, con evidencia.</span>
          </h2>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            El DSS académico es para autoridades y personal con cuenta
            institucional de la Universidad Autónoma Tomás Frías. Si necesitas
            acceso, escribe a la Dirección de Servicios Académicos.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-uatf-accent px-6 text-sm font-semibold text-white shadow-[0_12px_30px_-10px_var(--uatf-accent)] transition-colors hover:bg-uatf-accent-strong active:scale-[0.98] md:text-base"
            >
              Ingresar con cuenta institucional
              <ArrowRight weight="bold" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <a
              href="mailto:dsa@uatf.edu.bo?subject=Solicitud%20de%20acceso%20al%20DSS%20acad%C3%A9mico"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:border-uatf-accent/50 md:text-base"
            >
              <EnvelopeSimple weight="bold" className="h-4 w-4" aria-hidden="true" />
              Solicitar acceso
            </a>
          </div>

          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin weight="duotone" className="h-4 w-4 text-uatf-accent-text" aria-hidden="true" />
            Dirección de Servicios Académicos · Av. Las Banderas, Potosí
          </p>
        </div>

        <div className="relative mx-auto hidden w-56 md:block" aria-hidden="true">
          <div className="absolute inset-6 rounded-full bg-uatf-accent/25 blur-3xl" />
          <Image
            src="/images/dsa.png"
            alt=""
            width={500}
            height={500}
            className="relative h-auto w-full animate-[float-y_7s_ease-in-out_infinite]"
          />
        </div>
      </motion.div>
    </section>
  );
}
