import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MethodBadge, ParameterTable, SchemaTree } from '../../../../components/api-parts';
import CodeTabs from '../../../../components/code-tabs';
import InlineMd from '../../../../components/inline-md';
import PageFrame from '../../../../components/page-frame';
import type { TocItem } from '../../../../components/toc';
import { findOperation, getApiCatalog } from '../../../../lib/api-catalog';
import { buildCodeSamples } from '../../../../lib/code-samples';

type Params = { params: Promise<{ service: string; operation: string }> };

export function generateStaticParams() {
  return getApiCatalog().flatMap((service) =>
    service.operations.map((operation) => ({ service: service.id, operation: operation.referenceSlug })),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { service, operation } = await params;
  const found = findOperation(service, operation);
  return found ? { title: `${found.operation.summary} · ${found.service.name}` } : {};
}

export default async function ApiReferencePage({ params }: Params) {
  const { service: serviceId, operation: slug } = await params;
  const found = findOperation(serviceId, slug);
  if (!found) notFound();
  const { service, operation } = found;
  const { samples, isTemplate } = buildCodeSamples(operation);

  const toc: TocItem[] = [
    { id: 'autenticacion', text: 'Autenticación', depth: 2 },
    ...(operation.parameters.length ? [{ id: 'parametros', text: 'Parámetros', depth: 2 as const }] : []),
    ...(operation.requestContentType ? [{ id: 'cuerpo', text: 'Cuerpo de la solicitud', depth: 2 as const }] : []),
    { id: 'respuestas', text: 'Respuestas', depth: 2 },
    { id: 'ejemplos', text: 'Ejemplos de código', depth: 2 },
  ];

  return (
    <PageFrame
      crumbs={[
        { href: '/reference', label: 'Referencia API' },
        { href: `/reference/${service.id}`, label: service.name },
        { label: operation.summary },
      ]}
      toc={toc}
    >
      <article className="dp-article">
        <header className="dp-doc-header">
          <p className="dp-eyebrow">
            {service.name} · {operation.tags.join(' · ') || 'Operación'}
          </p>
          <h1>{operation.summary}</h1>
          <div className="dp-endpoint">
            <MethodBadge method={operation.method} large />
            <code>{operation.path}</code>
          </div>
          {operation.description && <p className="dp-lead"><InlineMd text={operation.description} /></p>}
          <p className="dp-meta">
            <span className="dp-badge">{operation.serviceVersion}</span>
            <a href={`https://github.com/KEVIN-117/dss-system-architecture/blob/main/${operation.sourcePath}`} target="_blank" rel="noreferrer">
              Contrato OpenAPI
            </a>
          </p>
        </header>

        <div className="dp-prose">
          <h2 id="autenticacion">Autenticación</h2>
          <p>{operation.auth}</p>
          {operation.permission && (
            <p>
              Permiso o rol requerido: <code>{operation.permission}</code>
            </p>
          )}

          {operation.parameters.length > 0 && (
            <>
              <h2 id="parametros">Parámetros</h2>
              <ParameterTable parameters={operation.parameters} />
            </>
          )}

          {operation.requestContentType && (
            <>
              <h2 id="cuerpo">Cuerpo de la solicitud</h2>
              <p>
                <span className="dp-badge">{operation.requestContentType}</span>{' '}
                {operation.requestRequired ? 'Requerido.' : 'Opcional.'}
              </p>
              <SchemaTree fields={operation.requestFields} />
            </>
          )}

          <h2 id="respuestas">Respuestas</h2>
          <div className="dp-responses">
            {operation.responses.map((response) => (
              <details key={response.status} className="dp-response" open={response.status.startsWith('2') || undefined}>
                <summary>
                  <span className={`dp-status dp-status-${response.status[0]}`}>{response.status}</span>
                  <span><InlineMd text={response.description} /></span>
                  {response.contentTypes.length > 0 && <small>{response.contentTypes.join(', ')}</small>}
                </summary>
                <div className="dp-response-body">
                  {response.schemaFields.length > 0 ? <SchemaTree fields={response.schemaFields} /> : <p className="dp-muted">Sin esquema declarado.</p>}
                  {response.example !== undefined && (
                    <pre className="dp-pre">
                      <code>{JSON.stringify(response.example, null, 2)}</code>
                    </pre>
                  )}
                </div>
              </details>
            ))}
          </div>

          <h2 id="ejemplos">Ejemplos de código</h2>
          <p className="dp-muted">
            Define <code>BASE_URL</code> con la URL del servicio (o del BFF para sus rutas) y{' '}
            {operation.authKinds.includes('cookie') ? 'usa la cookie de sesión del navegador' : <>
              <code>TOKEN</code> con un access token válido
            </>}
            .{' '}
            {isTemplate
              ? 'El cuerpo es una plantilla generada desde el esquema: reemplaza cada valor antes de enviarlo.'
              : operation.requestExample !== undefined
                ? 'El cuerpo proviene del ejemplo declarado en el contrato.'
                : ''}
          </p>
          <CodeTabs samples={samples} />
        </div>
      </article>
    </PageFrame>
  );
}
