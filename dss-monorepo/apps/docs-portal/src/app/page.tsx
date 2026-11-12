import Link from 'next/link';
import { BarChart3, Code2, GraduationCap, Landmark, School, ShieldCheck } from 'lucide-react';
import PageFrame from '../components/page-frame';
import { docs, groups } from '../content/catalog';
import { getApiCatalog } from '../lib/api-catalog';

const roleEntries = [
  { href: '/docs/guia-rectorado', title: 'Rectorado', text: 'Indicadores institucionales, reportes y predicciones.', Icon: Landmark },
  { href: '/docs/guia-decanato', title: 'Decanato', text: 'Resumen y reportes de tu facultad.', Icon: School },
  { href: '/docs/guia-direccion-de-carrera', title: 'Dirección de carrera', text: 'Indicadores de la carrera asignada.', Icon: GraduationCap },
  { href: '/docs/guia-olap-workspace', title: 'OLAP Workspace', text: 'Consultas propias, gráficos y exportación.', Icon: BarChart3 },
  { href: '/docs/guia-portal-administracion', title: 'Administración', text: 'Usuarios, cierres, ETL y catálogo OLAP.', Icon: ShieldCheck },
];

export default function Home() {
  const services = getApiCatalog();
  const operations = services.reduce((total, service) => total + service.operations.length, 0);

  return (
    <PageFrame crumbs={[{ label: 'Documentación' }]}>
      <article className="dp-article">
        <header className="dp-hero">
          <p className="dp-eyebrow">Sistema de Soporte a Decisiones · UATF</p>
          <h1>Documentación del DSS</h1>
          <p className="dp-lead">
            Manual de uso para autoridades y personal administrativo, y referencia técnica para quienes desarrollan y mantienen el
            sistema.
          </p>
          <div className="dp-hero-actions">
            <Link className="dp-button" href="/docs/acceso-al-sistema">
              Cómo ingresar
            </Link>
            <Link className="dp-button dp-button-secondary" href="/docs/puesta-en-marcha">
              Empezar a desarrollar
            </Link>
          </div>
        </header>

        <section aria-labelledby="por-rol">
          <h2 id="por-rol" className="dp-section-title">
            Guías por rol
          </h2>
          <ul className="dp-cards">
            {roleEntries.map(({ href, title, text, Icon }) => (
              <li key={href}>
                <Link href={href} className="dp-card">
                  <Icon aria-hidden="true" className="dp-card-icon" />
                  <span className="dp-card-title">{title}</span>
                  <span className="dp-card-text">{text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {groups
          .filter((group) => group.id !== 'guias-de-uso')
          .map((group) => (
            <section key={group.id} aria-labelledby={`grupo-${group.id}`}>
              <h2 id={`grupo-${group.id}`} className="dp-section-title">
                {group.title}
              </h2>
              <p className="dp-muted">{group.description}</p>
              <ul className="dp-link-list">
                {docs
                  .filter((doc) => doc.group === group.id)
                  .map((doc) => (
                    <li key={doc.slug}>
                      <Link href={`/docs/${doc.slug}`}>{doc.title}</Link>
                      <span>{doc.summary}</span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}

        <section aria-labelledby="api">
          <h2 id="api" className="dp-section-title">
            Referencia API
          </h2>
          <p className="dp-muted">
            {services.length} contratos OpenAPI · {operations} operaciones.
          </p>
          <ul className="dp-cards dp-cards-compact">
            {services.map((service) => (
              <li key={service.id}>
                <Link href={`/reference/${service.id}`} className="dp-card">
                  <Code2 aria-hidden="true" className="dp-card-icon" />
                  <span className="dp-card-title">{service.name}</span>
                  <span className="dp-card-text">{service.operations.length} operaciones</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </PageFrame>
  );
}
