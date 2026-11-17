'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'uatf-landing-theme';

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    setDark(root.classList.contains('dark'));

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = (event: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {
        stored = null;
      }
      if (stored) return;
      root.classList.toggle('dark', event.matches);
      setDark(event.matches);
    };
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      /* Sin almacenamiento: el cambio dura solo esta visita. */
    }
    setDark(next);
  };

  const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-foreground transition-colors duration-200 hover:border-uatf-accent/60 hover:text-uatf-accent-text active:scale-95',
        className,
      )}
    >
      {dark ? (
        <Sun weight="bold" className="h-4.5 w-4.5" aria-hidden="true" />
      ) : (
        <Moon weight="bold" className="h-4.5 w-4.5" aria-hidden="true" />
      )}
    </button>
  );
}
