import { Button } from '@dss-monorepo/design-system';
import { ProtectedRoute } from '@dss-monorepo/auth';

export default function Index() {
  return (
    <ProtectedRoute requiredRoles={['DIRECTOR']} unauthorizedFallback={<LoginRequired />}>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">Director Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="default">Nueva Planilla</Button>
          <Button variant="outline">Exportar CSV</Button>
          <Button variant="destructive">Eliminar Registro</Button>
        </div>
      </main>
    </ProtectedRoute>
  );
}

function LoginRequired() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Sesión requerida</h1>
      <p>Inicia sesión para acceder al portal del director.</p>
      <a className="text-primary underline" href="/login">Iniciar sesión</a>
    </main>
  );
}
