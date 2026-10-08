# Conexiones al DW y concurrencia (OLAP-002)

## Configuración externa

El launcher configura `external.properties.file` como `${saiku.home}/conf/datasources.properties`. `RepositoryDatasourceManager` resuelve las propiedades `datasource.<propertykey>.driver`, `.location`, `.username` y `.password` al leer el descriptor `.sds`. El descriptor debe tener un `<propertyKey>` y no guardar usuario ni contraseña. El archivo de propiedades debe ser materializado por el despliegue desde su gestor de secretos; no se debe versionar.

Ejemplo de descriptor sin secretos en `<saiku-home>/repository/data/unknown/datasources/uatf-dw.sds`:

El nombre `uatf-dw.xml` representa un catálogo Mondrian que debe existir en `<saiku-home>/datasources/`; el repositorio aún no trae un catálogo UATF de integración listo para consultas.

```xml
<dataSource>
  <driver>mondrian.olap4j.MondrianOlap4jDriver</driver>
  <location>jdbc:mondrian:Jdbc=jdbc:postgresql://postgres-dw:5432/dw_integration;Catalog=mondrian://datasources/uatf-dw.xml;JdbcDrivers=org.postgresql.Driver;</location>
  <name>uatf-dw</name>
  <propertyKey>uatf_dw</propertyKey>
  <type>OLAP</type>
</dataSource>
```

El archivo externo correspondiente lleva las mismas propiedades, con credenciales inyectadas por el entorno:

```properties
datasource.uatf_dw.driver=mondrian.olap4j.MondrianOlap4jDriver
datasource.uatf_dw.location=jdbc:mondrian:Jdbc=jdbc:postgresql://postgres-dw:5432/dw_integration?connectTimeout=5&socketTimeout=60;Catalog=mondrian://datasources/uatf-dw.xml;JdbcDrivers=org.postgresql.Driver;
datasource.uatf_dw.username=<valor inyectado desde secretos>
datasource.uatf_dw.password=<valor inyectado desde secretos>
```

`connectTimeout=5` limita el establecimiento de conexión a cinco segundos y `socketTimeout=60` limita la espera de lectura del driver a 60 segundos. Ajustar el timeout de lectura al SLA real de las consultas; no es un sustituto de cancelación de consultas en PostgreSQL. Si el DW requiere TLS, configurar `sslmode=verify-full` y certificados según el despliegue.

## Ciclo de vida observado

1. Spring crea `RepositoryDatasourceManager`, que lee el descriptor `.sds` y aplica las propiedades externas.
2. `SecurityAwareConnectionManager` obtiene o crea una conexión por datasource. Si la seguridad Mondrian está activada, el caché se separa por identidad para que los roles no se crucen.
3. `SaikuOlapConnection` valida el URL y abre el `OlapConnection` vía Mondrian/olap4j. Esa conexión queda cacheada hasta refresh, cierre o destrucción del servicio.
4. `destroy()` cierra las conexiones cacheadas. Un refresh elimina/recrea la entrada correspondiente.

No se encontró una instancia de pool JDBC usada por este camino: `commons-dbcp2` está declarado como dependencia, pero el conector OLAP crea la conexión desde la URL validada mediante el driver. Por eso no se documentan métricas DBCP ni se agrega otro pool en esta fase. Los cambios de conexión deben medirse antes de escoger un pool, porque Mondrian recibe una conexión OLAP de larga vida y añadir un pool superficialmente podría duplicar o alterar su ciclo de vida.

## Límite técnico inicial

Se propone un presupuesto de **20 sesiones PostgreSQL por servicio OLAP** como punto de partida para el entorno UATF. La configuración local del PostgreSQL tiene `max_connections=100`; reservar 80 sesiones para ETL, migraciones, administración y otros clientes evita que OLAP consuma todo el límite compartido. El entorno descartable de `infra/dw-integration` crea un rol `olap_test` con `CONNECTION LIMIT 20` y verifica que una sesión adicional se rechaza.

Este es un límite de sesiones del servidor, no una promesa de 20 consultas simultáneas ni un pico de usuarios validado. Antes de producción hay que confirmar `max_connections` del DW real y asignar un presupuesto conjunto con ETL/BFF/operación. El número final debe ser `min(20, presupuesto aprobado para OLAP)` y el rol de servicio no debe ser compartido con ETL.

## Validación y métricas

Arrancar el conjunto descartable con el flujo habitual de `infra/dw-integration`. El job de integración ahora abre 20 conexiones concurrentes como `olap_test` y confirma que la conexión 21 falla por el límite del rol. No ejecuta carga de MDX: el repositorio todavía no aporta un datasource/cubo UATF reproducible conectado a ese fixture, así que no se deben presentar estas mediciones de admisión PostgreSQL como benchmark de consultas OLAP.

Para el benchmark OLAP representativo, cuando exista el datasource/cubo de prueba:

1. Ejecutar el mismo conjunto de consultas MDX con concurrencia 1, 5, 10, 20 y 25; usar cargas y roles equivalentes a los consumidores previstos.
2. Registrar p50/p95/p99 de latencia, errores, tiempo de consulta, throughput y heap/CPU del servicio.
3. Muestrear `pg_stat_activity` durante la prueba: sesiones por `usename`, estados `active`/`idle`, `wait_event_type`, máximo de conexiones concurrentes y conexiones rechazadas. Registrar además CPU, memoria, I/O y latencia del PostgreSQL.
4. Comparar con el mismo SQL ejecutado directamente contra el fixture y comprobar que el rol OLAP nunca excede 20 sesiones y que ETL/administración mantienen su reserva.

Consultas PostgreSQL para observar sesiones:

```sql
SELECT state, wait_event_type, count(*)
FROM pg_stat_activity
WHERE usename = 'olap_service'
GROUP BY state, wait_event_type
ORDER BY state, wait_event_type;

SELECT usename, count(*)
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY usename
ORDER BY count(*) DESC;
```

La integración confirma el guardarraíl del rol de PostgreSQL. Para cerrar el criterio de carga de OLAP aún hace falta correr el benchmark con un catálogo UATF y acordar su dataset/consulta representativa.
