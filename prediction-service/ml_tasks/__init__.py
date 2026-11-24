"""Catalog of the prediction tasks the service can extract, train and serve."""

from ml_tasks.catalog import (
    CADENCES,
    TaskSpec,
    UnknownTask,
    get_task,
    list_tasks,
    servable_event_codes,
    task_for_event_type,
)

__all__ = [
    "CADENCES",
    "TaskSpec",
    "UnknownTask",
    "get_task",
    "list_tasks",
    "servable_event_codes",
    "task_for_event_type",
]
