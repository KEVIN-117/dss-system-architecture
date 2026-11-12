# Informe de estado de issues — Proyecto DSS

**Fecha de corte:** 11 de noviembre de 2026  
**Alcance:** GitHub Project #11, `dss-system-architecture-kanban`  
**Fuentes:** vista del tablero e Insights del proyecto; búsqueda de issues de GitHub para contraste del alcance.

## Resumen ejecutivo

El proyecto contiene 129 elementos: 97 issues y 32 pull requests. Dentro del proyecto, 81 issues están cerradas y 16 siguen abiertas. De las abiertas, 15 están en Backlog y una en In progress; Ready está vacío. Trece issues abiertas (81,3 %) no tienen responsable asignado. Diez de las 16 abiertas (62,5 %) tienen el milestone OLAP.

**Lectura de gestión: requiere atención de priorización y asignación.** Esta es una lectura de los datos actuales del tablero, no un estado institucional aprobado ni una evaluación de fechas comprometidas.

## Estado del tablero e issues

| Indicador | Resultado | Interpretación |
|---|---:|---|
| Elementos del proyecto | 129 | Incluye issues y pull requests |
| Issues del proyecto | 97 | Alcance de los gráficos de issues |
| Pull requests del proyecto | 32 | Se incluyen en el total de elementos, no en el conteo de issues |
| Issues abiertas | 16 (16,5 %) | 15 en Backlog y 1 en In progress |
| Issues cerradas | 81 (83,5 %) | 64 completadas y 17 duplicadas según Burn up |
| Backlog | 15 | Todas las issues en esta columna están sin iniciar según el estado del tablero |
| Ready | 0 | No hay issues preparadas en la columna Ready |
| In progress | 1 | Una issue aparece en trabajo activo |
| Done | 113 | 81 issues cerradas más 32 PRs; no debe leerse como 113 issues cerradas |

Los porcentajes de issues abiertas y cerradas se calculan sobre las 97 issues del proyecto. El gráfico Burn up del proyecto clasifica las cerradas como completadas o duplicadas; por eso se conserva esa distinción.

## Perfil de las issues abiertas

### Asignación

| Asignación | Issues | Porcentaje |
|---|---:|---:|
| Sin responsable | 13 | 81,3 % |
| KEVIN-117 | 3 | 18,8 % |
| **Total** | **16** | **100 %** |

### Milestone

| Milestone | Issues abiertas |
|---|---:|
| OLAP | 10 |
| 🚀 NX Epic 5: Ensamblaje de Portales y Dashboards | 3 |
| Épica 5: Despliegue | 1 |
| Sin milestone | 2 |
| **Total** | **16** |

La concentración en OLAP y la cantidad de issues sin responsable son señales para revisión y seguimiento. Los datos por sí solos no demuestran que una issue esté bloqueada.

## Gráficos de Insights

Se añadieron tres gráficos personalizados al proyecto:

1. [Issues por estado del tablero](https://github.com/users/KEVIN-117/projects/11/insights/3): issues solamente, con Backlog 15, In progress 1 y Done 81.
2. [Issues abiertas por milestone](https://github.com/users/KEVIN-117/projects/11/insights/4): distribución de las 16 abiertas por milestone, incluida la categoría sin milestone.
3. [Issues abiertas por responsable](https://github.com/users/KEVIN-117/projects/11/insights/5): 13 sin responsable y 3 asignadas a KEVIN-117.

El gráfico predeterminado de Burn up ya ofrece la serie temporal de issues y distingue abiertas, completadas y duplicadas. El gráfico existente `Chart 2` agrupa por etiquetas; como una issue puede tener varias etiquetas, sus barras se superponen y no deben sumarse como categorías excluyentes.

## Observaciones de alcance y calidad del dato

- El tablero cuenta 129 elementos: 97 issues y 32 PRs. El “Done 113” mostrado por el gráfico de estado original mezcla ambos tipos.
- La búsqueda del repositorio reporta 106 issues en total: 16 abiertas y 90 cerradas. El proyecto contiene 97, por lo que 9 issues del repositorio están fuera del Project #11 y no forman parte de este informe.
- No se calculan lead time, cycle time ni throughput: estos indicadores requieren fechas y estados históricos consistentes para el alcance que se desea medir.
- La ausencia de responsable, milestone o registro no se interpreta como bloqueo ni como incumplimiento de una fecha.

## Acciones recomendadas

1. Revisar las 13 issues abiertas sin responsable y asignar owner o dejar registrada la decisión de mantenerlas sin asignación.
2. Elegir las siguientes issues prioritarias del Backlog y moverlas a Ready cuando cumplan los criterios de preparación del equipo.
3. Revisar las 10 issues del milestone OLAP para confirmar prioridades, dependencias y criterios de cierre; el conteo por sí solo no identifica bloqueos.
4. Aclarar el tratamiento de las 2 issues sin milestone y mantener actualizado el milestone cuando corresponda.
5. Revisar periódicamente los gráficos y reportar una nueva fecha de corte al comparar cambios; no comparar snapshots sin registrar su fecha y alcance.

## Método y limitaciones

El informe refleja una captura del proyecto al 11/11/2026. Los conteos de estado y milestone se tomaron de GitHub Projects Insights con filtros de issue aplicados cuando corresponde; la API de búsqueda del repositorio se usó para contrastar el total de issues. Las cifras pueden cambiar cuando se editen issues, estados, milestones o la pertenencia al proyecto.
