# @dss-monorepo/rbac

Controles declarativos de presentación para los roles y permisos DSS. La
librería no sustituye la autorización del BFF ni de los servicios: cada API
debe validar el JWT, el rol y el contexto académico en el servidor.

## Política

`RECTOR` hereda `DECANO` y `DIRECTOR`; `DECANO` hereda `DIRECTOR`.
`SUPERADMIN` es un rol técnico aislado y no hereda permisos académicos.

| Rol | Permisos efectivos |
| --- | --- |
| `DIRECTOR` | `analytics:read`, `analytics:career` |
| `DECANO` | permisos de `DIRECTOR`, `analytics:faculty`, `pipelines:read` |
| `RECTOR` | permisos de `DECANO`, `analytics:global`, `connectors:read` |
| `SUPERADMIN` | `users:*`, `connectors:*`, `pipelines:*` |

El catálogo está cerrado y tipado mediante `DSSPermission`. Añadir un permiso
requiere actualizar `ROLE_PERMISSIONS` y sus pruebas.

## `<Can>`

```tsx
'use client';

import { Can } from '@dss-monorepo/rbac';

export function FacultyPanel() {
  return (
    <Can role="DECANO" fallback={<p>Sin acceso</p>}>
      <FacultyDashboard />
    </Can>
  );
}

export function RunPipeline() {
  return (
    <Can permission="pipelines:execute" fallback={<DisabledRunButton />}>
      <RunPipelineButton />
    </Can>
  );
}
```

`role` y `roles` respetan la jerarquía; `permission` y `permissions` usan los
permisos efectivos. `match="any"` es el valor predeterminado y `match="all"`
requiere todos los elementos. Una lista vacía, una sesión inexistente o una
sesión en carga fallan cerrado y muestran `fallback` o `loadingFallback`.

La negación de roles es exacta para que `not role="DIRECTOR"` oculte el
contenido únicamente a usuarios con el rol literal `DIRECTOR`; no lo oculta a
`DECANO`, `RECTOR` ni `SUPERADMIN`. La negación de permisos invierte el chequeo
del catálogo. Los hijos también pueden ser una función `(allowed) => ReactNode`;
en ese caso el resultado se entrega directamente y no se usa `fallback`.

`RoleGate` sigue disponible como adaptador compatible, pero está deprecado.
Usa `<Can>` para código nuevo. `useCan(check)` devuelve `false` durante la
carga o sin sesión, y `useMyPermissions()` devuelve un `ReadonlySet` memoizado
para controles imperativos o diagnósticos.

## Uso en servidor

```ts
import {
  hasRequiredPermissions,
  type DSSPermission,
} from '@dss-monorepo/rbac/server';

const required: DSSPermission[] = ['pipelines:execute'];
if (!hasRequiredPermissions(roles, required)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

La entrada `@dss-monorepo/rbac/server` solo exporta funciones, tipos y mapas
puros; no carga React. En el BFF se recomienda usar `requireRoles()` o
`requirePermissions()` después de autenticar la cookie o el token.

## Verificación

```bash
bun x nx test @dss-monorepo/rbac
bun x nx typecheck @dss-monorepo/rbac
bun x nx lint @dss-monorepo/rbac
bun x nx build @dss-monorepo/rbac
```
