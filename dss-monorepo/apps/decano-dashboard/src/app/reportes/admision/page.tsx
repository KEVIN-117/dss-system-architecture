import { RendimientoViewPanel, findAdmisionView } from '@dss-monorepo/academic-analytics/panel';

export default function Page() {
  const view = findAdmisionView('resumen');
  if (!view) return null;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Admisión académica</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{view.title}</h1>
      </header>
      <RendimientoViewPanel view={view} scope="faculty" />
    </div>
  );
}
