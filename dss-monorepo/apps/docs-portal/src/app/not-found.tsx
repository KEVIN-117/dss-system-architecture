import Link from 'next/link';
import PageFrame from '../components/page-frame';

export default function NotFound() {
  return (
    <PageFrame crumbs={[{ href: '/', label: 'Documentación' }, { label: 'Página no encontrada' }]} footer={false}>
      <article className="dp-article">
        <header className="dp-doc-header">
          <p className="dp-eyebrow">Error 404</p>
          <h1>No encontramos esta página</h1>
          <p className="dp-lead">Puede que la guía haya cambiado de nombre. Usa el buscador (Ctrl K) o vuelve al inicio.</p>
        </header>
        <Link className="dp-button" href="/">
          Ir al inicio
        </Link>
      </article>
    </PageFrame>
  );
}
