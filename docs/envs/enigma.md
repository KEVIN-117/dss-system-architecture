# Enigma (UI OLAP)

Fuente: `olap-service/enigma/.env.example` y `src/lib/server/config.ts`. La aplicación SvelteKit accede a estos servicios desde el servidor.

| Variable | Requerida | Uso / default |
|---|---|---|
| `BENAFIDE_API` | Opcional | API de lineage/Benafide; default de código `http://lineage-prod:8000`. Configurar URL accesible desde el proceso Enigma. |
| `SAIKU_API` | Opcional | API Saiku; default `http://localhost:8080`. En contenedor, cambiar `localhost` por hostname de servicio. |
| `SAIKU_USER` | Según endpoint | Usuario de Saiku para llamadas servidor-servidor; secreto operacional/credencial. |
| `SAIKU_PASS` | Según endpoint | Contraseña correspondiente; nunca exponer al navegador ni versionar con valor real. |

La plantilla trae defaults orientativos, no una configuración de producción. Dev usa servicios locales accesibles; test debe usar stubs/servicios efímeros; producción debe usar DNS privado/TLS y credenciales guardadas en el gestor de secretos. No asumir que variables de `.env.example` se inyectan por Docker Compose raíz.
