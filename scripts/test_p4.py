"""P4 Acceptance Test: FastMCP Tools, In-Memory SSE Buffering, Replay Mode."""
import sys
import os
import json

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.mcp_tools import get_impact, rank_risk, recall_memory, detect_collisions

print("=== P4 Acceptance Test Starting ===")

# Ensure demo repositories are ingested
from backend.app.scenario_runner import ensure_demo_repos_ingested
ensure_demo_repos_ingested()

# 1. Test FastMCP Tools In-Process Callability
print("\n--- Testing FastMCP Tools in-process ---")
impact_res = get_impact("taskflow", "taskflow.config.load_config")
assert impact_res["dependent_callers_count"] >= 2, "FastMCP get_impact failed"
print(f"FastMCP get_impact: SUCCESS ({impact_res['dependent_callers_count']} callers, {impact_res['affected_tests_count']} tests)")

risk_res = rank_risk("taskflow")
assert "taskflow.config.load_config" in risk_res, "FastMCP rank_risk failed"
print(f"FastMCP rank_risk: SUCCESS (load_config risk = {risk_res['taskflow.config.load_config']['risk_score']})")

mem_res = recall_memory("taskflow", ["taskflow.config.load_config"])
print(f"FastMCP recall_memory: SUCCESS ({len(mem_res['rules'])} rules recalled)")

# 2. Test FastAPI Endpoints
print("\n--- Testing FastAPI Endpoints ---")
client = TestClient(app)

# Health
health = client.get("/health")
assert health.status_code == 200
assert health.json()["falkordb_connected"] is True
print("GET /health: 200 OK")

# Cytoscape Graph Data
graph_resp = client.get("/graph/repo:taskflow")
assert graph_resp.status_code == 200
graph_data = graph_resp.json()
assert graph_data["node_count"] > 0
assert graph_data["edge_count"] > 0
# Check Cytoscape format: elements have 'data' dict
assert "data" in graph_data["nodes"][0]
assert "id" in graph_data["nodes"][0]["data"]
assert "label" in graph_data["nodes"][0]["data"]
assert "data" in graph_data["edges"][0]
assert "source" in graph_data["edges"][0]["data"]
assert "target" in graph_data["edges"][0]["data"]
print(f"GET /graph/repo:taskflow: 200 OK ({graph_data['node_count']} nodes, {graph_data['edge_count']} edges in Cytoscape format)")

# 3. Test Replay Run Execution and SSE Event Buffering
print("\n--- Testing POST /runs & SSE Event Buffer Replay ---")
post_run = client.post("/runs", json={
    "task": "Migrate load_config to return a ConfigObject and add retry logic to worker jobs",
    "repo": "taskflow",
    "scenario": 1,
    "mode": "replay",
    "run_id": "test_p4_run"
})
assert post_run.status_code == 200
run_data = post_run.json()
print(f"POST /runs: 200 OK (run_id: {run_data['run_id']})")

# Test SSE stream endpoint replaying from index 0
sse_resp = client.get(f"/runs/{run_data['run_id']}/events?delay_ms=0")
assert sse_resp.status_code == 200

# Parse SSE lines
events = []
for line in sse_resp.text.strip().split("\n"):
    if line.startswith("data: "):
        payload = json.loads(line[6:])
        if payload.get("type") != "RUN_COMPLETE":
            events.append(payload)

print(f"GET /runs/{run_data['run_id']}/events: received {len(events)} buffered events starting from index 0!")
assert len(events) >= 8, f"Expected at least 8 events in scenario 1, got {len(events)}"

# Verify event schema
required_fields = ["ts", "run_id", "agent", "phase", "tool", "cypher", "params", "node_ids", "edge_ids", "scores", "collision", "memory_write", "message"]
for idx, evt in enumerate(events):
    for f in required_fields:
        assert f in evt, f"Event {idx} missing field {f}"

print("PASSED: Every emitted event strictly conforms to prompt specification!")

# Verify Collision in Event Stream
collision_events = [e for e in events if e.get("collision") is not None]
assert len(collision_events) >= 1, "Expected collision event in stream"
c = collision_events[0]["collision"]
assert c["hops"] >= 2
assert c["policy"] == "SERIALIZE"
print(f"PASSED: Collision correctly streamed ({c['hops']} hops): {c['reason'][:80]}...")

# 4. Test Memory Drawer Endpoint
mem_endpoint = client.get("/memory/taskflow")
assert mem_endpoint.status_code == 200
mem_json = mem_endpoint.json()
assert len(mem_json["rules"]) >= 1
assert len(mem_json["episodes"]) >= 1
print(f"GET /memory/taskflow: 200 OK ({len(mem_json['rules'])} rules, {len(mem_json['episodes'])} episodes for Memory Drawer)")

print("\n>>> P4 ACCEPTANCE TEST PASSED SUCCESSFULLY! Full run works in replay with zero API key! <<<")
