# DW-002 — Calendario de cierres académicos

`etl_control.academic_period_closure` es la única fuente de verdad para decidir si un corte puede entrar al pipeline DW. Los valores operativos de Jachasun, como `public.gestion_periodo`, son referencias y no habilitan cargas.

## Estados y transiciones

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE
    PENDIENTE --> CERRADO: DSA autoriza + fecha efectiva
    CERRADO --> PROCESADO: carga exitosa + run_id
    CERRADO --> REABIERTO: DSA solicita rectificación
    PROCESADO --> REABIERTO: DSA solicita reproceso
    REABIERTO --> CERRADO: DSA vuelve a autorizar
```

Un periodo admite cualquier código positivo: semestres regulares, invierno, verano o nuevos tipos institucionales. No se crean cierres académicos reales mediante la migración.

El diagrama separa la autorización funcional de la ejecución técnica. DSA habilita el cierre y puede reabrirlo; solo una carga exitosa del mismo cierre permite `PROCESADO`. Reabrir conserva la auditoría y obliga a un reproceso autorizado, no a borrar automáticamente la publicación anterior.

## Responsabilidades

| Rol | Responsabilidad |
| --- | --- |
| DSA | Crear cortes pendientes y autorizar su cierre o reapertura, siempre con sujeto identificable y motivo. |
| TI/DBA | Aplicar migraciones, administrar permisos de base de datos y revisar la bitácora. |
| Apache Hop y operador autorizado | Registrar la ejecución técnica y marcar el corte como `PROCESADO` mediante la función, solo tras publicación exitosa con `run_id` del mismo cierre. |

En el MVP de la issue #133, la autorización DSA se conserva mediante operación manual identificada y auditable. La futura API/BFF deberá verificarla antes de invocar `etl_control.transition_academic_period_closure`; no es una dependencia del flujo directo Hop. La función SQL exige actor, motivo y transición válida, pero un actor declarado no demuestra por sí solo autorización funcional.

## Elegibilidad y reapertura

El workflow Hop deberá solicitar una carga por cierre solo cuando el corte esté en `CERRADO`, `effective_at <= now()` y `processed_at IS NULL`; esta regla se aplica también a la ejecución manual, no solo a un scheduler futuro. La reapertura limpia la marca vigente, bloquea nuevas cargas por cierre y conserva los eventos históricos, incluido el `run_id` previamente publicado. El contenido DW publicado no se reemplaza hasta que un reproceso posterior finalice exitosamente. Las cargas históricas tendrán autorización explícita separada.

## Operación manual

Crear un corte pendiente requiere insertar `gestion`, `periodo`, `created_by_subject` y `closure_reason`. Las transiciones se realizan exclusivamente mediante:

```sql
SELECT etl_control.transition_academic_period_closure(
  :gestion, :periodo, :to_status, :actor_subject, :reason,
  :effective_at, :processed_run_id
);
```

`CERRADO` exige fecha efectiva; desde DW-004, `PROCESADO` exige un UUID de ejecución `EXITOSA` vinculada al mismo cierre. La tabla de eventos es inmutable y toda actualización directa de campos de estado es rechazada.

## Despliegue y prueba

Para validar localmente en un PostgreSQL aislado, ejecutar desde la raíz del repositorio:

```bash
docker compose -f infra/dw-schema/dw-test-docker.yml up \
  --abort-on-container-exit --exit-code-from dw-schema-test
docker compose -f infra/dw-schema/dw-test-docker.yml down --volumes
```

El entorno no publica puertos ni persiste datos: PostgreSQL usa almacenamiento temporal y el contenedor `dw-schema-test` aplica primero la migración con `ON_ERROR_STOP` y luego ejecuta la prueba reversible. Un código de salida cero confirma ambas operaciones.

TI/DBA puede aplicar los mismos archivos en un entorno administrado con `psql -v ON_ERROR_STOP=1`; la prueba abre una transacción y finaliza en `ROLLBACK`, por lo que no conserva registros de prueba.

`dw_control_operator` conserva las rutinas de cierres. TI/DBA provisiona cuentas externas y restringe la escritura directa; el calendario funciona sin Load Manager. El runtime Hop usa el grupo dedicado y las funciones autorizadas del MVP: no recibe administración ni autoridad DSA implícita. En producción, TI/DBA debe provisionar la cuenta del ambiente y DSA autorizar cada corte. Véase [la base consolidada](mvp-direct-hop.md).
