"""Structured logging service for task activities."""
import datetime

_LOG_HISTORY = []


def format_log_entry(level: str, message: str) -> dict:
    """Formats a structured log record."""
    return {
        "ts": datetime.datetime.now().isoformat(),
        "level": level.upper(),
        "message": message
    }


def log_event(level: str, message: str) -> dict:
    """Logs an application event and appends to history."""
    entry = format_log_entry(level, message)
    _LOG_HISTORY.append(entry)
    return entry


def get_logs() -> list:
    """Retrieves all logged events."""
    return list(_LOG_HISTORY)
