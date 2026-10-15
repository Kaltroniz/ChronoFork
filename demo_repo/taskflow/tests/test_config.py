"""Tests for taskflow.config module."""
from taskflow.config import load_config, get_default_config, compute_config_signature


def test_get_default_config():
    cfg = get_default_config()
    assert cfg["env"] == "production"
    assert cfg["timeout"] == 30
    assert "auth_secret" in cfg


def test_load_config_default():
    cfg = load_config()
    assert isinstance(cfg, dict)
    assert cfg["path"] == "app.conf"
    assert "signature" in cfg
    assert len(cfg["signature"]) == 12


def test_compute_config_signature():
    cfg1 = {"a": 1, "b": 2}
    cfg2 = {"b": 2, "a": 1}
    assert compute_config_signature(cfg1) == compute_config_signature(cfg2)
