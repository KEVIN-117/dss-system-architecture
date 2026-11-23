import {
  RendimientoViewPanel,
  findPermanenciaView,
} from '@dss-monorepo/academic-analytics/panel';

export default function PermanenciaResumenPage() {
  const view = findPermanenciaView('resumen');
  if (!view) return null;
  return (
    <RendimientoViewPanel
      view={view}
      scope="faculty"
      eyebrow={view.section ?? 'Permanencia académica'}
    />
  );
}
