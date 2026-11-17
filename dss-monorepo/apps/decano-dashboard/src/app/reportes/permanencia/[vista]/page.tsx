import { notFound } from 'next/navigation';
import { PERMANENCIA_VIEWS, RendimientoViewPanel, findPermanenciaView } from '@dss-monorepo/academic-analytics/panel';

export function generateStaticParams() {
  return PERMANENCIA_VIEWS.filter((view) => view.slug !== 'resumen').map((view) => ({ vista: view.slug }));
}

export default async function PermanenciaVistaPage({ params }: { params: Promise<{ vista: string }> }) {
  const { vista } = await params;
  const view = findPermanenciaView(vista);
  if (!view || view.slug === 'resumen') notFound();
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{view.section}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{view.title}</h1>
      </header>
      <RendimientoViewPanel key={view.slug} view={view} scope="faculty" />
    </div>
  );
}
