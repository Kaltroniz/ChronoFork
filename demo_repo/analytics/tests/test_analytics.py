"""Tests for analytics repo."""
from analytics.aggregator import aggregate_stream
from analytics.collector import collect_datapoint


def test_collect():
    pt = collect_datapoint("test", 10.5)
    assert pt["source"] == "test"
    assert pt["value"] == 10.5


def test_aggregate():
    assert aggregate_stream([1.0, 2.0, 3.0]) == 6.0
