import Link from 'next/link';
import type { ReactNode } from 'react';
import Toc, { type TocItem } from './toc';

export type Crumb = { href?: string; label: string };

/** Content column plus right-hand table of contents, shared by every page. */
export default function PageFrame({
  crumbs,
  toc = [],
  children,
  footer = true,
}: {
  crumbs: Crumb[];
  toc?: TocItem[];
  children: ReactNode;
  footer?: boolean;
}) {
  return (
    <div className={`dp-page ${toc.length ? '' : 'dp-page-wide'}`}>
      <div className="dp-content">
        <nav className="dp-breadcrumb" aria-label="Ruta de navegación">
          <ol>
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`}>
                {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
        {children}
        {footer && (
          <footer className="dp-footer">
            <span>¿Encontraste información desactualizada o incorrecta?</span>
            <a href="https://github.com/KEVIN-117/dss-system-architecture/issues/new?title=Documentaci%C3%B3n%20desactualizada" target="_blank" rel="noreferrer">
              Reportar un problema
            </a>
          </footer>
        )}
      </div>
      {toc.length > 0 && (
        <aside className="dp-rail">
          <Toc items={toc} />
        </aside>
      )}
    </div>
  );
}
