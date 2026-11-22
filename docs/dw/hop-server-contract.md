# Contrato HTTP de Hop Server (Load Manager)

Estado: implementado en LM-001 (#349). dw-control-service lo consume desde LM-003 (#351) mediante `HopServerClient` (`dw-control-service/src/main/java/chronos/dw/admin/adapter/out/hop`).

## Rol

Hop Server (`apache/hop:2.19.0` en modo servidor, imagen `dss-apache-hop-server`) es el motor de ejecución del Load Manager. Ejecuta el proyecto `dss-uatf-etl` empaquetado en la imagen con las mismas conexiones (`DSS DW`, `OLTP db`, `Auth Service DB`) y el mismo archivo de ambiente que Hop Web.

- **Único cliente:** dw-control-service, por la red interna (`dss-net` / `dokploy-network`). El puerto 8080 no se publica en el host.
- **Hop Web** sigue siendo el editor. Edita los workflows y los guarda en el proyecto. El portal solo abre Hop Web cuando hay que editar.
- **Autenticación:** HTTP Basic (`HOP_SERVER_USER` / `HOP_SERVER_PASS`), siempre activa. El contenedor no arranca con las credenciales por defecto `cluster/cluster` ni con una contraseña de menos de 16 caracteres.

## Endpoints usados

Todas las rutas requieren Basic Auth. Una petición anónima recibe `401`.

| Uso | Método y ruta | Respuesta |
|---|---|---|
| Salud y lista de ejecuciones | `GET /hop/status/?json=Y` | `statusDescription` (`Online`) y `workflowStatusList` |
| Registrar una ejecución | `POST /hop/registerWorkflow/?xml=Y`, cuerpo `text/xml` `<workflow_configuration>` | `<webresult>` con `<id>` (UUID de la ejecución) |
| Iniciar | `GET /hop/startWorkflow/?name=<workflow>&id=<id>&xml=Y` | `<result>OK</result>`; vuelve al instante (~150 ms) |
| Estado y log | `GET /hop/workflowStatus/?name=<workflow>&id=<id>&json=Y` | `statusDescription`, `errorDescription`, `actionStatusList[].result` y `loggingString` (gzip + base64) |
| Detener | `GET /hop/stopWorkflow/?name=<workflow>&id=<id>&xml=Y` | `<result>OK</result>`; la ejecución pasa a `Stopped` en segundos (verificado en LM-003) |
| Liberar memoria | `GET /hop/removeWorkflow/?name=<workflow>&id=<id>&xml=Y` | Opcional; si no se llama, el servidor purga las ejecuciones a las 24 h (`HOP_SERVER_MAX_OBJECT_TIMEOUT=1440`) |

Si se consulta un id que Hop ya no conoce (porque lo purgó o porque el servidor se reinició), Hop responde **HTTP 200 con una página HTML** que dice *could not be found*, no un 404. El cliente lo reconoce y lo trata como `NOT_FOUND`.

`/hop/execWorkflow` existe, pero **no se usa**: no devuelve el id de la ejecución y es síncrono. Una carga larga mantendría abierta la petición HTTP.

## Lanzador: cómo se ejecuta un workflow del proyecto

dw-control-service no tiene los archivos `.hwf`. Para cada ejecución registra un **workflow lanzador** mínimo con una sola acción `WORKFLOW` cuyo `filename` es `${P_TARGET_WORKFLOW}`. La acción tiene `wait_until_finished=Y` y `pass_all_parameters=Y`.

- El servidor resuelve esa ruta dentro de su propio proyecto (`/files/project/workflows/<archivo>.hwf`).
- Los parámetros del proceso viajan en `workflow_execution_configuration/parameters`. El lanzador declara cada parámetro que va a pasar al workflow hijo. En LM-003 se verificó que `P_RUN_ID` llega al workflow hijo: si llegara vacío, PostgreSQL rechazaría el `::uuid`, y en cambio la función de publicación recibió el valor enviado.
- `metastore_json` va vacío: `{}` comprimido con gzip y codificado en base64. Las conexiones salen de la metadata del proyecto del servidor. Si se omite este bloque, `registerWorkflow` falla con *metadata plugin for key null*.

Esquema del cuerpo (referencia ejecutable: `infra/dw-integration/tests/test_hop_server_catalog.sh`):

```xml
<workflow_configuration>
  <workflow>
    <name>dss_lm_launcher</name>
    <parameters><parameter><name>P_TARGET_WORKFLOW</name>…</parameter> …</parameters>
    <actions>Start (SPECIAL) → Run target workflow (WORKFLOW, filename ${P_TARGET_WORKFLOW})</actions>
    <hops>…</hops>
  </workflow>
  <workflow_execution_configuration>
    <log_level>Basic</log_level>
    <run_configuration>local</run_configuration>
    <parameters>
      <parameter><name>P_TARGET_WORKFLOW</name><value>/files/project/workflows/wf_sync_academic_catalog.hwf</value></parameter>
    </parameters>
  </workflow_execution_configuration>
  <metastore_json>H4sI…</metastore_json>
</workflow_configuration>
```

## Estados de Hop

| `statusDescription` | Significado para el Load Manager |
|---|---|
| `Waiting`, `Initializing`, `Running` | En curso |
| `Finished` sin `nrErrors > 0` ni `result: false` en `actionStatusList` | Exitosa |
| `Finished (with errors)` | Fallida (también si el `.hwf` no existe) |
| `Stopped`, `Halted` | Detenida o abortada |

El resultado de negocio de una carga vertical sigue siendo `etl_control.etl_execution`, que escribe el propio workflow. El estado de Hop solo describe el proceso técnico.

## Catálogo ejecutable

`scripts/validate_project.py` (`EXECUTABLE_WORKFLOWS`) fija qué workflows puede lanzar el Load Manager y con qué parámetros. Renombrar un archivo o un parámetro rompe este contrato.

| Workflow | Parámetros |
|---|---|
| `wf_vertical_uatf_datos_smoke.hwf` | `P_RUN_ID`, `P_REQUESTED_GESTION`, `P_REQUESTED_PERIODO`, `P_EXECUTION_KIND`, `P_RETRY_OF_RUN_ID` |
| `wf_sync_academic_catalog.hwf` | — |
| `wf_hop_publish_staged_run.hwf` | `P_RUN_ID` |

El nombre interno de cada workflow debe coincidir con el nombre de su archivo.

## Verificación

- **Local:** `bash infra/dw-integration/run-local-hop-server.sh`. También lo ejecuta el hook pre-push cuando cambian Hop o el DW.
- **CI:** paso *Run Hop Server contract regression* de `dw-hop-ci.yml`.

La regresión comprueba el `401` anónimo, ejecuta el catálogo a través del lanzador con su log y verifica que un workflow inexistente termine como fallido. Después valida el catálogo sincronizado con `assert_hop_academic_catalog.sql`.
