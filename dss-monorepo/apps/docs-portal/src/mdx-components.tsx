import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';

function Callout({ title, children }: { title: string; children: ReactNode }) {
  return <aside className="mdxCallout"><strong>{title}</strong><div>{children}</div></aside>;
}

function Source({ path, label }: { path: string; label: string }) {
  return <a href={`https://github.com/kevin-117/dss-system-architecture/blob/main/${path}`} target="_blank" rel="noreferrer">{label} ↗</a>;
}

const components: MDXComponents = { Callout, Source };

export function useMDXComponents(): MDXComponents {
  return components;
}
