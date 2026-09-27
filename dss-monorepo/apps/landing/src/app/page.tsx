import { Navbar } from '@/components/ui/Navbar';
import { Hero } from '@/components/sections/Hero';
import { Statistics } from '@/components/sections/Statistics';
import { BentoGrid } from '@/components/sections/BentoGrid';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { AiExplore } from '@/components/sections/AiExplore';
import { Cta } from '@/components/sections/Cta';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-background overflow-hidden selection:bg-dss-blue-500/30 selection:text-primary-foreground">
      <Navbar />
      <Hero />
      <Statistics />
      <AiExplore />
      <BentoGrid />
      <HowItWorks />
      <Cta />

      <footer className="py-8 border-t border-border/40 text-center text-muted-foreground text-sm bg-background relative z-20">
        <p>
          © {new Date().getFullYear()} Universidad Autónoma Tomás Frías -
          Dirección de Servicios Académicos.
        </p>
      </footer>
    </main>
  );
}
