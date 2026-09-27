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

## API de compatibilidad y hooks

`RoleGuard` conserva el contrato solicitado inicialmente por la librería. Es
un adaptador de `<Can>` y, por tanto, comparte la misma jerarquía y el mismo
fallo cerrado:

```tsx
import { RoleGuard, useHasPermission, useHasRole } from '@dss-monorepo/rbac';

function FacultyActions() {
  const canRunPipelines = useHasPermission('pipelines:execute');
  const canSeeFaculty = useHasRole(['DECANO', 'RECTOR']);

  return (
    <RoleGuard rolesAllowed={['DECANO', 'RECTOR']} fallback={<p>Sin acceso</p>}>
      {canSeeFaculty && <FacultyDashboard />}
      <RunButton disabled={!canRunPipelines} />
    </RoleGuard>
  );
}
```

`useHasRole()` aplica la jerarquía de roles y `useHasPermission()` resuelve
los permisos efectivos. Ambos aceptan un elemento o una lista, y `match` es
`"any"` por defecto. Durante carga, sin sesión o con una lista vacía devuelven
`false`.

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

Para handlers Web o Next que ya tienen una forma confiable de resolver el
principal, `withRbacMiddleware()` evita copiar la evaluación de políticas:

```ts
import { withRbacMiddleware } from '@dss-monorepo/rbac/server';

export const GET = withRbacMiddleware(
  {
    permissions: ['pipelines:execute'],
    resolvePrincipal: async (request) => {
      const session = await authenticateRequest(request);
      return session.authenticated ? { roles: session.value.roles } : null;
    },
  },
  async () => Response.json({ accepted: true }),
);
```

El resolvedor es responsabilidad de la aplicación: debe partir de una sesión
o token validado. El middleware no lee variables de entorno, no descifra
cookies, no valida JWT ni llama a sistemas externos. Devuelve `401` cuando no
hay principal y `403` cuando la política no se cumple. Los portales no deben
usar este mecanismo para sustituir la autorización del BFF: `<Can>` y los
hooks solo controlan la presentación.

## Verificación

```bash
bun x nx test @dss-monorepo/rbac
bun x nx typecheck @dss-monorepo/rbac
bun x nx lint @dss-monorepo/rbac
bun x nx build @dss-monorepo/rbac
```
