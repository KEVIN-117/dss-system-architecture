import { Button } from '@dss-monorepo/design-system';

export default function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Director Dashboard</h1>
      <div className="flex gap-2">
        <Button variant="default">Nueva Planilla</Button>
        <Button variant="outline">Exportar CSV</Button>
        <Button variant="destructive">Eliminar Registro</Button>
      </div>
    </main>
  );
}
