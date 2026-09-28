# DW-008 — Fixture de integración

Este directorio contiene únicamente datos sintéticos para el entorno aislado de integración DW-008.

- `source/*.sql`: una fuente sintética por contrato DW-001 (`uatf_datos`, `alumnos`, `postulantes`, programas, materias, notas y auxiliares).
- `expected/scd2-cases.yml`: casos de identidad, cambios y correcciones tardías.
- `expected/closure-cases.yml`: casos de cierres académicos.
- `expected/quality-cases.yml`: casos de duplicados, nulos y calidad.
- `manifest.yml`: versión, conteos, `run_id` y SHA-256 de los archivos.

No cargar estos archivos en Jachasun ni en el `postgres-dw` persistente. Para ejecutarlos se debe usar exclusivamente:

```powershell
docker compose -f infra/dw-integration/dw-integration-test.yml up --abort-on-container-exit
docker compose -f infra/dw-integration/dw-integration-test.yml down --volumes
```

El entorno usa `tmpfs`, credenciales locales de prueba y redes efímeras. Los identificadores `RA-T*`, `ALUMNO-TEST-*` y `MAT-TEST-*` no representan personas reales.
