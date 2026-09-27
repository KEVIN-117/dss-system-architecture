# Landing pública del DSS

La landing es la entrada pública y el punto central de inicio de sesión del
Decision Support System de la UATF. No recibe credenciales ni conoce secretos:
inicia el flujo Authorization Code + PKCE mediante el BFF y consulta la sesión
con `GET /api/auth/me`.

## Flujo

1. `/` presenta la plataforma y enlaza a `/login`.
2. `/login` monta `AuthProvider` a través de `LandingAuthProvider` y muestra
   `AuthLanding` desde el Design System.
3. `useAuth().login()` redirige al BFF con `/auth/callback` como `returnTo`.
4. El BFF intercambia el código con Keycloak, valida la sesión y crea la cookie
   segura. La landing nunca recibe tokens.
5. `/auth/callback` consulta la sesión y `TrafficRouter` envía al usuario al
   portal correspondiente a su rol más alto.
6. Una sesión válida sin rol DSS muestra `AccessDenied` y no reinicia el login.

## Tema y paleta

La landing pública usa exclusivamente el tema oscuro institucional DSS. El
`html` raíz conserva `dark` y `data-theme="dsa"` como identidad neutra antes de
conocer el rol. Los colores proceden de los tokens de
`@dss-monorepo/design-system`; la landing no declara una paleta paralela.

Los temas por rol (`superadmin`, `rector`, `decano` y `director`) siguen siendo
responsabilidad del Design System y de los portales autenticados. La landing no
los aplica antes de completar la redirección.

## Variables públicas

Copia `.env.example` para desarrollo local:

```dotenv
LANDING_PORT=3000
NEXT_PUBLIC_BFF_URL=http://localhost:3006
NEXT_PUBLIC_ADMIN_PORTAL_URL=http://localhost:3001
NEXT_PUBLIC_RECTOR_DASHBOARD_URL=http://localhost:3004
NEXT_PUBLIC_DECANO_DASHBOARD_URL=http://localhost:3002
NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL=http://localhost:3003
```

Solo las variables `NEXT_PUBLIC_*` se exponen al navegador. Los secretos de
Keycloak, la URL interna de `auth-service` y la cookie de sesión pertenecen al
BFF.

## Comandos

```bash
bun nx run @dss-monorepo/landing:dev
bun nx test @dss-monorepo/landing
bun nx run @dss-monorepo/landing-e2e:e2e
```

Las pruebas E2E cubren la entrada pública, el login sin campos de contraseña,
la sesión sin rol y la sesión no autenticada mediante respuestas simuladas del
BFF.
