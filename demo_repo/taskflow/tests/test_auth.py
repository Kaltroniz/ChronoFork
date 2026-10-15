"""Tests for taskflow.auth module."""
from taskflow.auth import validate_token, extract_claims


def test_extract_claims():
    claims = extract_claims("user123.admin")
    assert claims["sub"] == "user123"
    assert claims["role"] == "admin"


def test_validate_token_valid():
    # Secret is 'chrono-secret-key-42'
    valid_tok = "tok_chrono-secret-key-42_user99"
    assert validate_token(valid_tok) is True


def test_validate_token_invalid():
    assert validate_token("invalid_token") is False
    assert validate_token("") is False
