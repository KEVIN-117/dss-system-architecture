import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from '@/components/ui/Navbar';
import { Hero } from '@/components/sections/Hero';
import { Statistics } from '@/components/sections/Statistics';
import { BentoGrid } from '@/components/sections/BentoGrid';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { AiExplore } from '@/components/sections/AiExplore';
import { Cta } from '@/components/sections/Cta';
import { MotionProvider } from '@/components/ui/MotionProvider';

const footerLinks = [
  { href: '#plataforma', label: 'Plataforma' },
  { href: '#prediccion', label: 'Predicción' },
  { href: '#flujo', label: 'Cómo funciona' },
  { href: 'https://dsa.uatf.edu.bo/', label: 'Sitio de la DSA' },
];

export default function Home() {
  return (
    <MotionProvider>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-uatf-accent focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>
      <Navbar />
      <main
        id="contenido"
        tabIndex={-1}
        className="flex min-h-screen flex-col bg-background overflow-hidden outline-none"
      >
        <Hero />
        <Statistics />
        <AiExplore />
        <BentoGrid />
        <HowItWorks />
        <Cta />
      </main>

      <footer className="relative z-20 border-t border-border/40 bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/images/dsa.png"
              alt="Escudo de la Dirección de Servicios Académicos"
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
            />
            <div className="text-sm leading-snug">
              <p className="font-semibold text-foreground">
                Universidad Autónoma Tomás Frías
              </p>
              <p className="text-muted-foreground">
                Dirección de Servicios Académicos · Av. Las Banderas, Potosí
              </p>
            </div>
          </div>
          <nav
            aria-label="Pie de página"
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-uatf-accent-text"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="border-t border-border/40 py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Universidad Autónoma Tomás Frías — DSS
          Académico
        </p>
      </footer>
    </MotionProvider>
  );
}
