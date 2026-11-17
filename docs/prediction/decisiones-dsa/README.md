# Registro de decisiones DSA para predicción

Este registro guarda las decisiones formales de DSA de las que depende un modelo de predicción institucional. Cada decisión tiene un **identificador de referencia**. Ese identificador se pasa al extractor, al entrenamiento y a la evaluación, y queda copiado en el dataset, el modelo y el reporte. Así cualquier modelo se puede rastrear hasta la decisión que lo autorizó.

El software **no genera ni verifica** estas referencias: solo exige que existan. Por eso:
- Una referencia válida es **únicamente** la de una decisión registrada aquí, con estado `APROBADA` y respaldada por un documento de DSA.
- **Nunca** se crea una referencia antes de que DSA apruebe, ni se registra una decisión que DSA no tomó.
- Mientras no haya decisión aprobada, el entrenamiento solo puede ser exploratorio (referencias `exploratory:`), y su resultado no se puede promover.

## Tipos de decisión

| Tipo | Qué define | Dónde se usa | Opción o campo |
|---|---|---|---|
| `objetivo` | Evento de riesgo, clase positiva y negativa, horizonte e instante de predicción | Extractor y manifiesto del dataset | `--target-definition-ref` / `target_definition_ref` |
| `poblacion` | Estudiantes y cortes incluidos, exclusiones y tratamiento de casos ambiguos | Extractor y manifiesto del dataset | `--population-definition-ref` / `population_definition_ref` |
| `politica` | Regla de alerta: qué fracción o qué umbral genera una alerta, y para qué uso | Configuración de entrenamiento (`decision_policy`) | `policy_ref` |
| `evaluacion` | Decisión PRED-004 sobre un candidato concreto (`APTO` o no) | Promoción del modelo | Reporte de evaluación (ver [PRED-005](../PRED-005-operations.md)) |

## Formato del identificador

```
dsa:<tipo>:<AAAA>-<NNN>:v<versión>
```

- `<tipo>` es uno de los tipos de la tabla anterior.
- `<AAAA>-<NNN>` es el año de la decisión más un número correlativo. Por ejemplo, la primera decisión de 2026 es `2026-001`.
- `v<versión>` sube cuando DSA modifica una decisión ya aprobada. **Una versión aprobada nunca se edita**: se crea la siguiente versión y la anterior pasa a `REEMPLAZADA`.
- No uses el prefijo `exploratory:`, que el sistema reserva para entrenamientos sin aprobación. Tampoco uses `synthetic:` ni `decision:synthetic`, que son de pruebas.

Ejemplo: `dsa:objetivo:2026-001:v1`, la primera decisión registrada.

## Cómo registrar una decisión

1. Copia [PLANTILLA.md](PLANTILLA.md) a un archivo nuevo con el identificador sin los dos puntos. Por ejemplo, `dsa-objetivo-2026-001-v1.md`.
2. Completa todos los campos, incluido el documento DSA que respalda la decisión (acta, resolución o ticket) y quién la aprobó.
3. Agrega una fila a la tabla de decisiones de este archivo.
4. Haz el commit en una rama y abre un PR. La revisión del PR confirma que el respaldo existe antes de usar la referencia.

## Decisiones registradas

| Referencia | Tipo | Resumen | Estado | Respaldo DSA | Fecha |
|---|---|---|---|---|---|
| `dsa:objetivo:2026-001:v1` | objetivo | [Deserción a 4 años, carreras semestrales](dsa-objetivo-2026-001-v1.md) | APROBADA | Comunicada al equipo, sin documento escrito | 2026-11-16 |
| `dsa:poblacion:2026-002:v1` | poblacion | [Carreras semestrales, primeros tres años de trayectoria](dsa-poblacion-2026-002-v1.md) | APROBADA | Comunicada al equipo, sin documento escrito | 2026-11-16 |
| `dsa:politica:2026-003:v1` | politica | [Alerta al 20 % de mayor riesgo](dsa-politica-2026-003-v1.md) | APROBADA | Comunicada al equipo, sin documento escrito | 2026-11-16 |

Estados: `PROPUESTA` (en revisión, todavía no se puede usar), `APROBADA`, `REEMPLAZADA` (por una versión posterior) y `RECHAZADA`.

## Propuestas pendientes de aprobación

Estas propuestas del equipo **no son decisiones DSA** y no tienen referencia `dsa:`:

- **Objetivo:** reprobación de materia en carreras semestrales. Se probó en el entrenamiento exploratorio del 2026-11-16.
- **Política para reprobación de materia:** la cuota del 20 % está por debajo de la tasa de reprobación (alrededor del 32 %), así que este modelo necesita su propia política.
- **Carreras anuales:** necesitan su propio objetivo y su propia población.

Cuando DSA decida sobre cada propuesta, se registra con la plantilla y se le asigna su referencia `dsa:`.

**Pendiente para las decisiones del 2026-11-16:** se aprobaron sin documento escrito. Conviene pedir una constancia (acta, nota o correo) y citarla en cada ficha antes del uso en producción.
