import { RendimientoViewPanel } from '@dss-monorepo/academic-analytics/panel';
import { findAdmisionView } from '@dss-monorepo/academic-analytics/panel';

export default function AdmisionResumenPage() {
  const view = findAdmisionView('resumen');
  if (!view) return null;
  return (
    <RendimientoViewPanel
      view={view}
      eyebrow={view.section ?? 'Admisión académica'}
    />
  );
}
