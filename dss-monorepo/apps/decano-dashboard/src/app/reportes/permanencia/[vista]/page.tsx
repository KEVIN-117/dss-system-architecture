import { notFound } from 'next/navigation';
import {
  PERMANENCIA_VIEWS,
  RendimientoViewPanel,
  findPermanenciaView,
} from '@dss-monorepo/academic-analytics/panel';

export function generateStaticParams() {
  return PERMANENCIA_VIEWS.filter((view) => view.slug !== 'resumen').map(
    (view) => ({ vista: view.slug }),
  );
}

export default async function PermanenciaVistaPage({
  params,
}: {
  params: Promise<{ vista: string }>;
}) {
  const { vista } = await params;
  const view = findPermanenciaView(vista);
  if (!view || view.slug === 'resumen') notFound();
  return (
    <RendimientoViewPanel
      key={view.slug}
      view={view}
      scope="faculty"
      eyebrow={view.section ?? 'Permanencia académica'}
    />
  );
}
