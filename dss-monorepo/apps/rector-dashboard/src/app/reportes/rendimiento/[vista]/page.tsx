import { notFound } from 'next/navigation';
import { RendimientoViewPanel } from '../../../components/rendimiento/rendimiento-view';
import { RENDIMIENTO_VIEWS, findView } from '../../../components/rendimiento/rendimiento-views';

export function generateStaticParams() {
  return RENDIMIENTO_VIEWS.filter((view) => view.slug !== 'resumen').map((view) => ({ vista: view.slug }));
}

export default async function RendimientoVistaPage({ params }: { params: Promise<{ vista: string }> }) {
  const { vista } = await params;
  const view = findView(vista);
  if (!view || view.slug === 'resumen') notFound();
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Rendimiento académico</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{view.title}</h1>
      </header>
      <RendimientoViewPanel key={view.slug} view={view} />
    </div>
  );
}
