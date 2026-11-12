import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MethodBadge } from '../../../components/api-parts';
import InlineMd from '../../../components/inline-md';
import PageFrame from '../../../components/page-frame';
import { getApiCatalog } from '../../../lib/api-catalog';
import { slugify } from '../../../lib/slug';

type Params = { params: Promise<{ service: string }> };

export function generateStaticParams() {
  return getApiCatalog().map((service) => ({ service: service.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { service: serviceId } = await params;
  const service = getApiCatalog().find((item) => item.id === serviceId);
  return service ? { title: service.name } : {};
}

export default async function ServicePage({ params }: Params) {
  const { service: serviceId } = await params;
  const service = getApiCatalog().find((item) => item.id === serviceId);
  if (!service) notFound();

  const tags = [...new Set(service.operations.flatMap((operation) => (operation.tags.length ? operation.tags : ['Operaciones'])))];

  return (
    <PageFrame
      crumbs={[{ href: '/reference', label: 'Referencia API' }, { label: service.name }]}
      toc={tags.map((tag) => ({ id: slugify(tag), text: tag, depth: 2 as const }))}
    >
      <article className="dp-article">
        <header className="dp-doc-header">
          <p className="dp-eyebrow">Referencia API</p>
          <h1>{service.name}</h1>
          {service.description && <p className="dp-lead"><InlineMd text={service.description} /></p>}
          <p className="dp-meta">
            <span className="dp-badge">{service.version}</span>
            <a href={`https://github.com/KEVIN-117/dss-system-architecture/blob/main/${service.sourcePath}`} target="_blank" rel="noreferrer">
              {service.sourcePath}
            </a>
          </p>
        </header>
        <div className="dp-prose">
          {tags.map((tag) => (
            <section key={tag}>
              <h2 id={slugify(tag)}>{tag}</h2>
              <ul className="dp-operation-list">
                {service.operations
                  .filter((operation) => (operation.tags.length ? operation.tags.includes(tag) : tag === 'Operaciones'))
                  .map((operation) => (
                    <li key={operation.id}>
                      <Link href={`/reference/${service.id}/${operation.referenceSlug}`}>
                        <MethodBadge method={operation.method} />
                        <code>{operation.path}</code>
                        <span>{operation.summary}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </article>
    </PageFrame>
  );
}
