"""Deep verification suite for live ChronoFork deployment on AWS."""
import httpx
import json
import time

BASE_URL = "http://34.230.70.144"

def run_deep_check():
    client = httpx.Client(base_url=BASE_URL, timeout=15.0)
    results = {}

    print("=" * 60)
    print("STARTING DEEP VERIFICATION ON AWS: " + BASE_URL)
    print("=" * 60)

    # 1. Health & FalkorDB Connection
    print("\n[1/8] Checking /health...")
    r = client.get("/health")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    health_data = r.json()
    print("  -> Status:", health_data.get("status"))
    print("  -> FalkorDB Connected:", health_data.get("falkordb_connected"))
    print("  -> Active Graphs:", health_data.get("active_graphs"))
    results["health"] = health_data

    # 2. Graph Retrieval & Cytoscape formatting (repo:taskflow)
    print("\n[2/8] Checking /graph/taskflow...")
    r = client.get("/graph/taskflow")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    graph_data = r.json()
    print("  -> Nodes Count:", graph_data.get("node_count"))
    print("  -> Edges Count:", graph_data.get("edge_count"))
    print("  -> First Node:", graph_data.get("nodes", [{}])[0].get("data", {}).get("name"))
    results["graph"] = {"nodes": graph_data.get("node_count"), "edges": graph_data.get("edge_count")}

    # 3. Live Gemini Status
    print("\n[3/8] Checking /api/llm/status...")
    r = client.get("/api/llm/status")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    llm_data = r.json()
    print("  -> Provider:", llm_data.get("provider"))
    print("  -> Configured:", llm_data.get("configured"))
    print("  -> Mode:", llm_data.get("mode"))
    print("  -> Models Supported:", llm_data.get("models_supported"))
    results["llm"] = llm_data

    # 4. FastMCP Protocol & Manifest
    print("\n[4/8] Checking FastMCP /mcp (GET & POST)...")
    r_info = client.get("/mcp")
    assert r_info.status_code == 200
    print("  -> MCP Info:", r_info.json())

    r_tools = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert r_tools.status_code == 200
    tools = r_tools.json().get("result", {}).get("tools", [])
    print(f"  -> Tools Count: {len(tools)} tools registered:")
    for t in tools:
        print(f"     * {t['name']}: {t['description'][:50]}...")
    results["mcp_tools_count"] = len(tools)

    # 5. FastMCP Tool Execution via JSON-RPC
    print("\n[5/8] Calling FastMCP tool 'rank_risk' via JSON-RPC...")
    r_call = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {"name": "rank_risk", "arguments": {"repo": "taskflow"}}
    })
    assert r_call.status_code == 200
    call_content = json.loads(r_call.json()["result"]["content"][0]["text"])
    cfg_risk = call_content.get("taskflow.config.load_config", {})
    print(f"  -> load_config risk score: {cfg_risk.get('risk_score', 'N/A')} (PR: {cfg_risk.get('pagerank', 'N/A')}, BW: {cfg_risk.get('betweenness', 'N/A')})")
    results["load_config_risk"] = cfg_risk.get("risk_score")

    # 6. Scenario 1 Run Trigger & Collision Check
    print("\n[6/8] Testing Scenario 1 Run Execution (POST /runs)...")
    run_req = {
        "task": "Migrate load_config to return a ConfigObject and add retry logic to worker jobs",
        "repo": "taskflow",
        "scenario": 1,
        "mode": "replay",
        "memory_enabled": True
    }
    r_run = client.post("/runs", json=run_req)
    assert r_run.status_code == 200, f"Expected 200, got {r_run.status_code}: {r_run.text}"
    run_resp = r_run.json()
    run_id = run_resp.get("run_id")
    print(f"  -> Run ID: {run_id}, Status: {run_resp.get('status')}, Events: {run_resp.get('events_count')}")

    # 7. SSE Events Streaming
    print("\n[7/8] Testing Event Stream (/runs/{run_id}/events)...")
    event_count = 0
    with client.stream("GET", f"/runs/{run_id}/events?delay_ms=50") as stream:
        for line in stream.iter_lines():
            if line.startswith("data:"):
                event_count += 1
                evt = json.loads(line[5:])
                if evt.get("type") in ("COLLISION_DETECTED", "VERIFIER_VERIFIED", "MEMORY_RULE_LEARNED"):
                    print(f"  -> Captured event [{evt.get('type')}]: {evt.get('data', {}).get('policy') or evt.get('data', {}).get('rule') or evt.get('data', {}).get('test_summary')}")
    print(f"  -> Total Streamed Events: {event_count}")
    results["streamed_events"] = event_count

    # 8. Memory Drawer (/memory/taskflow)
    print("\n[8/8] Checking Episodic Memory (/memory/taskflow)...")
    r_mem = client.get("/memory/taskflow")
    assert r_mem.status_code == 200
    mem_data = r_mem.json()
    print(f"  -> Rules Count: {len(mem_data.get('rules', []))}")
    print(f"  -> Episodes Count: {len(mem_data.get('episodes', []))}")
    if mem_data.get("rules"):
        print(f"  -> Top Rule: {mem_data['rules'][0]['rule']} (confidence: {mem_data['rules'][0]['confidence']})")
    results["memory"] = {"rules": len(mem_data.get("rules", [])), "episodes": len(mem_data.get("episodes", []))}

    print("\n" + "=" * 60)
    print("ALL 8 DEEP VERIFICATION CHECKS PASSED ON LIVE AWS DEPLOYMENT!")
    print("=" * 60)

if __name__ == "__main__":
    run_deep_check()
