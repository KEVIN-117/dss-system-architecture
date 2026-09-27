"use client";

import { Timeline } from "@/components/ui/timeline";
import Image from "next/image";

export function HowItWorks() {
  const data = [
    {
      title: "1. Ingesta Continua",
      content: (
        <div>
          <p className="text-foreground/80 text-lg md:text-xl font-normal mb-8 max-w-xl">
            Sincronización en tiempo real desde el sistema académico. Los datos son anonimizados y estructurados automáticamente.
          </p>
          <div className="relative w-full h-75 md:h-100 rounded-2xl md:rounded-4xl overflow-hidden border border-border/60 shadow-[0_0_30px_color-mix(in_srgb,var(--dss-blue-500)_20%,transparent)]">
            <Image
              src="/images/ingesta.jpg"
              alt="Ingesta de Datos"
              fill
              className="object-cover"
            />
          </div>
        </div>
      ),
    },
    {
      title: "2. Análisis Predictivo",
      content: (
        <div>
          <p className="text-foreground/80 text-lg md:text-xl font-normal mb-8 max-w-xl">
            El motor de IA evalúa miles de variables históricas para identificar patrones de deserción y rendimiento antes de que sucedan.
          </p>
          <div className="relative w-full h-75 md:h-100 rounded-2xl md:rounded-4xl overflow-hidden border border-border/60 shadow-[0_0_30px_color-mix(in_srgb,var(--dss-red-500)_20%,transparent)]">
            <Image
              src="/images/analisis.jpg"
              alt="Análisis Predictivo"
              fill
              className="object-cover"
            />
          </div>
        </div>
      ),
    },
    {
      title: "3. Acción Directa",
      content: (
        <div>
          <p className="text-foreground/80 text-lg md:text-xl font-normal mb-8 max-w-xl">
            Dashboards interactivos para autoridades, permitiendo intervenciones tempranas y basadas en evidencia generada en el momento.
          </p>
          <div className="relative w-full h-75 md:h-100 rounded-2xl md:rounded-4xl overflow-hidden border border-border/60 shadow-[0_0_30px_color-mix(in_srgb,var(--dss-gold-400)_20%,transparent)]">
            <Image
              src="/images/visualizacion.jpg"
              alt="Visualización y Acción"
              fill
              className="object-cover"
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="relative z-20">
      <Timeline data={data} />
    </section>
  );
}
