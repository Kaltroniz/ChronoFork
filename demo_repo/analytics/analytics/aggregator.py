"""Aggregator module for Analytics repo."""
from analytics.collector import collect_datapoint


def aggregate_stream(readings: list) -> float:
    """Sums values collected from stream."""
    total = 0.0
    for r in readings:
        pt = collect_datapoint("stream", r)
        total += pt["value"]
    return total
