# @dss-monorepo/auth

Cliente de autenticación para los portales DSS. Usa Keycloak para la sesión y
consulta `GET /api/v1/auth/me` de `auth-service` para validar el perfil local
sincronizado.

## Uso

La entrada principal es de cliente. Úsala desde un componente con `"use client"`
o desde un proveedor de aplicación del lado cliente.

```tsx
import { AuthProvider, ProtectedRoute } from '@dss-monorepo/auth';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider
      keycloakUrl={process.env.NEXT_PUBLIC_KEYCLOAK_URL!}
      realm={process.env.NEXT_PUBLIC_KEYCLOAK_REALM!}
      clientId={process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID!}
      authServiceUrl={process.env.NEXT_PUBLIC_AUTH_SERVICE_URL!}
    >
      {children}
    </AuthProvider>
  );
}

export function AdministrationPage() {
  return (
    <ProtectedRoute requiredRoles={['SUPERADMIN']}>
      <main>Administración</main>
    </ProtectedRoute>
  );
}
```

`authServiceUrl` es el origen del servicio, por ejemplo
`http://localhost:8000`; la librería agrega `/api/v1/auth/me`.

La entrada `@dss-monorepo/auth/server` sólo exporta tipos y puede importarse
desde código de servidor sin cargar Keycloak ni APIs del navegador.

## Contrato con auth-service

El perfil se valida contra la respuesta plana de `AuthUserProfile`:

```ts
{
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  academicContexts: Array<{
    id: string;
    userId: string;
    facultyId: number | null;
    careerId: number | null;
  }>;
}
```

Los roles de interfaz se extraen del `access_token` de Keycloak usando el
`clientId` configurado. `ProtectedRoute` mejora la experiencia de navegación,
pero cada API debe comprobar el JWT y sus roles en el servidor.

Si el perfil no existe, está inactivo o no supera la validación de contrato, el
proveedor deja la sesión de la aplicación sin autenticar. No usa los claims del
token como perfil alternativo.

## Seguridad y despliegue

- PKCE está habilitado y el refresh token nunca se expone mediante React ni se
  persiste en `localStorage`, `sessionStorage` o cookies de la aplicación.
- El paquete no crea una cookie de autenticación propia. Una futura sesión BFF
  deberá usar una cookie `HttpOnly`, `Secure` y con la política `SameSite`
  definida por el BFF.
- `auth-service` permite CORS sólo para `AUTH_CORS_ALLOWED_ORIGINS`. En el
  perfil `dev` su valor por defecto cubre los cinco portales locales; en
  producción la variable es obligatoria y debe contener sólo orígenes HTTPS
  conocidos separados por comas; el servicio rechaza cualquier origen local o
  no seguro en ese perfil.
- No publiques secretos de Keycloak ni el secreto del webhook como variables
  `NEXT_PUBLIC_*`.

## Verificación

```bash
bun x nx test @dss-monorepo/auth
bun x nx typecheck @dss-monorepo/auth
bun x nx lint @dss-monorepo/auth
bun x nx build @dss-monorepo/auth
```
