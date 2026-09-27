"use client";

import { motion } from "motion/react";
import { Plus, ArrowRight } from "@phosphor-icons/react";
import Image from "next/image";

const cards = [
  {
    title: "Modelos Predictivos",
    description: "Anticipa el desempeño estudiantil usando algoritmos de machine learning con un 85% de precisión.",
    image: "/images/asset_brain.jpg",
    color: "var(--dss-cyan-400)",
    tag: "RENDIMIENTO",
    action: "ENTER"
  },
  {
    title: "Ingesta de Datos",
    description: "La Dirección de Servicios Académicos consolida información en tiempo real para decisiones inmediatas.",
    image: "/images/asset_sphere.jpg",
    color: "var(--dss-gold-400)",
    tag: "SINCRONIZACIÓN",
    action: "ENTER"
  },
  {
    title: "Seguridad y Control",
    description: "Sistema de permisos granulares por facultad y carrera. Datos protegidos mediante encriptación.",
    image: "/images/asset_shield.jpg",
    color: "var(--dss-red-500)",
    tag: "ACCESO",
    action: "ENTER"
  }
];

export function BentoGrid() {
  return (
    <section id="features" className="py-32 relative z-10 bg-background">
      <div className="container mx-auto px-6">

        {/* Section Header */}
        <div className="flex flex-col items-center text-center mb-24">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
            Ecosistema de datos unificado
          </h2>
          <p className="text-muted-foreground max-w-2xl text-lg">
            Combinando IA avanzada, procesamiento en tiempo real y seguridad de grado militar en una sola plataforma.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-7xl mx-auto">
          {cards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: index * 0.2, ease: "easeOut" }}
              className="relative w-full h-150 flex flex-col group cursor-pointer"
              style={{ '--card-color': card.color } as React.CSSProperties}
            >
              <div className="absolute inset-0 rounded-4xl bg-linear-to-b from-foreground/10 via-(--card-color)/20 to-(--card-color)/60 p-px opacity-70 group-hover:opacity-100 transition-opacity duration-500 shadow-[0_0_30px_color-mix(in_srgb,var(--dss-navy-950)_50%,transparent)] group-hover:shadow-[0_0_50px_var(--card-color)]">

                <div className="absolute inset-px bg-card rounded-[31px] flex flex-col overflow-hidden z-10">
                  <div className="absolute top-6 left-8 flex items-center gap-2 z-20">
                    <div className="w-2 h-2 rounded-full bg-(--card-color) animate-pulse shadow-[0_0_8px_var(--card-color)]" />
                    <span className="text-[10px] font-bold text-(--card-color) tracking-[0.2em]">{card.tag}</span>
                  </div>

                  <div className="relative w-full h-72 mt-12 flex items-center justify-center">
                    <div className="absolute w-[70%] aspect-square rounded-full border border-(--card-color)/20 scale-90 group-hover:scale-100 transition-transform duration-700" />
                    <div className="absolute w-[50%] aspect-square rounded-full border border-(--card-color)/40 scale-90 group-hover:scale-110 transition-transform duration-700 delay-75" />
                    <div className="absolute w-[30%] aspect-square rounded-full border border-(--card-color)/60 scale-90 group-hover:scale-125 transition-transform duration-700 delay-150" />

                    <div
                      className="absolute w-[150%] h-[150%] rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-700 blur-3xl mix-blend-screen pointer-events-none"
                      style={{ background: 'radial-gradient(circle, var(--card-color) 0%, transparent 40%)' }}
                    />

                    <Image
                      src={card.image}
                      alt={card.title}
                      width={250}
                      height={250}
                      className="relative z-10 w-3/5 h-3/5 object-contain mix-blend-screen group-hover:scale-110 transition-transform duration-700"
                    />
                  </div>

                  <div className="px-8 pb-6 flex-1 flex flex-col justify-end relative z-10">
                    <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight group-hover:text-(--card-color) transition-colors duration-500">{card.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6 group-hover:text-foreground/80 transition-colors duration-500">
                      {card.description}
                    </p>

                    <div className="flex gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground transition-colors duration-500 group-hover:bg-(--card-color) group-hover:shadow-[0_0_8px_var(--card-color)]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground/20" />
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground/20" />
                    </div>
                  </div>

                  <div className="h-16 w-full border-t border-(--card-color)/30 bg-(--card-color)/10 flex items-center justify-between px-8 group-hover:bg-(--card-color)/20 transition-colors duration-500 relative overflow-hidden z-20">
                    <div className="absolute inset-0 bg-linear-to-r from-transparent via-(--card-color)/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                    <Plus className="text-(--card-color) w-5 h-5 relative z-10" weight="bold" />
                    <div className="flex items-center gap-2 relative z-10">
                      <span className="text-(--card-color) font-bold tracking-[0.3em] text-sm">{card.tag}</span>
                      <ArrowRight className="text-(--card-color) w-4 h-4 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" weight="bold" />
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
