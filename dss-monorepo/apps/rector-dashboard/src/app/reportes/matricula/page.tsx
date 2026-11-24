import { RendimientoViewPanel, findMatriculaView } from '@dss-monorepo/academic-analytics/panel';

export default function MatriculaResumenPage() {
  const view = findMatriculaView('resumen');
  if (!view) return null;
  return <RendimientoViewPanel view={view} eyebrow="Matrícula" />;
}
