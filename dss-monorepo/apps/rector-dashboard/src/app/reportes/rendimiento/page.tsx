import { RendimientoViewPanel } from '@dss-monorepo/academic-analytics/panel';
import { findView } from '@dss-monorepo/academic-analytics/panel';

export default function RendimientoResumenPage() {
  const view = findView('resumen');
  if (!view) return null;
  return <RendimientoViewPanel view={view} eyebrow="Rendimiento académico" />;
}
