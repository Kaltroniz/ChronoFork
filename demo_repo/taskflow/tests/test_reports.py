"""Tests for taskflow.reports subsystem."""
from taskflow.reports.generator import generate_summary, calculate_metrics_summary
from taskflow.reports.formatter import format_as_markdown
from taskflow.reports.scheduler import schedule_report_generation, list_scheduled_runs


def test_calculate_metrics_summary():
    res = calculate_metrics_summary(job_count=100, error_count=5)
    assert res["total_jobs"] == 100
    assert res["failed_jobs"] == 5
    assert res["success_rate"] == 95.0


def test_generate_summary():
    report = generate_summary(days=14)
    assert report["period_days"] == 14
    assert report["status"] == "READY"
    assert "metrics" in report


def test_format_as_markdown():
    data = {"period_days": 7, "generated_at": "2026-10-15T00:00:00", "metrics": {"total_jobs": 10, "failed_jobs": 0, "success_rate": 100.0}}
    md = format_as_markdown(data)
    assert "# Performance Report" in md
    assert "Success Rate: 100.0%" in md


def test_schedule_report_generation():
    run_id = schedule_report_generation("0 0 * * *", days=30)
    assert run_id.startswith("sched_")
    runs = list_scheduled_runs()
    assert any(r["run_id"] == run_id for r in runs)
