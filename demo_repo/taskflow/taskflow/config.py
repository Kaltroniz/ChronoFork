"""Configuration loader module for TaskFlow."""
import os
import hashlib


def get_default_config() -> dict:
    """Returns default configuration dictionary."""
    return {
        "env": "production",
        "timeout": 30,
        "auth_secret": "chrono-secret-key-42",
        "retries": 3,
        "max_workers": 4
    }


def compute_config_signature(conf: dict) -> str:
    """Computes a hash signature of the configuration dictionary."""
    serialized = str(sorted(conf.items()))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:12]


def load_config(path: str = "app.conf") -> dict:
    """
    Loads application configuration.
    BASELINE SIGNATURE: (path: str = 'app.conf') -> dict
    """
    conf = get_default_config()
    conf["path"] = path
    conf["signature"] = compute_config_signature(conf)
    return conf
