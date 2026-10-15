"""Common utilities for formatting and hashing."""
import hashlib
import json


def hash_payload(data: dict) -> str:
    """Hashes dict data to MD5 string."""
    encoded = json.dumps(data, sort_keys=True).encode("utf-8")
    return hashlib.md5(encoded).hexdigest()


def sanitize_identifier(raw: str) -> str:
    """Sanitizes user input string for alphanumeric tokens."""
    return "".join(ch for ch in raw if ch.isalnum() or ch in ("_", "-")).lower()
