# ETL Load Manager

Load Manager es un componente aparte de Apache Hop; el README indica que está pausado para el MVP vigente. Fuente: `etl-layer/loadmanager/.env.example`.

| Variable | Uso |
|---|---|
| `DB_TX_HOST`, `DB_TX_PORT`, `DB_TX_NAME`, `DB_TX_USER`, `DB_TX_PASS`, `DB_TX_SSLMODE` | Acceso a OLTP fixture. El usuario debe ser solo lectura. |
| `DB_DW_HOST`, `DB_DW_PORT`, `DB_DW_NAME`, `DB_DW_USER`, `DB_DW_PASS`, `DB_DW_SSLMODE` | Acceso a DW de integración; usar usuario limitado a las operaciones de staging del extractor. |

La plantilla usa credenciales de fixtures locales y no se debe usar fuera de pruebas. Los secretos en `.env` local quedan ignorados; prod necesitaría un contrato y despliegue operativo separado antes de habilitar este componente.
