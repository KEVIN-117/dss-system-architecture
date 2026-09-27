# @dss-monorepo/auth

Cliente de sesión para los portales DSS. Su API pública no integra un cliente OIDC,
no lee variables de entorno ni guarda tokens en React, `localStorage` o
`sessionStorage`. Inicia el flujo en el BFF y lee la sesión mediante
`GET /api/auth/me`.

```tsx
'use client';

import { AuthProvider, ProtectedRoute } from '@dss-monorepo/auth';
import { RoleGuard } from '@dss-monorepo/rbac';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider bffBaseUrl={process.env.NEXT_PUBLIC_BFF_URL!}>
      {children}
    </AuthProvider>
  );
}

export function AdministrationPage() {
  return (
    <ProtectedRoute>
      <RoleGuard rolesAllowed={['SUPERADMIN']}>
        <main>Administración</main>
      </RoleGuard>
    </ProtectedRoute>
  );
}
```

`login()` y `register()` redirigen el navegador al BFF. El BFF inicia
Authorization Code + PKCE y Keycloak presenta el formulario de credenciales
con el tema `dss`; la biblioteca no conoce ni procesa contraseña alguna.
`logout()` redirige al logout BFF/Keycloak. `getToken()` siempre devuelve
`undefined`: los portales no deben llamar servicios protegidos directamente.

La entrada `@dss-monorepo/auth/server` ofrece `DssAuthProvider` para layouts
de servidor y recibe únicamente `bffBaseUrl`. Las credenciales de Keycloak,
la URL de `auth-service` y los secretos se resuelven exclusivamente en BFF.

`ProtectedRoute` y RBAC controlan la presentación. La autorización efectiva
se aplica en rutas BFF y servicios mediante sus guards.

Los cuatro dashboards (`admin-portal`, `decano-dashboard`,
`director-dashboard` y `rector-dashboard`) montan el mismo `AuthProvider` en
un wrapper cliente y exponen `/login`. Las páginas protegidas usan
`ProtectedRoute` a nivel de página para que el login no quede bloqueado por el
layout raíz:

```tsx
import { ProtectedRoute } from '@dss-monorepo/auth';
import { RoleGuard } from '@dss-monorepo/rbac';
import { AccessDenied } from '@dss-monorepo/design-system';

export default function DashboardPage() {
  return (
    <ProtectedRoute
      unauthenticatedFallback={<a href="/login">Iniciar sesión</a>}
    >
      <RoleGuard rolesAllowed={['DECANO']} fallback={<AccessDenied portalName="del decano" />}>
        <Dashboard />
      </RoleGuard>
    </ProtectedRoute>
  );
}
```

`ProtectedRoute` distingue la ausencia de sesión de la autorización: usa
`unauthenticatedFallback` solo cuando no existe una sesión válida. La política
de roles pertenece a `@dss-monorepo/rbac`; combina el guard de sesión con
`RoleGuard` o `<Can>` para mostrar un estado de acceso no autorizado a un
usuario que sí inició sesión pero no tiene el rol necesario. `requiredRoles` y
`unauthorizedFallback` se conservan temporalmente como API deprecada.

`ProtectedRoute` solo controla la presentación. Las APIs siguen exigiendo la
sesión BFF y sus reglas de autorización en el servidor.

`docs-portal` permanece público porque sirve documentación; no participa en el
flujo de sesión de los dashboards.

```bash
bun x nx test @dss-monorepo/auth
bun x nx typecheck @dss-monorepo/auth
bun x nx lint @dss-monorepo/auth
bun x nx build @dss-monorepo/auth
```
