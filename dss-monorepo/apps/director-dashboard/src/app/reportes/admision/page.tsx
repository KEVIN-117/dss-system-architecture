import { RendimientoViewPanel, findAdmisionView } from '@dss-monorepo/academic-analytics/panel';

export default function Page() {
  const view = findAdmisionView('resumen');
  if (!view) return null;
  return (
    <RendimientoViewPanel view={view} scope="career" eyebrow="Admisión académica" />
  );
}
