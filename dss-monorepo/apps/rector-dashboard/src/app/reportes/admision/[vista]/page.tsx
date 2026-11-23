import { notFound } from 'next/navigation';
import { RendimientoViewPanel } from '@dss-monorepo/academic-analytics/panel';
import {
  ADMISION_VIEWS,
  findAdmisionView,
} from '@dss-monorepo/academic-analytics/panel';

export function generateStaticParams() {
  return ADMISION_VIEWS.filter((view) => view.slug !== 'resumen').map(
    (view) => ({ vista: view.slug }),
  );
}

export default async function AdmisionVistaPage({
  params,
}: {
  params: Promise<{ vista: string }>;
}) {
  const { vista } = await params;
  const view = findAdmisionView(vista);
  if (!view || view.slug === 'resumen') notFound();
  return (
    <RendimientoViewPanel
      key={view.slug}
      view={view}
      eyebrow={view.section ?? 'Admisión académica'}
    />
  );
}
