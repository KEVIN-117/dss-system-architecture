import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getApiCatalog } from '../../../../lib/api-catalog';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return getApiCatalog().flatMap((service) =>
    service.operations.map((operation) => ({
      service: service.id,
      operation: operation.referenceSlug,
    })),
  );
}

function SchemaFields({
  fields,
  level = 0,
}: {
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    enum?: string[];
    children?: Array<any>;
  }>;
  level?: number;
}) {
  if (!fields.length)
    return <p>El contrato no declara propiedades para este esquema.</p>;
  return (
    <ul className="schemaFields">
      {fields.map((field) => (
        <li key={`${level}-${field.name}`}>
          <code>{field.name}</code>
          <span>
            {field.type}
            {field.required ? ' · requerido' : ''}
          </span>
          {field.enum?.length ? (
            <small>Valores: {field.enum.join(', ')}</small>
          ) : null}
          {field.description ? <small>{field.description}</small> : null}
          {field.children?.length ? (
            <SchemaFields fields={field.children} level={level + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function ApiReferencePage({
  params,
}: {
  params: Promise<{ service: string; operation: string }>;
}) {
  const { service: serviceId, operation: operationId } = await params;
  const service = getApiCatalog().find((item) => item.id === serviceId);
  const operation = service?.operations.find(
    (item) => item.referenceSlug === operationId,
  );
  if (!service || !operation) notFound();
  const curl = [
    `curl --request ${operation.method}`,
    `  --url 'https://<base-url>${operation.path}'`,
    ...(operation.auth.includes('Bearer')
      ? ["  --header 'Authorization: Bearer <token>'"]
      : []),
    ...(operation.requestContentType
      ? [`  --header 'Content-Type: ${operation.requestContentType}'`]
      : []),
    ...(operation.requestExample !== undefined
      ? [`  --data '${JSON.stringify(operation.requestExample)}'`]
      : []),
  ].join(' \\\n');
  return (
    <main className="docsPage">
      <nav>
        <Link href="/">DSS UATF · Documentación</Link>
        <span>/</span>
        <Link href="/docs/inventario-de-apis">APIs</Link>
        <span>/</span>
        <span>{service.name}</span>
      </nav>
      <article className="docsArticle">
        <header>
          <p>REFERENCIA API · {service.version}</p>
          <h1>{operation.summary}</h1>
          <p>
            <strong>{operation.method}</strong> <code>{operation.path}</code>
          </p>
          <p>{operation.description}</p>
        </header>
        <section>
          <h2>Autenticación y permisos</h2>
          <p>
            {operation.auth}
            {operation.permission ? ` · Permiso: ${operation.permission}` : ''}
          </p>
        </section>
        <section>
          <h2>Parámetros</h2>
          {operation.parameters.length ? (
            <SchemaFields
              fields={operation.parameters.map((p) => ({
                name: `${p.name} (${p.location})`,
                type: p.schemaType ?? 'sin tipo',
                required: p.required,
                description: [
                  p.description,
                  p.defaultValue !== undefined
                    ? `Predeterminado: ${p.defaultValue}`
                    : undefined,
                  p.minimum !== undefined || p.maximum !== undefined
                    ? `Rango: ${p.minimum ?? 'sin mínimo'}–${p.maximum ?? 'sin máximo'}`
                    : undefined,
                  p.enum?.length ? `Valores: ${p.enum.join(', ')}` : undefined,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />
          ) : (
            <p>El contrato no declara parámetros.</p>
          )}
        </section>
        <section>
          <h2>Solicitud</h2>
          {operation.requestContentType ? (
            <>
              <p>
                {operation.requestContentType} ·{' '}
                {operation.requestRequired ? 'requerida' : 'opcional'}
              </p>
              <SchemaFields fields={operation.requestFields} />
              {operation.requestExample !== undefined ? (
                <pre>
                  <code>
                    {JSON.stringify(operation.requestExample, null, 2)}
                  </code>
                </pre>
              ) : (
                <p>El YAML no declara un ejemplo de solicitud.</p>
              )}
            </>
          ) : (
            <p>El contrato no define cuerpo de solicitud.</p>
          )}
          <h3>Comando curl</h3>
          <p>
            Reemplaza la URL base y, si corresponde, el token con valores del
            entorno autorizado. Si no existe ejemplo en YAML, este comando no
            añade un cuerpo inventado.
          </p>
          <pre>
            <code>{curl}</code>
          </pre>
        </section>
        <section>
          <h2>Respuestas</h2>
          {operation.responses.map((response) => (
            <div key={response.status}>
              <h3>
                {response.status} · {response.description}
              </h3>
              <p>
                {response.contentTypes.join(', ') || 'Sin cuerpo documentado'}
              </p>
              {response.schemaFields.length ? (
                <SchemaFields fields={response.schemaFields} />
              ) : null}
              {response.example !== undefined ? (
                <pre>
                  <code>{JSON.stringify(response.example, null, 2)}</code>
                </pre>
              ) : (
                <p>El YAML no declara un ejemplo para esta respuesta.</p>
              )}
            </div>
          ))}
        </section>
        <footer>
          <a
            href={`https://github.com/KEVIN-117/dss-system-architecture/blob/feature/DOC-001/${operation.sourcePath}`}
          >
            Abrir contrato YAML ↗
          </a>
        </footer>
      </article>
    </main>
  );
}
