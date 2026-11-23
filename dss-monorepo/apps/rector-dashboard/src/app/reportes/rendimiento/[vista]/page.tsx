import { notFound } from 'next/navigation';
import { RendimientoViewPanel } from '@dss-monorepo/academic-analytics/panel';
import {
  RENDIMIENTO_VIEWS,
  findView,
} from '@dss-monorepo/academic-analytics/panel';

export function generateStaticParams() {
  return RENDIMIENTO_VIEWS.filter((view) => view.slug !== 'resumen').map(
    (view) => ({ vista: view.slug }),
  );
}

export default async function RendimientoVistaPage({
  params,
}: {
  params: Promise<{ vista: string }>;
}) {
  const { vista } = await params;
  const view = findView(vista);
  if (!view || view.slug === 'resumen') notFound();
  return (
    <RendimientoViewPanel
      key={view.slug}
      view={view}
      eyebrow="Rendimiento académico"
    />
  );
}
