import Link from 'next/link';
import PageFrame from '../../components/page-frame';
import { getApiCatalog } from '../../lib/api-catalog';

export const metadata = { title: 'Referencia API' };

export default function ReferenceIndex() {
  const services = getApiCatalog();
  return (
    <PageFrame crumbs={[{ href: '/', label: 'Documentación' }, { label: 'Referencia API' }]}>
      <article className="dp-article">
        <header className="dp-doc-header">
          <p className="dp-eyebrow">Referencia API</p>
          <h1>Servicios del DSS</h1>
          <p className="dp-lead">
            Operaciones leídas de los contratos OpenAPI versionados en <code>docs/</code>. Todos son borradores: ante una diferencia con la
            implementación, prevalece el código y el contrato debe corregirse.
          </p>
        </header>
        <ul className="dp-cards">
          {services.map((service) => (
            <li key={service.id}>
              <Link href={`/reference/${service.id}`} className="dp-card">
                <span className="dp-card-title">{service.name}</span>
                <span className="dp-card-text">{service.operations.length} operaciones · versión {service.version}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="dp-muted">
          ¿Cómo se mantienen estos contratos? Consulta el <Link href="/docs/inventario-de-apis">inventario de APIs</Link>.
        </p>
      </article>
    </PageFrame>
  );
}
