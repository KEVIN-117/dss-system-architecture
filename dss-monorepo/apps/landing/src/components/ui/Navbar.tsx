"use client";

import { useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { BookOpenText } from "@phosphor-icons/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 20);
  });

  return (
    <motion.header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 transition-all duration-300",
        isScrolled ? "h-16 bg-background/80 backdrop-blur-md border-b border-border/40 shadow-sm" : "h-24 bg-transparent border-transparent"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-dss-blue-500 to-dss-navy-900 shadow-[0_0_15px_var(--dss-blue-500)]">
          <BookOpenText weight="duotone" className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg tracking-tight text-foreground">
          UATF <span className="text-muted-foreground">DSA</span>
        </span>
      </div>

      <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
        <Link href="#features" className="hover:text-foreground transition-colors">Características</Link>
        <Link href="#integrations" className="hover:text-foreground transition-colors">Integraciones</Link>
        <Link href="#security" className="hover:text-foreground transition-colors">Seguridad</Link>
        <Link href="#about" className="hover:text-foreground transition-colors">Nosotros</Link>
      </nav>

      <div className="flex items-center gap-4">
        <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:block">
          Ingresar
        </Link>
        <Link
          href="/request-access"
          className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-full hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
        >
          Solicitar Acceso
        </Link>
      </div>
    </motion.header>
  );
}
