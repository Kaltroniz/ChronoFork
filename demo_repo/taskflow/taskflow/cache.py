"""In-memory caching layer."""
_CACHE = {}


def cache_key_exists(key: str) -> bool:
    """Checks if key resides in cache."""
    return key in _CACHE


def get_cached_item(key: str) -> str:
    """Fetches cached item by key."""
    return _CACHE.get(key, "")


def set_cached_item(key: str, val: str) -> None:
    """Stores item into cache."""
    _CACHE[key] = val


def flush_cache() -> None:
    """Flushes cache."""
    _CACHE.clear()
