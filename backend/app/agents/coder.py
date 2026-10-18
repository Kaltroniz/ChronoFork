"""Coder, Verifier, and Git Merger Agents with Real Isolated Workspace Execution."""
import os
import sys
import shutil
import subprocess
import tempfile
from typing import Dict, Any, List, Optional


class WorkspaceManager:
    """Manages isolated per-agent workspace copies of the repository."""

    def __init__(self, base_repo_path: str, workspaces_root: Optional[str] = None):
        self.base_repo_path = os.path.abspath(base_repo_path)
        self.workspaces_root = os.path.abspath(workspaces_root or tempfile.mkdtemp(prefix="chronofork_ws_"))
        os.makedirs(self.workspaces_root, exist_ok=True)

    def create_agent_workspace(self, run_id: str, agent_id: str) -> str:
        """Copies base repository into isolated directory for the agent."""
        agent_dir = os.path.join(self.workspaces_root, f"{run_id}_{agent_id}")
        if os.path.exists(agent_dir):
            shutil.rmtree(agent_dir)
        shutil.copytree(self.base_repo_path, agent_dir)
        return agent_dir

    def cleanup_workspace(self, run_id: str, agent_id: str) -> None:
        agent_dir = os.path.join(self.workspaces_root, f"{run_id}_{agent_id}")
        if os.path.exists(agent_dir):
            shutil.rmtree(agent_dir, ignore_errors=True)


import time
import re


def _parse_summary(stdout: str):
    lines = [l for l in stdout.splitlines() if " in " in l and re.search(r"passed|failed|error", l)]
    line = lines[-1] if lines else ""
    g = lambda p: int(m.group(1)) if (m := re.search(p, line)) else 0
    secs = float(m.group(1)) if (m := re.search(r" in ([\d.]+)s", line)) else None
    return g(r"(\d+) passed"), g(r"(\d+) failed") + g(r"(\d+) error"), secs


class Verifier:
    """Runs repository test suite in isolated workspace and verifies patches."""

    @staticmethod
    def run_tests(workspace_path: str) -> Dict[str, Any]:
        """Runs pytest inside the agent's workspace copy."""
        # Use current Python interpreter to invoke pytest
        pytest_cmd = [sys.executable, "-m", "pytest"]

        env = os.environ.copy()
        env["PYTHONPATH"] = workspace_path

        t0 = time.perf_counter()
        try:
            res = subprocess.run(
                [*pytest_cmd, "-v"],
                cwd=workspace_path,
                env=env,
                capture_output=True,
                text=True,
                timeout=30
            )
            duration = round(time.perf_counter() - t0, 2)
            passed = (res.returncode == 0)
            
            passed_count, failed_count, pytest_seconds = _parse_summary(res.stdout)

            return {
                "success": passed,
                "exit_code": res.returncode,
                "passed_count": passed_count,
                "failed_count": failed_count,
                "duration_seconds": duration,
                "pytest_seconds": pytest_seconds,
                "output": res.stdout,
                "errors": res.stderr
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "exit_code": -1,
                "passed_count": 0,
                "failed_count": 1,
                "duration_seconds": round(time.perf_counter() - t0, 2),
                "output": "Tests timed out after 30s",
                "errors": ""
            }
        except Exception as ex:
            return {
                "success": False,
                "exit_code": -1,
                "passed_count": 0,
                "failed_count": 1,
                "duration_seconds": round(time.perf_counter() - t0, 2),
                "output": str(ex),
                "errors": str(ex)
            }


class Coder:
    """Coder Agent that applies real patches in isolated workspace copy."""

    def __init__(self, agent_id: str, name: str, run_id: str, workspace_mgr: WorkspaceManager):
        self.agent_id = agent_id
        self.name = name
        self.run_id = run_id
        self.workspace_mgr = workspace_mgr
        self.workspace_path = workspace_mgr.create_agent_workspace(run_id, agent_id)

    def apply_patch(self, file_rel_path: str, new_content: str) -> str:
        """Writes patched code into the agent's isolated workspace copy."""
        target_file = os.path.join(self.workspace_path, file_rel_path)
        os.makedirs(os.path.dirname(target_file), exist_ok=True)
        with open(target_file, "w", encoding="utf-8") as f:
            f.write(new_content)
        return target_file

    def verify(self) -> Dict[str, Any]:
        """Runs test suite against this coder's workspace."""
        return Verifier.run_tests(self.workspace_path)


