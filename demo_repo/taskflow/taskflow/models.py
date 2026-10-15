"""Data models and serialization structures."""
from dataclasses import dataclass, asdict
from typing import Optional, Any


@dataclass
class JobModel:
    job_id: str
    status: str
    data: Optional[Any] = None


def create_job_result(job_id: str, status: str, data: Any = None) -> dict:
    """Helper to instantiate and serialize JobModel."""
    model = JobModel(job_id=job_id, status=status, data=data)
    return asdict(model)
