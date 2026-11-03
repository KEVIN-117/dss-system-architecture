# PRED-007: E2E de publicación con Keycloak, BFF y Rector

Este recorrido verifica la integración local completa de publicaciones de abandono de programa con datos Faker del DW:

```text
Rector Dashboard → BFF (sesión OIDC/PKCE) → Prediction API → RabbitMQ → worker
      ↑                    ↓                                  ↓
      └──── GraphQL ───────┘                         DW de solo lectura
```

El escenario usa un volumen Docker exclusivo para el bundle de prueba, el puntero activo y SQLite de publicaciones/cola. El bundle se construye desde el DW con datos Faker y se limita a validar integración. **No es un bundle institucional, no mide calidad predictiva y no debe usarse operativamente.** El runner borra su proyecto Compose y sus volúmenes al terminar; con `-KeepStackOnFailure` los conserva para depuración.

## Requisitos locales

- Docker Compose y Bun instalados.
- Keycloak, Auth Service y `postgres-dw` en ejecución y conectados a la red Docker `dss-system-architecture_dss-net`.
- Migración `0034_prediction_publications.sql` instalada en el DW.
- La variable `PREDICTION_DW_DATABASE_URL` del `.env` raíz apunta al login **read-only** y puede leer las vistas requeridas. No se requiere que API o worker se conecten como administrador.
- La app BFF tiene su `.env` local configurado para `dss-bff`, incluida la credencial confidencial, y el cliente Keycloak permite `http://localhost:3006/api/auth/callback`.
- Dos usuarios de prueba ya provisionados tanto en Keycloak como en Auth Service:
  - cuenta Rector con rol `RECTOR` y contexto para el programa seleccionado;
  - cuenta válida fuera de ámbito (por ejemplo, `DIRECTOR`) sin contexto que autorice ese programa.
- El cierre seleccionado debe estar procesado en el DW y tener población elegible Faker.

No uses cuentas institucionales ni credenciales de producción en esta prueba. La configuración personal se guarda en el archivo ignorado `.env.e2e`.

## Preparación

Desde la raíz del repositorio:

```powershell
Copy-Item dss-monorepo/apps/rector-dashboard-e2e/.env.e2e.example `
  dss-monorepo/apps/rector-dashboard-e2e/.env.e2e
```

Completa en `dss-monorepo/apps/rector-dashboard-e2e/.env.e2e`:

- `PREDICTION_E2E_PROGRAM_REF`: `program_ref` según DW para datos Faker.
- `PREDICTION_E2E_CUT_ID`: `cut_id` procesado.
- `PREDICTION_E2E_RECTOR_USERNAME` y `PREDICTION_E2E_RECTOR_PASSWORD`.
- `PREDICTION_E2E_OUT_OF_SCOPE_USERNAME` y `PREDICTION_E2E_OUT_OF_SCOPE_PASSWORD`.

El archivo `.env.e2e` está excluido de Git. Los secretos de cliente BFF se leen del `.env` local de `apps/bff`; no los copies al ejemplo ni los imprimas en logs.

## Ejecución

```powershell
./prediction-service/tests/integration/run_prediction_bff_ui_e2e.ps1
```

El runner construye imágenes API/worker locales, prepara un bundle Faker para la cadencia del programa, levanta RabbitMQ/API/worker en un proyecto Compose con volumen aislado y ejecuta solo los tests PRED-007 en Chromium con `bun nx`. Al finalizar elimina exclusivamente ese proyecto y sus volúmenes. Usa `-KeepStackOnFailure` para conservarlos si una verificación falla.

## Aserciones

1. Sin sesión, la pantalla pide iniciar sesión y el endpoint BFF de publicaciones responde `401`.
2. La autenticación real pasa por Keycloak y la cookie de sesión del BFF.
3. Rector inicia el lote a través del BFF; worker lee población/features del DW usando el DSN read-only y publica el lote completo en una transacción.
4. La pantalla consulta el lote mediante GraphQL del BFF y verifica estado, filas y versión de modelo coherente.
5. Un usuario autenticado sin el ámbito académico del programa recibe denegación visual y `403` del servicio.

## Si el login termina con `user_profile_lookup` y HTTP 404

Keycloak autenticó al usuario, pero Auth Service no encontró un perfil local cuyo `keycloak_id` coincida con el `sub` del token. El login OIDC por sí solo no crea ese perfil. En las dos cuentas de prueba:

1. Confirma que están en el mismo realm configurado para BFF.
2. Verifica que Auth Service recibió el evento de alta/cambio de usuario desde `uatf-webhook` por RabbitMQ. Para una cuenta ya existente, actualiza y guarda el perfil desde la consola de Keycloak para volver a emitir `USER_UPDATED`; una asignación de rol también emite un evento de sincronización.
3. Confirma que cada cuenta aparece activa en el directorio de Auth Service. Sus contextos académicos se asignan en Auth Service: Rector debe incluir ADM y el usuario de comparación debe quedar fuera de ADM.
4. Repite el login. El BFF debe completar `user_profile_lookup` antes de volver a `/predictions`.

Si no se sincroniza, revisa que `uatf-webhook` esté instalado y habilitado como listener del realm, que los admin events estén habilitados, y que Auth Service consuma `keycloak.user.events`. La prueba ahora termina con un mensaje claro en este caso en lugar de esperar al timeout de Playwright.

Si la cuenta Rector queda en la pantalla pero el mensaje de estado dice `Failed to fetch`, revisa el preflight CORS del BFF. El envío poblacional agrega `Idempotency-Key`, por lo que `Access-Control-Allow-Headers` debe incluir ese encabezado además de `Authorization` y `Content-Type`. El BFF de este repositorio ya lo permite.

Las cuentas recién creadas pueden conservar la acción requerida `Update password`. Completa ese cambio una vez en Keycloak o configura la contraseña como permanente (`Temporary=Off`) antes del E2E. La prueba detecta esa pantalla y falla con una instrucción específica.

## Alcance de evidencia

Un resultado verde demuestra el cableado local y las barreras de sesión/ámbito para una publicación Faker. No sustituye la aprobación DSA, la evaluación institucional reservada, la revisión de seguridad ni una prueba con un bundle institucional aprobado.
