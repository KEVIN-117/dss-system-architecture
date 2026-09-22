# @dss-monorepo/rbac

Controles de presentación basados en los roles DSS que `@dss-monorepo/auth`
obtiene de un access token validado por Keycloak. Esta librería no sustituye la
autorización de los servicios: cada API debe validar el JWT, roles y ámbito
académico en el servidor.

## Política de roles

| Rol | Puede mostrar contenido de |
| --- | --- |
| `SUPERADMIN` | `SUPERADMIN` solamente |
| `RECTOR` | `RECTOR`, `DECANO`, `DIRECTOR` |
| `DECANO` | `DECANO`, `DIRECTOR` |
| `DIRECTOR` | `DIRECTOR` |

`SUPERADMIN` es un rol técnico. No hereda permisos académicos ni permite abrir
dashboards de rectorado, facultad o carrera.

## Uso

```tsx
'use client';

import { RoleGate, usePermission } from '@dss-monorepo/rbac';

export function FacultyPanel() {
  const { hasAccess, isLoading } = usePermission(['DECANO', 'RECTOR']);

  if (isLoading) return <p>Cargando permisos…</p>;
  if (!hasAccess) return null;

  return (
    <RoleGate roles={['DECANO']} fallback={<p>Sin acceso</p>}>
      <FacultyDashboard />
    </RoleGate>
  );
}
```

`RoleGate` usa coincidencia `any` por defecto. Para requerir que un usuario
tenga todas las capacidades indicadas, usa `match="all"`:

```tsx
<RoleGate roles={['DECANO', 'DIRECTOR']} match="all">
  <CombinedView />
</RoleGate>
```

Una lista vacía u omitida no concede acceso. Esto evita que una ruta quede
visible por una configuración incompleta.

`@dss-monorepo/rbac/server` exporta sólo funciones puras (`hasRole`,
`hasRequiredRoles` y la política) para código que no debe cargar React.

## Verificación

```bash
bun x nx test @dss-monorepo/rbac
bun x nx typecheck @dss-monorepo/rbac
bun x nx lint @dss-monorepo/rbac
bun x nx build @dss-monorepo/rbac
```
