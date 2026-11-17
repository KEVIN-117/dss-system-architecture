"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { ArrowRight, List, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const links = [
  { href: "#plataforma", label: "Plataforma" },
  { href: "#prediccion", label: "Predicción" },
  { href: "#tableros", label: "Tableros" },
  { href: "#flujo", label: "Cómo funciona" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 20);
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <motion.header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled || open
          ? "bg-background/85 backdrop-blur-md border-b border-border/40"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-4 px-4 md:px-8 transition-[height] duration-300",
          isScrolled ? "h-16" : "h-20",
        )}
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="UATF DSS Académico, inicio">
          <Image
            src="/images/dsa.png"
            alt=""
            width={36}
            height={36}
            priority
            className="h-9 w-9 object-contain"
          />
          <span className="flex flex-col leading-none">
            <span className="font-bold text-base tracking-tight text-foreground">UATF</span>
            <span className="text-xs font-medium text-muted-foreground mt-0.5 hidden sm:block">
              DSS Académico
            </span>
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md py-1 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 text-sm font-semibold bg-uatf-accent text-white pl-4 pr-3 sm:pl-5 sm:pr-4 h-10 rounded-full hover:bg-uatf-accent-strong transition-colors active:scale-95 shadow-[0_8px_24px_-8px_var(--uatf-accent)]"
          >
            Ingresar
            <ArrowRight weight="bold" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-foreground md:hidden"
          >
            {open ? <X weight="bold" className="h-4.5 w-4.5" aria-hidden="true" /> : <List weight="bold" className="h-4.5 w-4.5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav
        id="menu-movil"
        aria-label="Principal móvil"
        hidden={!open}
        className="border-t border-border/40 px-4 pb-4 md:hidden"
      >
        <ul className="flex flex-col">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center text-base font-medium text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </motion.header>
  );
}
