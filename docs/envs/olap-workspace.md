# OLAP Workspace

La plantilla `dss-monorepo/apps/olap-workspace/.env.example` expone `NEXT_PUBLIC_BFF_URL`, el origin público que el navegador utiliza para operaciones mediadas por BFF. El conector OLAP documenta que autenticación y llamadas protegidas permanecen del lado servidor; no apuntar desde el navegador directamente a Saiku con credenciales.

Dev suele usar `http://localhost:3006`; test, el BFF del harness; producción, la URL HTTPS pública del BFF. `NEXT_PUBLIC_*` no es secreto y queda embebido en el bundle. No hay variables adicionales declaradas en la plantilla actual.