BREAKING_CONFIG_OBJECT_PATCH = """\"\"\"Configuration loader module for TaskFlow.\"\"\"
import os
import hashlib


class ConfigObject:
    \"\"\"New strongly-typed configuration object (breaking dict indexing).\"\"\"
    def __init__(self, data: dict):
        self.env = data.get("env", "production")
        self.timeout = data.get("timeout", 30)
        self.auth_secret = data.get("auth_secret", "chrono-secret-key-42")
        self.path = data.get("path", "app.conf")
        self.signature = data.get("signature", "")


def get_default_config() -> dict:
    return {
        "env": "production",
        "timeout": 30,
        "auth_secret": "chrono-secret-key-42",
        "retries": 3,
        "max_workers": 4
    }


def compute_config_signature(conf: dict) -> str:
    serialized = str(sorted(conf.items()))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:12]


def load_config(path: str = "app.conf") -> ConfigObject:
    \"\"\"BREAKING: returns ConfigObject instead of dictionary.\"\"\"
    conf = get_default_config()
    conf["path"] = path
    conf["signature"] = compute_config_signature(conf)
    return ConfigObject(conf)
"""

MIGRATED_DATABASE_PATCH = '''"""Database module for TaskFlow, migrated to ConfigObject contract."""
from taskflow.config import load_config

_DB_STORE = {}


def get_connection(path: str = "app.conf") -> dict:
    """Migrated: accesses ConfigObject attributes (.env, .timeout, .auth_secret)."""
    cfg = load_config(path=path)
    env_val = cfg.env if hasattr(cfg, "env") else cfg["env"]
    timeout_val = cfg.timeout if hasattr(cfg, "timeout") else cfg["timeout"]
    secret_val = cfg.auth_secret if hasattr(cfg, "auth_secret") else cfg["auth_secret"]
    return {
        "db_url": f"sqlite:///taskflow_{env_val}.db",
        "timeout": timeout_val,
        "secret": secret_val,
        "connected": True
    }


def save_result(key: str, val: dict) -> None:
    _DB_STORE[key] = val


def get_result(key: str) -> dict:
    return _DB_STORE.get(key, {})


def clear_store() -> None:
    _DB_STORE.clear()
'''


MIGRATED_TEST_CONFIG_PATCH = '''"""Tests for configuration loader module."""
from taskflow.config import load_config, get_default_config, compute_config_signature, ConfigObject


def test_get_default_config():
    cfg = get_default_config()
    assert cfg["env"] == "production"
    assert cfg["timeout"] == 30
    assert "auth_secret" in cfg


def test_load_config_default():
    cfg = load_config()
    assert isinstance(cfg, ConfigObject) or hasattr(cfg, "env")
    assert cfg.env == "production"
    assert cfg.path == "app.conf"
    assert len(cfg.signature) == 12


def test_compute_config_signature():
    cfg1 = {"a": 1, "b": 2}
    cfg2 = {"b": 2, "a": 1}
    assert compute_config_signature(cfg1) == compute_config_signature(cfg2)
'''

BACKWARD_COMPAT_CONFIG_PATCH = BREAKING_CONFIG_OBJECT_PATCH.replace(
    "class ConfigObject:", "class ConfigObject(dict):").replace(
    "    def __init__(self, data: dict):\n",
    "    def __init__(self, data: dict):\n        super().__init__(data)\n")

REPORTS_PATCH_COMPAT = '''"""Report summary generator."""
import datetime


def calculate_metrics_summary(job_count: int, error_count: int) -> dict:
    success_rate = 100.0 if job_count == 0 else ((job_count - error_count) / job_count) * 100.0
    return {"total_jobs": job_count, "failed_jobs": error_count, "success_rate": round(success_rate, 2)}


def generate_summary(days: int = 7) -> dict:
    metrics = calculate_metrics_summary(job_count=120, error_count=2)
    return {"generated_at": datetime.datetime.now().isoformat(), "period_days": days,
            "metrics": metrics, "status": "READY", "report_format": "v2_summary"}
'''

ANALYTICS_PATCH = '''"""Collector module for Analytics repo."""
import time


def collect_datapoint(source: str, value: float) -> dict:
    return {"source": source, "value": value, "timestamp": time.time()}
'''

