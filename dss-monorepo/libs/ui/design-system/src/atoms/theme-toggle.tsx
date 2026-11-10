'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './button';
import { cn } from '../lib/utils';

const STYLE_ID = 'dss-theme-circle-blur';
const STORAGE_KEY = 'dss-theme-mode';
const VIEW_TRANSITION_CSS = `
html[data-dss-theme-transition='circle-blur']::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-dss-theme-transition='circle-blur']::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: dss-theme-circle-blur 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes dss-theme-circle-blur {
  from {
    clip-path: circle(0 at var(--dss-theme-origin, 50% 50%));
    filter: blur(8px);
  }
  to {
    clip-path: circle(150vmax at var(--dss-theme-origin, 50% 50%));
    filter: blur(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  html[data-dss-theme-transition]::view-transition-new(root) {
    animation: none;
  }
}
`;

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = VIEW_TRANSITION_CSS;
      document.head.append(style);
    }
  }, []);

  const toggleTheme = (event: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const nextIsDark = !isDark;
    const applyTheme = () => {
      root.classList.toggle('dark', nextIsDark);
      try {
        window.localStorage.setItem(STORAGE_KEY, nextIsDark ? 'dark' : 'light');
      } catch {
        // The current page can still switch themes when storage is unavailable.
      }
      setIsDark(nextIsDark);
    };

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => {
        finished: Promise<void>;
      };
    };
    if (reduceMotion || !transitionDocument.startViewTransition) {
      applyTheme();
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    root.style.setProperty(
      '--dss-theme-origin',
      `${bounds.left + bounds.width / 2}px ${bounds.top + bounds.height / 2}px`,
    );
    root.dataset.dssThemeTransition = 'circle-blur';
    const transition = transitionDocument.startViewTransition(applyTheme);
    const cleanup = () => {
      delete root.dataset.dssThemeTransition;
      root.style.removeProperty('--dss-theme-origin');
    };
    void transition.finished.then(cleanup, cleanup);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-11 shrink-0 text-muted-foreground', className)}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="size-5" />
      ) : (
        <Moon aria-hidden="true" className="size-5" />
      )}
    </Button>
  );
}
