
import { Button } from '@dss-monorepo/design-system';

export default function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">DSS Admin Portal</h1>
      <div className="flex gap-2">
        <Button variant="default">Botón Primario (Admin)</Button>
        <Button variant="outline">Botón Secundario</Button>
        <Button variant="destructive">Acción Crítica</Button>
      </div>
    </main>
  );
}
