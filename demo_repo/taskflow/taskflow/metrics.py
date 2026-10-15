"""Operational metrics tracking."""
_COUNTERS = {}
_GAUGES = {}


def increment_counter(name: str, step: int = 1) -> int:
    """Increments named counter metric."""
    _COUNTERS[name] = _COUNTERS.get(name, 0) + step
    return _COUNTERS[name]


def record_gauge(name: str, value: float) -> float:
    """Sets gauge value."""
    _GAUGES[name] = value
    return value


def get_metric(name: str):
    """Retrieves counter or gauge."""
    if name in _COUNTERS:
        return _COUNTERS[name]
    return _GAUGES.get(name, 0.0)
