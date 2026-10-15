import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Set DEMO_MODE=true
os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

# 1. Test POST /repos is rejected with 403 Forbidden in DEMO_MODE
res_repos = client.post("/repos", json={"repo_name": "test_repo", "repo_path": "/tmp/test"})
print(f"POST /repos status in DEMO_MODE: {res_repos.status_code} ({res_repos.json().get('detail')})")
assert res_repos.status_code == 403, f"Expected 403 Forbidden, got {res_repos.status_code}"

# 2. Test POST /runs with mode="live" is forced to "replay" in DEMO_MODE
res_runs = client.post("/runs", json={"scenario": 1, "mode": "live"})
print(f"POST /runs response in DEMO_MODE: {res_runs.json()}")
assert res_runs.status_code == 200
data_runs = res_runs.json()
assert data_runs["mode"] == "replay", f"Expected mode to be forced to replay, got {data_runs['mode']}"
assert data_runs["status"] == "REPLAY_CACHED", f"Expected REPLAY_CACHED, got {data_runs['status']}"

print("\nItem 9 Status: VERIFIED & PASSING!")
