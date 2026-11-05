import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { documents } from '../../../content/registry';

export const dynamic = 'force-dynamic';

type SessionProfile = { roles?: Array<string | { name?: string; role?: string }> };

async function hasRequiredRole(requiredRoles: readonly string[]): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ');
  const baseUrl = process.env.DOCS_BFF_INTERNAL_URL ?? 'http://localhost:3006';
  try {
    const response = await fetch(new URL('/api/auth/me', baseUrl), {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const session = (await response.json()) as SessionProfile;
    const roles = new Set((session.roles ?? []).map((role) => typeof role === 'string' ? role : role.name ?? role.role ?? ''));
    return requiredRoles.some((role) => roles.has(role) || roles.has(`ROLE_${role}`));
  } catch {
    return false;
  }
}

export function generateStaticParams() {
  return documents.map(({ slug }) => ({ slug }));
}

export default async function DocumentationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = documents.find((item) => item.slug === slug);
  if (!entry) notFound();

  if (entry.classification === 'restricted' && !await hasRequiredRole(entry.requiredRoles)) {
    const bffUrl = process.env.DOCS_BFF_PUBLIC_URL ?? 'http://localhost:3006';
    const returnTo = encodeURIComponent(`${process.env.DOCS_PUBLIC_URL ?? 'http://localhost:3005'}/docs/${entry.slug}`);
    return <main className="docsPage"><nav><Link href="/">DSS UATF · Documentación</Link></nav><section className="docsAccess" aria-labelledby="access-title"><h1 id="access-title">Acceso restringido</h1><p>Esta guía requiere una sesión institucional con el rol autorizado. El contenido no se entrega mientras la sesión o el servicio de identidad no puedan verificarse.</p><a className="docsButton" href={`${bffUrl}/api/auth/login?returnTo=${returnTo}`}>Iniciar sesión institucional</a><p><Link href="/docs/identidad-y-acceso">Consultar la guía pública de identidad y acceso</Link></p></section></main>;
  }

  const Content = entry.Component;
  return <main className="docsPage"><nav><Link href="/">DSS UATF · Documentación</Link><span>/</span><span>{entry.title}</span></nav><article className="docsArticle"><header><p>DOCUMENTACIÓN · {entry.classification === 'restricted' ? 'RESTRINGIDA' : 'PÚBLICA'}</p><h1>{entry.title}</h1><a href={`https://github.com/KEVIN-117/dss-system-architecture/blob/main/dss-monorepo/apps/docs-portal/src/content/${entry.source}`}>Ver fuente MDX ↗</a></header><Content /></article><footer><Link href="/docs/inventario-de-apis">Inventario de APIs</Link><a href="https://github.com/KEVIN-117/dss-system-architecture/issues/new?title=Documentaci%C3%B3n%20desactualizada">Reportar contenido desactualizado ↗</a></footer></main>;
}
