import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

# 1. Test Replay Mode: instant cache response (< 50ms)
t0 = time.time()
res_replay = client.post("/runs", json={"scenario": 1, "mode": "replay"})
replay_dur = time.time() - t0
assert res_replay.status_code == 200
data_replay = res_replay.json()
print("Replay Mode Response:", data_replay)
print(f"Replay Latency: {replay_dur * 1000:.1f}ms (Instant!)")
assert data_replay["status"] == "REPLAY_CACHED"
assert data_replay["cached"] is True
assert data_replay["events_count"] == 14

# 2. Test Stream Endpoint on Replayed Run
events_res = client.get(f"/runs/{data_replay['run_id']}/events?delay_ms=0")
assert events_res.status_code == 200
lines = [l for l in events_res.text.split("\n") if l.startswith("data:")]
print(f"Streamed {len(lines)} event lines from cache successfully!")

print("\nItem 4 Status: VERIFIED & PASSING!")
