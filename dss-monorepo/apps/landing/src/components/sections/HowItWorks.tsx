"use client";

import Image from "next/image";
import { ArrowsDownUp, Brain, PresentationChart } from "@phosphor-icons/react";
import { Timeline, type TimelineEntry } from "@/components/ui/timeline";

function Step({
  text,
  chips,
  image,
  alt,
}: {
  text: string;
  chips: string[];
  image: string;
  alt: string;
}) {
  return (
    <div>
      <p className="mb-5 max-w-xl text-base text-foreground/85 md:text-xl">{text}</p>
      <ul className="mb-8 flex flex-wrap gap-2" aria-label="Tecnologías de esta etapa">
        {chips.map((chip) => (
          <li
            key={chip}
            className="rounded-full border border-uatf-accent/30 bg-uatf-accent/5 px-3 py-1 text-xs font-medium text-uatf-accent-text"
          >
            {chip}
          </li>
        ))}
      </ul>
      <div className="relative h-60 w-full overflow-hidden rounded-2xl border border-border/60 shadow-[0_20px_60px_-30px_var(--uatf-accent)] md:h-96 md:rounded-3xl">
        <Image
          src={image}
          alt={alt}
          fill
          sizes="(min-width: 768px) 60vw, 100vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}

export function HowItWorks() {
  const data: TimelineEntry[] = [
    {
      title: "Integración de datos",
      icon: <ArrowsDownUp weight="duotone" className="h-5 w-5" aria-hidden="true" />,
      content: (
        <Step
          text="Procesos ETL extraen inscripciones, notas y admisiones del sistema académico, las validan y las cargan al Data Warehouse por gestión."
          chips={["Apache Hop", "PostgreSQL", "Esquema estrella"]}
          image="/images/ingesta.jpg"
          alt="Ilustración de flujos de datos entrando a un servidor"
        />
      ),
    },
    {
      title: "Análisis y predicción",
      icon: <Brain weight="duotone" className="h-5 w-5" aria-hidden="true" />,
      content: (
        <Step
          text="Los cubos OLAP y los modelos de machine learning analizan el historial de cada cohorte para detectar a tiempo el riesgo de bajo rendimiento y de deserción."
          chips={["Cubos OLAP", "scikit-learn", "XGBoost", "FastAPI"]}
          image="/images/analisis.jpg"
          alt="Ilustración de un modelo analítico procesando información"
        />
      ),
    },
    {
      title: "Decisión y seguimiento",
      icon: <PresentationChart weight="duotone" className="h-5 w-5" aria-hidden="true" />,
      content: (
        <Step
          text="Rector, decanos y directores de carrera reciben tableros con alertas tempranas para intervenir con tutorías y decisiones basadas en evidencia."
          chips={["Tableros por rol", "Alertas tempranas", "Cuenta institucional"]}
          image="/images/visualizacion.jpg"
          alt="Ilustración de tableros de visualización de datos"
        />
      ),
    },
  ];

  return (
    <section id="flujo" aria-labelledby="flujo-title" className="relative z-20 scroll-mt-20">
      <Timeline
        title="Cómo funciona el DSS"
        description="Del registro académico a la decisión de la autoridad, en tres etapas."
        data={data}
      />
    </section>
  );
}
