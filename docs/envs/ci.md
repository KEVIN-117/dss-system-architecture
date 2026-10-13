# Variables de CI/CD

Workflows encontrados: `.github/workflows/auth-service-ci.yml` y `dw-hop-ci.yml`. GitHub Actions ofrece `GITHUB_*`, `RUNNER_*`, `CI` y `github.*` como contexto; no son configuración de runtime de la app salvo que el workflow las inyecte.

Los workflows actuales usan Compose/fixtures y ejemplos versionados. Toda contraseña o token de acceso real para un nuevo job debe guardarse en GitHub Actions Secrets/Variables con el alcance mínimo necesario. No imprimir el contexto `env`, comandos con secretos ni salida de `docker compose config`.

En el checkout revisado no hay un set común versionado de `AUTH_*` secrets para CI; por eso no se debe inferir que los valores locales `.env` se publican en GitHub. Cuando un workflow use secretos, documentar aquí el **nombre**, dueño/rotación y workflow consumidor, nunca su valor. Para pruebas E2E usar solo los secretos explícitamente provistos por la infraestructura de test.
