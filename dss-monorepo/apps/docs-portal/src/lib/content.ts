import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { docs, groupTitle, type DocMeta } from '../content/catalog';
import { getApiCatalog } from './api-catalog';
import { slugify } from './slug';

export type Heading = { depth: 2 | 3; text: string; id: string };

export type SearchEntry = {
  href: string;
  kind: 'guide' | 'section' | 'api';
  title: string;
  context: string;
  text: string;
  method?: string;
};

function contentRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'content'),
    path.join(process.cwd(), 'apps', 'docs-portal', 'src', 'content'),
  ];
  const root = candidates.find((candidate) => existsSync(candidate));
  if (!root) throw new Error('No se encontró src/content del portal.');
  return root;
}

const rawCache = new Map<string, string>();

export function readRaw(doc: DocMeta): string {
  const cached = rawCache.get(doc.source);
  if (cached !== undefined && process.env.NODE_ENV === 'production') return cached;
  const raw = readFileSync(path.join(contentRoot(), doc.source), 'utf8');
  rawCache.set(doc.source, raw);
  return raw;
}

/** Markdown/MDX to plain text good enough for search snippets. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/^export const .*$/gm, '')
    .replace(/<Source[^>]*\/>/g, '')
    .replace(/<Callout title="([^"]*)">/g, '$1. ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>|#]/g, ' ')
    .replace(/^\s*(\d+\.|-)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function headingsOf(raw: string): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (match) {
      const text = match[2].replace(/[`*]/g, '');
      headings.push({ depth: match[1].length as 2 | 3, text, id: slugify(text) });
    }
  }
  return headings;
}

function sectionsOf(raw: string): Array<{ heading?: string; body: string }> {
  const sections: Array<{ heading?: string; lines: string[] }> = [{ lines: [] }];
  for (const line of raw.split(/\r?\n/)) {
    const match = /^#{2,3}\s+(.+?)\s*$/.exec(line);
    if (match) sections.push({ heading: match[1].replace(/[`*]/g, ''), lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }
  return sections.map((section) => ({ heading: section.heading, body: toPlainText(section.lines.join('\n')) }));
}

let searchCache: SearchEntry[] | undefined;

/**
 * Full-text index for the client search. Restricted guides contribute only
 * their title and summary so their procedures never reach an anonymous browser.
 */
export function buildSearchIndex(): SearchEntry[] {
  if (searchCache && process.env.NODE_ENV === 'production') return searchCache;
  const entries: SearchEntry[] = [];

  for (const doc of docs) {
    const context = groupTitle(doc.group);
    entries.push({ href: `/docs/${doc.slug}`, kind: 'guide', title: doc.title, context, text: doc.summary });
    if (doc.classification === 'restricted') continue;
    for (const section of sectionsOf(readRaw(doc))) {
      if (!section.body && !section.heading) continue;
      entries.push({
        href: section.heading ? `/docs/${doc.slug}#${slugify(section.heading)}` : `/docs/${doc.slug}`,
        kind: 'section',
        title: section.heading ?? doc.title,
        context: section.heading ? doc.title : context,
        text: section.body,
      });
    }
  }

  for (const service of getApiCatalog()) {
    for (const operation of service.operations) {
      entries.push({
        href: `/reference/${service.id}/${operation.referenceSlug}`,
        kind: 'api',
        title: operation.summary,
        context: service.name,
        method: operation.method,
        text: [operation.path, operation.description, operation.tags.join(' '), operation.permission]
          .filter(Boolean)
          .join(' '),
      });
    }
  }

  searchCache = entries;
  return entries;
}
