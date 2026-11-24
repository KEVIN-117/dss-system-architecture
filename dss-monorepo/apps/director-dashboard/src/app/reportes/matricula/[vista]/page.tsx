import { notFound } from 'next/navigation';
import { MATRICULA_VIEWS, RendimientoViewPanel, findMatriculaView } from '@dss-monorepo/academic-analytics/panel';

export function generateStaticParams() {
  return MATRICULA_VIEWS.filter((view) => view.slug !== 'resumen').map((view) => ({ vista: view.slug }));
}

export default async function MatriculaVistaPage({ params }: { params: Promise<{ vista: string }> }) {
  const { vista } = await params;
  const view = findMatriculaView(vista);
  if (!view || view.slug === 'resumen') notFound();
  return <RendimientoViewPanel key={view.slug} view={view} scope="career" eyebrow="Matrícula" />;
}
