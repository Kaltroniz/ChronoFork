"""In-memory database store simulation for job runs."""
from taskflow.config import load_config

_DB_STORE = {}


def get_connection(path: str = "app.conf") -> dict:
    """
    Establishes simulated database connection using application config.
    DEPENDENCY HOP 1 (from auth.validate_token): Calls load_config(path).
    Expects loaded configuration to be a dictionary.
    """
    cfg = load_config(path=path)
    return {
        "db_url": f"sqlite:///taskflow_{cfg['env']}.db",
        "timeout": cfg["timeout"],
        "secret": cfg["auth_secret"],
        "connected": True
    }


def save_result(key: str, val: dict) -> None:
    """Persists job result into store."""
    _DB_STORE[key] = val


def get_result(key: str) -> dict:
    """Retrieves job result by key."""
    return _DB_STORE.get(key, {})


def clear_store() -> None:
    """Wipes in-memory database."""
    _DB_STORE.clear()
