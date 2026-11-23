import { notFound } from 'next/navigation';
import { RENDIMIENTO_VIEWS, RendimientoViewPanel, findView } from '@dss-monorepo/academic-analytics/panel';

export function generateStaticParams() {
  return RENDIMIENTO_VIEWS.filter((view) => view.slug !== 'resumen').map((view) => ({ vista: view.slug }));
}

export default async function Page({ params }: { params: Promise<{ vista: string }> }) {
  const { vista } = await params;
  const view = findView(vista);
  if (!view || view.slug === 'resumen') notFound();
  return (
    <RendimientoViewPanel key={view.slug} view={view} scope="career" eyebrow="Rendimiento académico" />
  );
}
