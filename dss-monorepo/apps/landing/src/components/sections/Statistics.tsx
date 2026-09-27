"use client";

import { motion } from "motion/react";

export function Statistics() {
  const stats = [
    { label: "Tiempo de Respuesta", value: "< 50ms", color: "from-dss-blue-500 to-dss-cyan-400" },
    { label: "Precisión de Predicción", value: "89.2%", color: "from-dss-gold-400 to-dss-gold-600" },
    { label: "Reducción de Deserción", value: "-14%", color: "from-dss-red-500 to-destructive" },
    { label: "Registros Analizados", value: "2.4M+", color: "from-foreground to-muted-foreground" }
  ];

  return (
    <section className="py-24 relative overflow-hidden bg-background my-24">
      {/* Background radial lines */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-radial-gradient(circle at center, var(--foreground), var(--foreground) 1px, transparent 1px, transparent 100%)', backgroundSize: '40px 40px' }} />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-x divide-border/40">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center text-center px-4"
            >
              <h3 className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter bg-clip-text text-transparent bg-linear-to-r ${stat.color} mb-3`}>
                {stat.value}
              </h3>
              <p className="text-muted-foreground text-sm md:text-base font-medium tracking-wide">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
