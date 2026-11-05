'use client';

import { useEffect } from 'react';

export default function ThemeSync() {
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('dss-docs-theme');
      if (saved === 'dark' || saved === 'light') {
        document.documentElement.dataset.docsTheme = saved;
        document.documentElement.style.colorScheme = saved;
      }
    } catch {
      // System theme remains in effect when storage is unavailable.
    }
  }, []);
  return null;
}