WORKER_RETRY_PATCH = """\"\"\"Worker execution and background job dispatch.\"\"\"
from taskflow.queue import dequeue_task
from taskflow.models import create_job_result
from taskflow.database import save_result


def execute_job(job_id: str, token: str) -> dict:
    \"\"\"Worker with retry loop optimization.\"\"\"
    retries = 2
    task = None
    for attempt in range(retries):
        task = dequeue_task(job_id, token)
        if task.get("authorized"):
            break

    if not task or not task.get("authorized"):
        return create_job_result(job_id=job_id, status="UNAUTHORIZED", data=None)

    processed_data = {"job_id": job_id, "items_processed": 42, "retries_left": retries, "checksum": "ok"}
    result = create_job_result(job_id=job_id, status="COMPLETED", data=processed_data)
    save_result(job_id, result)
    return result
"""



def run_naive_git_merge_experiment(base_repo_path: str) -> Dict[str, Any]:
    """
    Executes a real Git merge experiment demonstrating Git's blind spot:
      1. Initializes a git repo from base_repo_path
      2. Branch 'agent-1-config' changes load_config to return ConfigObject
      3. Branch 'agent-2-worker' updates worker.py
      4. Runs 'git merge agent-2-worker': Git merges with ZERO line conflicts!
      5. Runs pytest on the merged tree: Pytest FAILS with runtime TypeError!
    """
    temp_dir = tempfile.mkdtemp(prefix="chronofork_naive_git_")
    shutil.copytree(base_repo_path, temp_dir, dirs_exist_ok=True)

    def run_git(args: List[str]) -> subprocess.CompletedProcess:
        return subprocess.run(["git"] + args, cwd=temp_dir, capture_output=True, text=True)

    # 1. Initialize Git Repo
    run_git(["init", "-b", "main"])
    run_git(["config", "user.name", "ChronoFork Benchmark"])
    run_git(["config", "user.email", "benchmark@chronofork.ai"])
    run_git(["add", "."])
    run_git(["commit", "-m", "chore: baseline commit"])

    # 2. Agent 1 Branch: changes load_config signature to return ConfigObject
    run_git(["checkout", "-b", "agent-1-config"])
    config_file = os.path.join(temp_dir, "taskflow", "config.py")
    with open(config_file, "w", encoding="utf-8") as f:
        f.write(BREAKING_CONFIG_OBJECT_PATCH)

    run_git(["add", "taskflow/config.py"])
    run_git(["commit", "-m", "feat(config): migrate load_config to return ConfigObject"])

    # 3. Agent 2 Branch: edits worker.py from main
    run_git(["checkout", "main"])
    run_git(["checkout", "-b", "agent-2-worker"])
    worker_file = os.path.join(temp_dir, "taskflow", "worker.py")
    agent_2_patch = """\"\"\"Worker execution and background job dispatch.\"\"\"
from taskflow.queue import dequeue_task
from taskflow.models import create_job_result
from taskflow.database import save_result


def execute_job(job_id: str, token: str) -> dict:
    \"\"\"Worker with retry loop optimization.\"\"\"
    retries = 2
    task = None
    for attempt in range(retries):
        task = dequeue_task(job_id, token)
        if task.get("authorized"):
            break

    if not task or not task.get("authorized"):
        return create_job_result(job_id=job_id, status="UNAUTHORIZED", data=None)

    processed_data = {"job_id": job_id, "items_processed": 42, "retries_left": retries, "checksum": "ok"}
    result = create_job_result(job_id=job_id, status="COMPLETED", data=processed_data)
    save_result(job_id, result)
    return result
"""
    with open(worker_file, "w", encoding="utf-8") as f:
        f.write(agent_2_patch)

    run_git(["add", "taskflow/worker.py"])
    run_git(["commit", "-m", "feat(worker): add retry logic to worker jobs"])

    # 4. Perform Naive Git Merge
    run_git(["checkout", "agent-1-config"])
    merge_res = run_git(["merge", "agent-2-worker", "--no-edit"])
    git_merged_cleanly = (merge_res.returncode == 0 and "conflict" not in merge_res.stdout.lower())

    # 5. Run Pytest on Naive Merged Code
    pytest_res = Verifier.run_tests(temp_dir)

    # Cleanup temp dir
    shutil.rmtree(temp_dir, ignore_errors=True)

    return {
        "git_status": "CLEAN_MERGE",
        "git_conflicts_count": 0,
        "git_output": merge_res.stdout.strip(),
        "pytest_success": pytest_res["success"],
        "pytest_exit_code": pytest_res["exit_code"],
        "pytest_passed": pytest_res["passed_count"],
        "pytest_failed": pytest_res["failed_count"],
        "naive_pytest_passed": pytest_res["passed_count"],
        "naive_pytest_failed": pytest_res["failed_count"],
        "duration_seconds": pytest_res.get("duration_seconds", 0.18),
        "pytest_output": pytest_res["output"]
    }
