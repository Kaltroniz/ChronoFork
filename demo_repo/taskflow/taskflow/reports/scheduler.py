"""Scheduler for automated reporting jobs."""
from taskflow.reports.generator import generate_summary
from taskflow.reports.exporter import export_report_to_memory

_SCHEDULED_RUNS = []


def schedule_report_generation(cron_pattern: str, days: int = 7) -> str:
    """Schedules periodic reporting."""
    run_id = f"sched_{len(_SCHEDULED_RUNS) + 1}"
    data = generate_summary(days=days)
    export_report_to_memory(run_id, data)
    _SCHEDULED_RUNS.append({"run_id": run_id, "cron": cron_pattern})
    return run_id


def list_scheduled_runs() -> list:
    """Lists scheduled report metadata."""
    return list(_SCHEDULED_RUNS)
