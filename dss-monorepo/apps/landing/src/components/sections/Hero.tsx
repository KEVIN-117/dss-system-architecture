"use client";

import { ChartLineUp, Users, ShieldCheck } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { LampContainer } from "@/components/ui/lamp";

export function Hero() {
  const titleWords = "La plataforma inteligente para datos académicos".split(" ");

  return (
    <section className="relative w-full bg-background flex flex-col items-center overflow-hidden">

      {/* 1. Header Text Section with Lamp Effect (Top) */}
      <LampContainer className="max-w-4xl z-30">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md mb-8 border border-border/60 group-hover:border-dss-cyan-400/50 transition-colors duration-700"
        >
          <span className="flex h-3 w-3 rounded-full bg-dss-cyan-400 animate-pulse group-hover:shadow-[0_0_12px_var(--dss-cyan-400)] transition-shadow duration-700" />
          <span className="text-sm font-medium text-foreground/80 tracking-wide uppercase group-hover:text-foreground transition-colors duration-700">Nuevo: Motor de IA v2</span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed text-center"
        >
          <span className="inline px-3 py-1 rounded-xl box-decoration-clone group-hover:text-foreground/90 transition-all duration-700">
            Nunca pierdas un reporte, métrica o conexión. Sincronización en tiempo real.
          </span>
        </motion.p>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight leading-tight text-center relative z-10 transition-transform duration-1000 group-hover:scale-105">
          <span className="inline px-4 py-1 rounded-2xl box-decoration-clone">
            <span className="bg-clip-text text-transparent bg-linear-to-r from-foreground via-foreground/40 to-foreground bg-size-[200%_auto] animate-[gradient_8s_linear_infinite] group-hover:from-foreground group-hover:via-dss-cyan-400 group-hover:to-dss-blue-500 group-hover:animate-[gradient_3s_linear_infinite] transition-all duration-1000">
              {titleWords.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, filter: "blur(12px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: 0.1 + i * 0.15, duration: 1.2, ease: "easeOut" }}
                  className="inline-block mr-[0.25em] last:mr-0 transition-all duration-1000"
                >
                  {word}
                </motion.span>
              ))}
            </span>
          </span>
        </h1>


      </LampContainer>

      <div className="relative w-full flex flex-col items-center justify-start min-h-150 mb-40">

        <div className="absolute top-[-20%] md:top-[-54%] left-0 right-0 w-[150vw] md:w-[120vw] lg:w-screen max-w-screen h-auto aspect-video z-0 opacity-90 pointer-events-none">
          <video
            src="/images/blackhole.webm"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain object-top"
          />
          <div className="absolute inset-0 bg-linear-to-b from-background via-transparent to-background z-10" />
          <div className="absolute inset-0 bg-linear-to-r from-background via-transparent to-background z-10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 w-full max-w-5xl px-4 md:px-8 mt-[5%]"
        >
          <div className="bg-card/80 backdrop-blur-2xl rounded-2xl md:rounded-4xl overflow-hidden flex flex-col h-125 md:h-162.5 w-full border border-border/60 shadow-[0_0_80px_color-mix(in_srgb,var(--dss-cyan-400)_15%,transparent)] ring-1 ring-foreground/5">

            <div className="h-14 border-b border-border/60 flex items-center px-6 gap-4 bg-foreground/2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-dss-gold-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <div className="h-8 flex-1 max-w-md bg-foreground/5 rounded-lg flex items-center px-4 border border-border/50 mx-4">
                <span className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-foreground/10 flex items-center justify-center">⌘</span>
                  Search anything...
                </span>
              </div>
            </div>

            <div className="flex-1 flex p-6 gap-8 overflow-hidden relative">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--foreground) 20%, transparent) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

              {/* Sidebar */}
              <div className="hidden md:flex w-56 flex-col gap-3 relative z-10">
                <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2 px-2">Menu</div>
                <div className="h-10 rounded-xl bg-dss-cyan-400/10 border border-dss-cyan-400/20 flex items-center px-4 gap-3 text-dss-cyan-400">
                  <ChartLineUp className="w-5 h-5" />
                  <span className="text-sm font-medium">Dropouts</span>
                </div>
                <div className="h-10 rounded-xl bg-transparent hover:bg-foreground/5 flex items-center px-4 gap-3 text-muted-foreground transition-colors">
                  <Users className="w-5 h-5" />
                  <span className="text-sm">All Students</span>
                </div>
                <div className="h-10 rounded-xl bg-transparent hover:bg-foreground/5 flex items-center px-4 gap-3 text-muted-foreground transition-colors">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-sm">Authorization</span>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col gap-6 relative z-10 overflow-y-auto pr-4">
                <div className="flex justify-between items-end border-b border-border/40 pb-4">
                  <div>
                    <div className="text-sm text-dss-cyan-400 mb-2 font-medium tracking-wide uppercase flex items-center gap-2">
                      <div className="w-1 h-4 bg-dss-cyan-400 rounded-full" />
                      Sun, April 2nd, 2026
                    </div>
                    <div className="text-2xl font-bold text-foreground">Dashboard</div>
                  </div>
                </div>

                {/* Content Mock */}
                <div className="flex flex-col gap-4 text-muted-foreground text-sm leading-relaxed">
                  <p className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-foreground/20 shrink-0" />
                    Dropout analytics and student engagement metrics at your fingertips.
                  </p>
                  <p className="flex items-start gap-3 pl-4">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-foreground/10 shrink-0" />
                    Visualize trends, identify at-risk students, and make data-driven decisions.
                  </p>
                  <p className="flex items-start gap-3 pl-4">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-foreground/10 shrink-0" />
                    Real-time synchronization ensures you always have the latest insights.
                  </p>
                </div>
              </div>

              {/* Right Sidebar Calendar Mock */}
              <div className="hidden lg:flex w-64 flex-col gap-4 relative z-10 border-l border-border/40 pl-8">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold text-foreground">April 2026</div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded bg-foreground/5 flex items-center justify-center text-muted-foreground text-xs">&lt;</div>
                    <div className="w-6 h-6 rounded bg-foreground/5 flex items-center justify-center text-muted-foreground text-xs">&gt;</div>
                  </div>
                </div>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-y-3 gap-x-2 text-center text-xs">
                  <div className="text-muted-foreground">Mo</div><div className="text-muted-foreground">Tu</div><div className="text-muted-foreground">We</div><div className="text-muted-foreground">Th</div><div className="text-muted-foreground">Fr</div><div className="text-muted-foreground">Sa</div><div className="text-muted-foreground">Su</div>
                  {[...Array(30)].map((_, i) => (
                    <div key={i} className={`w-6 h-6 flex items-center justify-center rounded-md ${i === 1 ? 'bg-dss-cyan-400/20 text-dss-cyan-400 border border-dss-cyan-400/30' : 'text-muted-foreground'}`}>
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* divider */}

                <div className="border-t border-border/60 mt-2" />

                <div className="text-xs text-muted-foreground mt-2">Events scheduled</div>

                {/* make a list of events */}
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-dss-cyan-400" />
                    <div className="text-xs text-muted-foreground">Dropout Report Due</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <div className="text-xs text-muted-foreground">Student Engagement Review</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>

    </section>
  );
}
