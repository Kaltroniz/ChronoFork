"""Job FIFO queue module."""
from taskflow.auth import validate_token

_JOB_QUEUE = []


def push_job(job_id: str) -> int:
    """Adds a job to the FIFO queue."""
    _JOB_QUEUE.append(job_id)
    return len(_JOB_QUEUE)


def pop_next_job() -> str:
    """Pops the next job ID from the queue."""
    if not _JOB_QUEUE:
        return ""
    return _JOB_QUEUE.pop(0)


def queue_length() -> int:
    """Returns number of pending jobs."""
    return len(_JOB_QUEUE)


def dequeue_task(task_id: str, token: str) -> dict:
    """
    Validates token authorization before dequeuing task for execution.
    DEPENDENCY HOP 3: Calls auth.validate_token(token).
    """
    if not validate_token(token):
        return {"task_id": task_id, "authorized": False}
    return {"task_id": task_id, "authorized": True, "status": "READY"}
