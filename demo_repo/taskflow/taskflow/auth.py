"""Authentication and token validation module."""
from taskflow.database import get_connection


def extract_claims(token: str) -> dict:
    """Extract claims from pseudo-token format."""
    parts = token.split(".")
    if len(parts) >= 2:
        return {"sub": parts[0], "role": parts[1]}
    return {"sub": "guest", "role": "viewer"}


def validate_token(token: str, path: str = "app.conf") -> bool:
    """
    Validates user authentication token against database security context.
    DEPENDENCY HOP 2: Calls database.get_connection(path).
    """
    if not token or len(token) < 5:
        return False
    
    conn = get_connection(path=path)
    secret = conn.get("secret", "")
    
    # Token must include or end with the secret prefix or match pattern
    return token.startswith("tok_") and secret in token
