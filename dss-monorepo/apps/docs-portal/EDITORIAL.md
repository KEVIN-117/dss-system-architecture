# Mantenimiento editorial del portal DSS

## Responsables por área

Los responsables se asignan por función para que el portal no dependa de nombres personales. El equipo del repositorio debe asociar una persona revisora antes de aprobar cambios que afecten un área.

| Área | Responsable funcional | Evidencia que debe revisar |
| --- | --- | --- |
| Resumen ejecutivo, arquitectura y estado | Responsable de producto/arquitectura DSS | Capacidades, límites, estado y responsables institucionales. |
| APIs y contratos | Mantenedor del servicio que publica el contrato | Rutas, permisos, esquemas, errores y ejemplos de su YAML. |
| Identidad, acceso y administración | Responsable de IAM/seguridad y mantenedor de Auth/BFF | Roles, límites de acceso y clasificación antes de publicar. |
| Data Warehouse y ETL | Mantenedor de DW Control y del flujo de datos | Cierres, ejecución y afirmaciones sobre carga o calidad. |
| OLAP y analítica | Mantenedor de Saiku/OLAP | Consultas, catálogo, permisos y rutas efectivamente soportadas. |
| Predicción | Mantenedor del servicio ML y responsable de gobierno del modelo | Contrato, población autorizada, decisiones de uso y límites. |
| Portal y consistencia editorial | Mantenedores de `docs-portal` | Rutas, navegación, accesibilidad, enlaces y compilación MDX. |

## Revisión junto al producto

1. Un cambio que afecte contrato, flujo, permiso, pantalla o comportamiento debe actualizar la guía correspondiente en el mismo pull request, o explicar por qué no necesita cambios documentales.
2. El mantenedor del área confirma el contenido contra código, contrato o runbook fuente. Quien mantiene el portal revisa legibilidad, enlaces, MDX, accesibilidad y clasificación.
3. Los ejemplos API se copian del contrato o se añaden primero al YAML tras validarlos con la implementación. No se redactan respuestas ilustrativas como si fueran reales.
4. Antes de aprobar contenido restringido, revisar renderizado y control de acceso, incluyendo el comportamiento ante sesión vencida o BFF no disponible.
5. Revisar enlaces internos y contratos al cambiar nombres, rutas o estructura del repositorio. Anotar en la descripción del pull request qué páginas se revisaron y su fecha de verificación.

## Reporte de contenido desactualizado

Usa la plantilla de issue **Documentación: contenido desactualizado o incorrecto** en GitHub. Incluye URL, sección, qué observaste y una fuente que permita verificar el cambio. No incluyas datos personales, tokens, cookies, contraseñas ni configuración privada.

## Clasificación y publicación

- `public`: información institucional aprobada para publicación abierta.
- `public-summary`: explicación general sin procedimientos operativos, datos personales, direcciones privadas ni detalles de seguridad explotables.
- `restricted`: procedimientos que requieren rol declarado en el metadata y el registro. La ruta server side consulta al BFF y responde con una pantalla de acceso si no verifica el rol.

La clasificación no reemplaza una política institucional de seguridad. Si no está claro si el contenido puede publicarse, no lo agregues hasta que el responsable de seguridad y el dueño del área resuelvan la clasificación.
