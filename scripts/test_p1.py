"""P1 Acceptance Test: Ingestion + Code Graph + Impact Query."""
import sys
import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from backend.app.falkor_client import falkor_client
from backend.app.parser import parse_repository, ingest_code_graph_to_falkordb
from backend.app.algorithms import query_impact, compute_risk_rankings, find_shortest_call_path

print("=== P1 Acceptance Test: Ingesting demo_repo/taskflow ===")
repo_path = os.path.join(ROOT_DIR, "demo_repo", "taskflow")
cg = parse_repository(repo_path, "taskflow")

print(f"Parsed {len(cg.symbols)} symbols, {len(cg.calls_edges)} CALLS edges, {len(cg.tested_by_edges)} TESTED_BY edges.")

# Ingest to FalkorDB
stats = ingest_code_graph_to_falkordb(cg, falkor_client)
print(f"Ingested to FalkorDB: {stats}")

# 1. Verify transitive call chain: worker.execute_job -> ... -> config.load_config
load_cfg = "taskflow.config.load_config"
worker_exec = "taskflow.worker.execute_job"

g = falkor_client.get_graph("repo:taskflow")
check_chain, _ = falkor_client.query("repo:taskflow", """
MATCH p = (w:Symbol {qualname: $worker})-[:CALLS*1..5]->(c:Symbol {qualname: $cfg})
RETURN [n in nodes(p) | n.qualname] AS chain, length(p) AS hops
""", {"worker": worker_exec, "cfg": load_cfg})

assert len(check_chain.result_set) >= 1, f"Expected transitive chain, got {len(check_chain.result_set)}"
print(f"PASSED: Found exact {check_chain.result_set[0][1]}-hop call chain: {check_chain.result_set[0][0]}")

# 2. Verify NO FALSE EDGES to reports subsystem
false_edge_check, _ = falkor_client.query("repo:taskflow", """
MATCH (r:Symbol)-[:CALLS]->(c:Symbol {qualname: $cfg})
WHERE r.qualname CONTAINS 'reports'
RETURN r.qualname
""", {"cfg": load_cfg})

assert len(false_edge_check.result_set) == 0, f"Found unexpected false edge from reports: {false_edge_check.result_set}"
print("PASSED: Zero false edges from independent 'reports' subsystem to load_config.")

# 3. Test impact analysis of load_config
impact = query_impact("repo:taskflow", load_cfg)
print(f"\n--- Impact Analysis for {load_cfg} ---")
print(f"Dependent callers count: {impact['dependent_callers_count']}")
for dep in impact["dependent_callers"]:
    print(f"  Caller: {dep['qualname']} (depth: {dep['depth']}, chain: {' -> '.join(dep['chain'])})")

print(f"Affected tests count: {impact['affected_tests_count']}")
for tst in impact["affected_tests"]:
    print(f"  Test: {tst['test_name']} ({tst['test_path']})")

assert impact["dependent_callers_count"] >= 2, "Expected at least 2 callers in the transitive chain"
assert any(d["qualname"] == worker_exec for d in impact["dependent_callers"]), "Worker execute_job must be in transitive callers"
assert any("test_worker" in t["test_path"] for t in impact["affected_tests"]), "test_worker must be in affected tests"

# 4. Shortest call path between worker and load_config
sp = find_shortest_call_path("repo:taskflow", worker_exec, load_cfg)
assert sp is not None, "Expected shortest path from worker to config"
print(f"\nShortest call path from worker to load_config: {' -> '.join(sp['path_nodes'])} (hops: {sp['hops']})")

# 5. Risk rankings
rankings = compute_risk_rankings("repo:taskflow")
print(f"\nTop 5 Risk-Scored Symbols in taskflow:")
sorted_ranks = sorted(rankings.items(), key=lambda x: x[1]["risk_score"], reverse=True)[:5]
for qname, scores in sorted_ranks:
    print(f"  {qname}: risk = {scores['risk_score']} (PR: {scores['pagerank']}, BW: {scores['betweenness']})")

print("\n>>> P1 ACCEPTANCE TEST PASSED SUCCESSFULLY! <<<")
