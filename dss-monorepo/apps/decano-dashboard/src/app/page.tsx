import { Button } from '@dss-monorepo/design-system';
import { ProtectedRoute } from '@dss-monorepo/auth';

export default function Index() {
  return (
    <ProtectedRoute requiredRoles={['DECANO']} unauthorizedFallback={<LoginRequired />}>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">Decano Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="default">Evaluar Docentes</Button>
          <Button variant="outline">Carga Horaria</Button>
          <Button variant="destructive">Cerrar Semestre</Button>
        </div>
      </main>
    </ProtectedRoute>
  );
}

function LoginRequired() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Sesión requerida</h1>
      <p>Inicia sesión para acceder al portal del decano.</p>
      <a className="text-primary underline" href="/login">Iniciar sesión</a>
    </main>
  );
}
