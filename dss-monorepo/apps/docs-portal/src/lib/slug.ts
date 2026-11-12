import { isValidElement, type ReactNode } from 'react';

/** Removes accents and case so search and anchors behave the same for "Matrícula" and "matricula". */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Stable heading anchor shared by the MDX renderer and the table of contents. */
export function slugify(value: string): string {
  return (
    normalize(value)
      .replace(/`/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-') || 'seccion'
  );
}

/** Plain text of a React node tree, used to derive heading anchors. */
export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}
