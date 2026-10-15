"""Collector module for Analytics repo."""


def collect_datapoint(source: str, value: float) -> dict:
    """Collects single telemetry point."""
    return {"source": source, "value": value}
