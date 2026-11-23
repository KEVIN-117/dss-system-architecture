import {
  RendimientoViewPanel,
  findView,
} from '@dss-monorepo/academic-analytics/panel';

export default function Page() {
  const view = findView('resumen');
  if (!view) return null;
  return (
    <RendimientoViewPanel
      view={view}
      scope="faculty"
      eyebrow="Rendimiento académico"
    />
  );
}
