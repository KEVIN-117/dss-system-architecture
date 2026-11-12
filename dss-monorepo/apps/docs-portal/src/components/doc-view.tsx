import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import PageFrame from './page-frame';
import { docs, findDoc, groupTitle, type DocMeta } from '../content/catalog';
import { components } from '../content/registry';
import { headingsOf, readRaw } from '../lib/content';

type SessionProfile = { roles?: Array<string | { name?: string; role?: string }> };

const classificationLabel = {
  public: 'Pública',
  'public-summary': 'Resumen público',
  restricted: 'Restringida',
} as const;

/** Asks the BFF for the current session; any failure denies access (fail closed). */
async function hasRequiredRole(requiredRoles: readonly string[]): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  const baseUrl = process.env.DOCS_BFF_INTERNAL_URL ?? 'http://localhost:3006';
  try {
    const response = await fetch(new URL('/api/auth/me', baseUrl), {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const session = (await response.json()) as SessionProfile;
    const roles = new Set(
      (session.roles ?? []).map((role) => (typeof role === 'string' ? role : (role.name ?? role.role ?? ''))),
    );
    return requiredRoles.some((role) => roles.has(role) || roles.has(`ROLE_${role}`));
  } catch {
    return false;
  }
}

export function docMetadata(slug: string) {
  const doc = findDoc(slug);
  return doc ? { title: doc.title, description: doc.summary } : {};
}

/**
 * Renders one guide inside the shared frame. Public guides are rendered by the
 * static `/docs/[slug]` route; each restricted guide has its own dynamic route
 * so the session check runs on every request.
 */
export default async function DocView({ slug, expect }: { slug: string; expect: 'public' | 'restricted' }) {
  const doc = findDoc(slug);
  const Content = doc ? components[doc.slug] : undefined;
  const isRestricted = doc?.classification === 'restricted';
  if (!doc || !Content || isRestricted !== (expect === 'restricted')) notFound();

  const crumbs = [{ href: '/', label: 'Documentación' }, { label: groupTitle(doc.group) }, { label: doc.title }];

  if (isRestricted && !(await hasRequiredRole(doc.requiredRoles ?? []))) {
    return <AccessDenied doc={doc} crumbs={crumbs} />;
  }

  const position = docs.indexOf(doc);
  const previous = docs[position - 1];
  const next = docs[position + 1];

  return (
    <PageFrame crumbs={crumbs} toc={headingsOf(readRaw(doc))}>
      <article className="dp-article">
        <header className="dp-doc-header">
          <p className="dp-eyebrow">{groupTitle(doc.group)}</p>
          <h1>{doc.title}</h1>
          <p className="dp-lead">{doc.summary}</p>
          <p className="dp-meta">
            <span className={`dp-badge dp-badge-${doc.classification}`}>{classificationLabel[doc.classification]}</span>
            <a
              href={`https://github.com/KEVIN-117/dss-system-architecture/blob/main/dss-monorepo/apps/docs-portal/src/content/${doc.source}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver fuente
            </a>
          </p>
        </header>
        <div className="dp-prose">
          <Content />
        </div>
        <nav className="dp-pager" aria-label="Guías contiguas">
          {previous ? (
            <Link href={`/docs/${previous.slug}`} className="dp-pager-link">
              <small>Anterior</small>
              {previous.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/docs/${next.slug}`} className="dp-pager-link dp-pager-next">
              <small>Siguiente</small>
              {next.title}
            </Link>
          )}
        </nav>
      </article>
    </PageFrame>
  );
}

function AccessDenied({ doc, crumbs }: { doc: DocMeta; crumbs: Array<{ href?: string; label: string }> }) {
  const bffUrl = process.env.DOCS_BFF_PUBLIC_URL ?? 'http://localhost:3006';
  const returnTo = encodeURIComponent(`${process.env.DOCS_PUBLIC_URL ?? 'http://localhost:3005'}/docs/${doc.slug}`);
  return (
    <PageFrame crumbs={crumbs}>
      <section className="dp-access" aria-labelledby="access-title">
        <Lock aria-hidden="true" />
        <h1 id="access-title">Acceso restringido</h1>
        <p>
          «{doc.title}» requiere una sesión institucional con el rol {(doc.requiredRoles ?? []).join(' o ')}. El contenido no se
          muestra mientras la sesión o el servicio de identidad no puedan verificarse.
        </p>
        <a className="dp-button" href={`${bffUrl}/api/auth/login?returnTo=${returnTo}`}>
          Iniciar sesión institucional
        </a>
        <p>
          <Link href="/docs/acceso-al-sistema">Cómo ingresar al sistema</Link>
        </p>
      </section>
    </PageFrame>
  );
}
