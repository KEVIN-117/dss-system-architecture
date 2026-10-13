# Prediction Service

`prediction-service` se declara como servicio en el Compose raíz, pero su directorio actual no proporciona una plantilla `.env.example` ni un contrato de variables documentado. No se encontró un conjunto estable de variables runtime que se pueda afirmar desde el inventario actual.

Antes de desplegarlo, el equipo responsable debe añadir su contrato junto al servicio y actualizar este archivo: nombre, default, obligatoriedad, formato, secreto/no secreto y valores dev/test/prod. No inventar variables ni colocar credenciales en Compose sin contrato explícito.
