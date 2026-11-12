import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { slugify, textOf } from './lib/slug';

function Heading({ level, children }: { level: 2 | 3; children: ReactNode }) {
  const id = slugify(textOf(children));
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <Tag id={id} className="dp-anchor-heading">
      {children}
      <a className="dp-anchor" href={`#${id}`} aria-label={`Enlace a esta sección: ${textOf(children)}`}>
        #
      </a>
    </Tag>
  );
}

function Callout({ title, tone = 'info', children }: { title: string; tone?: 'info' | 'warning'; children: ReactNode }) {
  return (
    <aside className={`dp-callout dp-callout-${tone}`}>
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  );
}

/** Link to the source document in the repository (developer audience). */
function Source({ path, label }: { path: string; label: string }) {
  return (
    <a className="dp-source" href={`https://github.com/KEVIN-117/dss-system-architecture/blob/main/${path}`} target="_blank" rel="noreferrer">
      {label} ↗
    </a>
  );
}

/** Interface label as it appears on screen, e.g. a button or menu item. */
function Ui({ children }: { children: ReactNode }) {
  return <span className="dp-ui">{children}</span>;
}

const components: MDXComponents = {
  h2: ({ children }) => <Heading level={2}>{children}</Heading>,
  h3: ({ children }) => <Heading level={3}>{children}</Heading>,
  table: ({ children }) => (
    <div className="dp-table-wrap">
      <table>{children}</table>
    </div>
  ),
  Callout,
  Source,
  Ui,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
