"""Single source of truth for prediction tasks (targets).

Every component that used to hardcode event codes (model registry, trainer,
inference, API validation, admin portal forms) reads this catalog instead.
Adding a target means registering a ``TaskSpec`` here plus its point-in-time
SQL in ``feature_contract``.

The definitions here replace the external DSA approval references: a dataset
extracted for a catalog task carries ``catalog:`` references to the target and
population definitions declared below, and the operator that trains and
activates it is audited instead.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

TaskKind = Literal["classification", "regression", "forecast"]
TaskGrain = Literal["student_program_cut", "enrollment_cut", "series_program_period"]
TaskSubject = Literal["student", "enrollment", "series"]

CADENCES: tuple[str, ...] = ("ANUAL", "SEMESTRAL")


class UnknownTask(KeyError):
    """The requested task code or event type is not registered."""


@dataclass(frozen=True)
class TaskSpec:
    code: str
    kind: TaskKind
    subject: TaskSubject
    grain: TaskGrain
    title: str
    description: str
    target_field: str
    target_label: str
    population_label: str
    algorithms: tuple[str, ...]
    primary_metric: str
    cadences: tuple[str, ...] = CADENCES
    # Classification only.
    positive_class: str | None = None
    negative_class: str | None = None
    # Public API event type when the task can be served on demand; None when
    # the task can be trained but has no serving path yet.
    serving_event_type: str | None = None
    requires_course_ref: bool = False
    extractable: bool = True
    definition_version: str = "v1"
    sources: tuple[str, ...] = field(default_factory=tuple)
    # Regression only: unit of the predicted value, shown next to it.
    target_unit: str | None = None
    # Features a task cannot drop: its label is derived from them.
    required_features: tuple[str, ...] = ()

    @property
    def servable(self) -> bool:
        return self.serving_event_type is not None

    @property
    def target_definition_ref(self) -> str:
        return f"catalog:{self.code}:target:{self.definition_version}"

    @property
    def population_definition_ref(self) -> str:
        return f"catalog:{self.code}:population:{self.definition_version}"

    def to_public(self) -> dict[str, Any]:
        data = asdict(self)
        data["servable"] = self.servable
        data["target_definition_ref"] = self.target_definition_ref
        data["population_definition_ref"] = self.population_definition_ref
        for key in ("algorithms", "cadences", "sources", "required_features"):
            data[key] = list(data[key])
        return data


_CLASSIFIERS = ("random_forest", "xgboost")
_REGRESSORS = ("ridge", "random_forest", "xgboost")

_TASKS: tuple[TaskSpec, ...] = (
    TaskSpec(
        code="PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE",
        kind="classification",
        subject="student",
        grain="student_program_cut",
        title="Deserción del programa",
        description="Riesgo de que el estudiante no continúe en el programa en el siguiente corte esperado.",
        target_field="target_class",
        target_label="RISK si el estudiante es DESERTOR en el siguiente corte (o no regresa en el horizonte).",
        population_label="Estudiantes en sus tres primeros años académicos del programa con corte procesado.",
        algorithms=_CLASSIFIERS,
        primary_metric="recall",
        positive_class="RISK",
        negative_class="NO_RISK",
        serving_event_type="program_dropout",
        sources=("dw.fact_retencion_desercion", "dw.dim_periodo_academico", "etl_control.academic_period_closure"),
    ),
    TaskSpec(
        code="COURSE_ABANDONMENT",
        kind="classification",
        subject="enrollment",
        grain="enrollment_cut",
        title="Abandono de materia",
        description="Riesgo de que el estudiante abandone una materia inscrita.",
        target_field="target_class",
        target_label="RISK si la inscripción termina en abandono.",
        population_label="Inscripciones a materia de programas con corte procesado.",
        algorithms=_CLASSIFIERS,
        primary_metric="recall",
        positive_class="RISK",
        negative_class="NO_RISK",
        serving_event_type="course_abandonment",
        requires_course_ref=True,
        extractable=False,
        sources=("dw.fact_cursado", "dw.dim_materia"),
    ),
    TaskSpec(
        code="COURSE_FAILURE",
        kind="classification",
        subject="enrollment",
        grain="enrollment_cut",
        title="Riesgo en materia",
        description="Riesgo de reprobar o abandonar una materia inscrita (programas semestrales).",
        target_field="target_class",
        target_label="RISK si la inscripción termina reprobada o abandonada; NO_RISK si se aprueba.",
        population_label="Inscripciones a materia de programas semestrales con corte procesado.",
        algorithms=_CLASSIFIERS,
        primary_metric="recall",
        cadences=("SEMESTRAL",),
        positive_class="RISK",
        negative_class="NO_RISK",
        serving_event_type="course_failure",
        requires_course_ref=True,
        sources=("dw.fact_cursado", "dw.dim_materia"),
    ),
    TaskSpec(
        code="STUDENT_BACKLOG_NEXT_CUT",
        kind="classification",
        subject="student",
        grain="student_program_cut",
        title="Rezago del estudiante",
        description="Riesgo de que el estudiante acumule más materias arrastradas en el siguiente corte.",
        target_field="target_class",
        target_label="RISK si materias_arrastradas sube en el siguiente corte de la cadencia; NO_RISK si no sube.",
        population_label="Estudiantes en sus tres primeros años del programa presentes en el corte y en el siguiente.",
        algorithms=_CLASSIFIERS,
        primary_metric="recall",
        positive_class="RISK",
        negative_class="NO_RISK",
        serving_event_type="student_backlog",
        required_features=("materias_arrastradas",),
        sources=("dw.fact_retencion_desercion", "etl_control.academic_period_closure"),
    ),
    TaskSpec(
        code="STUDENT_GPA_NEXT_CUT",
        kind="regression",
        subject="student",
        grain="student_program_cut",
        title="PPA del siguiente corte",
        description="Estimación del promedio ponderado acumulado (PPA) del estudiante en el siguiente corte.",
        target_field="target_value",
        target_label="ppa_acumulado del estudiante en el siguiente corte de la cadencia.",
        population_label="Estudiantes en sus tres primeros años del programa con PPA en el corte siguiente.",
        algorithms=_REGRESSORS,
        primary_metric="rmse",
        serving_event_type="student_gpa",
        target_unit="puntos de PPA",
        required_features=("ppa_acumulado",),
        sources=("dw.fact_retencion_desercion", "etl_control.academic_period_closure"),
    ),
    TaskSpec(
        code="COURSE_FINAL_GRADE",
        kind="regression",
        subject="enrollment",
        grain="enrollment_cut",
        title="Nota final en materia",
        description="Estimación de la nota final que obtendrá el estudiante en una materia inscrita (programas semestrales).",
        target_field="target_value",
        target_label="nota_final de la inscripción (dw.fact_cursado).",
        population_label="Inscripciones con nota final registrada de programas semestrales con corte procesado.",
        algorithms=_REGRESSORS,
        primary_metric="rmse",
        cadences=("SEMESTRAL",),
        serving_event_type="course_final_grade",
        requires_course_ref=True,
        target_unit="puntos de nota",
        sources=("dw.fact_cursado", "dw.dim_materia"),
    ),
)

_BY_CODE: dict[str, TaskSpec] = {task.code: task for task in _TASKS}
_BY_EVENT_TYPE: dict[str, TaskSpec] = {task.serving_event_type: task for task in _TASKS if task.serving_event_type}


def list_tasks() -> list[TaskSpec]:
    return list(_TASKS)


def get_task(code: str) -> TaskSpec:
    try:
        return _BY_CODE[code]
    except KeyError as exc:
        raise UnknownTask(code) from exc


def task_for_event_type(event_type: str) -> TaskSpec:
    try:
        return _BY_EVENT_TYPE[event_type]
    except KeyError as exc:
        raise UnknownTask(event_type) from exc


def servable_event_codes() -> frozenset[str]:
    return frozenset(task.code for task in _TASKS if task.servable)


def event_type_pattern() -> str:
    """Regex for API validation of public serving event types."""
    return "^(" + "|".join(sorted(_BY_EVENT_TYPE)) + ")$"


def event_code_pattern() -> str:
    return "^(" + "|".join(sorted(task.code for task in _TASKS if task.servable)) + ")$"
