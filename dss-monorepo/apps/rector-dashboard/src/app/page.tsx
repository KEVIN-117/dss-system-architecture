import { Button } from '@dss-monorepo/design-system';

export default function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Rector Dashboard</h1>
      <div className="flex gap-2">
        <Button variant="default">Aprobar Presupuesto</Button>
        <Button variant="outline">Ver Historial</Button>
        <Button variant="destructive">Rechazar Plan</Button>
      </div>
    </main>
  );
}
