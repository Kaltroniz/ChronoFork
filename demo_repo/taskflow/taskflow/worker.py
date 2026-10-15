"""Worker execution and background job dispatch."""
from taskflow.queue import dequeue_task
from taskflow.models import create_job_result
from taskflow.database import save_result


def execute_job(job_id: str, token: str) -> dict:
    """
    Executes a queued background task.
    DEPENDENCY HOP 4 (Transitive): Calls queue.dequeue_task(job_id, token),
    which calls auth.validate_token(), which calls database.get_connection(),
    which calls config.load_config().
    """
    task = dequeue_task(job_id, token)
    if not task.get("authorized"):
        return create_job_result(job_id=job_id, status="UNAUTHORIZED", data=None)
    
    # Process job payload
    processed_data = {"job_id": job_id, "items_processed": 42, "checksum": "ok"}
    result = create_job_result(job_id=job_id, status="COMPLETED", data=processed_data)
    
    save_result(job_id, result)
    return result
