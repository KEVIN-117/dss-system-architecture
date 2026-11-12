'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BookOpen, ChevronRight, Code2, Lock, Menu, Moon, Search, Sun, X } from 'lucide-react';
import type { SearchEntry } from '../lib/content';
import { normalize } from '../lib/slug';

export type NavData = {
  groups: Array<{
    id: string;
    title: string;
    items: Array<{ href: string; title: string; restricted: boolean }>;
  }>;
  services: Array<{
    id: string;
    name: string;
    href: string;
    operations: Array<{ href: string; method: string; title: string }>;
  }>;
};

type Theme = 'light' | 'dark';
const themeKey = 'dss-docs-theme';

function MethodBadge({ method }: { method: string }) {
  return <span className={`dp-method dp-method-${method.toLowerCase()}`}>{method}</span>;
}

function snippet(text: string, terms: string[]): string {
  const plain = normalize(text);
  const first = terms.map((term) => plain.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, first - 50);
  const end = Math.min(text.length, start + 150);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function search(index: SearchEntry[], query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return index
    .map((entry) => {
      const title = normalize(entry.title);
      const haystack = `${title} ${normalize(entry.context)} ${normalize(entry.text)} ${normalize(entry.method ?? '')}`;
      if (!terms.every((term) => haystack.includes(term))) return null;
      const score =
        terms.filter((term) => title.includes(term)).length * 3 + (entry.kind === 'guide' ? 2 : entry.kind === 'section' ? 1 : 0);
      return { entry, score, preview: snippet(entry.text || entry.title, terms) };
    })
    .filter((result): result is NonNullable<typeof result> => result !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, 25);
}

export default function Shell({ nav, index, children }: { nav: NavData; index: SearchEntry[]; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const searchRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => search(index, query), [index, query]);
  const inReference = pathname.startsWith('/reference');

  // Close the mobile drawer and clear the search after every navigation.
  useEffect(() => {
    setDrawerOpen(false);
    setQuery('');
  }, [pathname]);

  useEffect(() => {
    setTheme(document.documentElement.dataset.docsTheme === 'dark' ? 'dark' : 'light');
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setDrawerOpen(true);
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.docsTheme = next;
    document.documentElement.style.colorScheme = next;
    try {
      window.localStorage.setItem(themeKey, next);
    } catch {
      // The choice still applies for this visit when storage is unavailable.
    }
    setTheme(next);
  };

  const isActive = (href: string) => pathname === href;

  return (
    <div className="dp-root">
      <a className="dp-skip" href="#contenido">
        Saltar al contenido
      </a>
      <header className="dp-topbar">
        <button
          className="dp-icon-button dp-menu-button"
          type="button"
          aria-label={drawerOpen ? 'Cerrar navegación' : 'Abrir navegación'}
          aria-expanded={drawerOpen}
          aria-controls="dp-sidebar"
          onClick={() => setDrawerOpen((open) => !open)}
        >
          {drawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <Link className="dp-brand" href="/">
          <span className="dp-brand-mark" aria-hidden="true">
            D
          </span>
          <span>
            DSS <b>UATF</b>
          </span>
          <span className="dp-brand-product">Documentación</span>
        </Link>
        <nav className="dp-tabs" aria-label="Secciones">
          <Link href="/" aria-current={!inReference ? 'page' : undefined}>
            <BookOpen aria-hidden="true" /> Guías
          </Link>
          <Link href="/reference" aria-current={inReference ? 'page' : undefined}>
            <Code2 aria-hidden="true" /> Referencia API
          </Link>
        </nav>
        <span className="dp-spacer" />
        <button
          className="dp-search-trigger"
          type="button"
          onClick={() => {
            setDrawerOpen(true);
            window.setTimeout(() => searchRef.current?.focus(), 0);
          }}
        >
          <Search aria-hidden="true" />
          <span>Buscar</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button
          className="dp-icon-button"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
          title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        >
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
      </header>

      <div className="dp-body">
        {drawerOpen && <button className="dp-backdrop" type="button" aria-label="Cerrar navegación" onClick={() => setDrawerOpen(false)} />}
        <aside id="dp-sidebar" className={`dp-sidebar ${drawerOpen ? 'dp-sidebar-open' : ''}`} aria-label="Navegación de la documentación">
          <div className="dp-search" role="search">
            <Search aria-hidden="true" />
            <label className="dp-visually-hidden" htmlFor="dp-search-input">
              Buscar en la documentación
            </label>
            <input
              id="dp-search-input"
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Buscar guías y APIs…"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results[0]) router.push(results[0].entry.href);
                if (event.key === 'Escape') setQuery('');
              }}
            />
          </div>

          {query.trim() ? (
            <div className="dp-results" aria-live="polite">
              <p className="dp-results-count">
                {results.length ? `${results.length} resultado${results.length === 1 ? '' : 's'}` : `Sin resultados para “${query}”.`}
              </p>
              <ul>
                {results.map(({ entry, preview }) => (
                  <li key={entry.href + entry.title}>
                    <Link href={entry.href} className="dp-result">
                      <span className="dp-result-title">
                        {entry.method && <MethodBadge method={entry.method} />}
                        {entry.title}
                      </span>
                      <span className="dp-result-context">{entry.context}</span>
                      {preview && entry.kind !== 'api' && <span className="dp-result-preview">{preview}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <nav className="dp-tree" aria-label="Contenido">
              {!inReference &&
                nav.groups.map((group) => (
                  <div className="dp-tree-group" key={group.id}>
                    <p className="dp-tree-heading">{group.title}</p>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.href}>
                          <Link href={item.href} className="dp-tree-link" aria-current={isActive(item.href) ? 'page' : undefined}>
                            <span>{item.title}</span>
                            {item.restricted && <Lock aria-label="Acceso restringido" className="dp-lock" />}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              <div className="dp-tree-group">
                <p className="dp-tree-heading">
                  {inReference ? (
                    'Servicios'
                  ) : (
                    <Link href="/reference" className="dp-tree-heading-link">
                      Referencia API
                    </Link>
                  )}
                </p>
                <ul>
                  {nav.services.map((service) => {
                    const open = pathname.startsWith(service.href);
                    return (
                      <li key={service.id}>
                        <details className="dp-service" open={open || undefined}>
                          <summary>
                            <ChevronRight aria-hidden="true" className="dp-chevron" />
                            <span>{service.name}</span>
                            <span className="dp-count">{service.operations.length}</span>
                          </summary>
                          <ul>
                            <li>
                              <Link href={service.href} className="dp-tree-link dp-tree-sub" aria-current={isActive(service.href) ? 'page' : undefined}>
                                Resumen del servicio
                              </Link>
                            </li>
                            {service.operations.map((operation) => (
                              <li key={operation.href}>
                                <Link
                                  href={operation.href}
                                  className="dp-tree-link dp-tree-sub"
                                  aria-current={isActive(operation.href) ? 'page' : undefined}
                                >
                                  <MethodBadge method={operation.method} />
                                  <span>{operation.title}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </nav>
          )}
        </aside>
        <div className="dp-main" id="contenido" tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  );
}
