import { Button } from '@dss-monorepo/design-system';

export default function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Decano Dashboard (Dark Mode)</h1>
      <div className="flex gap-2">
        <Button variant="default">Evaluar Docentes</Button>
        <Button variant="outline">Carga Horaria</Button>
        <Button variant="destructive">Cerrar Semestre</Button>
      </div>
    </main>
  );
}
