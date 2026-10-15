"""Tests for taskflow.worker module."""
from taskflow.worker import execute_job
from taskflow.database import get_result, clear_store


def test_execute_job_authorized():
    clear_store()
    token = "tok_chrono-secret-key-42_sess"
    res = execute_job(job_id="job_001", token=token)
    assert res["status"] == "COMPLETED"
    assert res["job_id"] == "job_001"
    assert res["data"]["items_processed"] == 42
    assert get_result("job_001") == res


def test_execute_job_unauthorized():
    clear_store()
    res = execute_job(job_id="job_002", token="bad_token")
    assert res["status"] == "UNAUTHORIZED"
    assert res["data"] is None
