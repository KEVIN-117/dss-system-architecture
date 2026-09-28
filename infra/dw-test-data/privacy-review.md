# Revisión de privacidad — DW-008

Estado: aprobado para pruebas locales con datos sintéticos.

## Comprobaciones

- [x] No se incluyen nombres, documentos, teléfonos, correos, direcciones ni fechas de nacimiento.
- [x] Los identificadores usan prefijos `TEST` y no representan registros reales.
- [x] Las contraseñas aparecen solo en el compose aislado y no son credenciales de ningún ambiente.
- [x] La fuente de prueba tiene un usuario `dw_fixture_reader` sin privilegios de escritura ni DDL.
- [x] El destino usa `tmpfs` y no crea volúmenes persistentes.
- [x] El runner no imprime filas completas ni almacena datos personales en manifiestos.
- [x] Los hashes del dataset están registrados en `manifest.yml`.

## Condición para datos anonimizados futuros

No se autoriza sustituir estos fixtures por una extracción real dentro del repositorio. Cualquier dataset anonimizado deberá generarse fuera del control de versiones, eliminar columnas fuera de la allowlist DW-001, aplicar pseudonimización irreversible y contar con una revisión DSA/TI antes de copiarlo al entorno de pruebas.
