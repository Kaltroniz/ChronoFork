"""Report markdown and text formatter."""


def format_as_markdown(report_data: dict) -> str:
    """Formats report dictionary into clean Markdown table."""
    metrics = report_data.get("metrics", {})
    return f"""# Performance Report ({report_data.get('period_days', 0)} Days)
- Generated: {report_data.get('generated_at')}
- Total Jobs: {metrics.get('total_jobs')}
- Failed Jobs: {metrics.get('failed_jobs')}
- Success Rate: {metrics.get('success_rate')}%
"""


def format_as_csv_row(report_data: dict) -> str:
    """Formats report as single CSV row."""
    m = report_data.get("metrics", {})
    return f"{report_data.get('period_days')},{m.get('total_jobs')},{m.get('failed_jobs')},{m.get('success_rate')}\n"
