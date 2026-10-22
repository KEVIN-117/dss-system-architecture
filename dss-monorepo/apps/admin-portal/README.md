# Admin Portal

El portal usa `NEXT_PUBLIC_BFF_URL` para leer la sesión y acceder a capacidades administrativas. No consume Auth Service directamente ni envía tokens desde el navegador.

## Identidades DSS

La pantalla **Users** consulta el directorio paginado de Auth Service mediante el BFF, muestra identidad, roles y contextos académicos, y permite reemplazar el contexto de usuarios con rol `DIRECTOR` o `DECANO`. El panel obtiene facultades y carreras desde el catálogo académico del Auth Service para que la asignación use nombres verificables en vez de IDs adivinados. No administra cuentas internas de Saiku ni permite gestionar contraseñas.

Estas rutas administrativas requieren `SUPERADMIN`; el portal protege la sección y el BFF valida el rol de nuevo antes de consultar Auth Service o asignar contextos. El reemplazo de contextos actualiza el usuario visible en la tabla y presenta errores de autenticación, autorización, ausencia y servicio.

## Administración OLAP

La pantalla **Schemas** gestiona los esquemas OLAP a través del proxy autenticado del BFF (`/api/olap/rest/saiku/admin/*`). El BFF vuelve a validar `SUPERADMIN` en esas rutas y reenvía al servicio OLAP el token verificado de la sesión.

## Configuración y validación

Configura `NEXT_PUBLIC_BFF_URL` con la URL pública del BFF. Desde la raíz del monorepo:

```sh
bun nx test @dss-monorepo/admin-portal
bun nx lint @dss-monorepo/admin-portal
bun nx build @dss-monorepo/admin-portal
```
