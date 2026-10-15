"""Report exporter module."""
from taskflow.reports.formatter import format_as_markdown

_EXPORT_STORAGE = {}


def export_report_to_memory(report_id: str, report_data: dict) -> str:
    """Exports report to memory storage using formatter."""
    md_content = format_as_markdown(report_data)
    _EXPORT_STORAGE[report_id] = md_content
    return md_content


def get_exported_report(report_id: str) -> str:
    """Retrieves exported markdown by report_id."""
    return _EXPORT_STORAGE.get(report_id, "")
