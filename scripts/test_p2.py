"""P2 Acceptance Test: Claims, Forks, and Collision Detection."""
import sys
import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from backend.app.falkor_client import falkor_client
from backend.app.coordinator import (
    init_coordination_graph,
    register_run,
    register_agent,
    register_claim,
    detect_collisions,
    fork_agent_graph,
    simulate_on_fork,
    cleanup_run_graphs,
    CollisionPolicy
)

print("=== P2 Acceptance Test Starting ===")

# Ensure base repo:taskflow exists
if "repo:taskflow" not in falkor_client.list_graphs():
    from backend.app.parser import parse_repository, ingest_code_graph_to_falkordb
    repo_path = os.path.join(ROOT_DIR, "demo_repo", "taskflow")
    cg = parse_repository(repo_path, "taskflow")
    ingest_code_graph_to_falkordb(cg, falkor_client)
assert "repo:taskflow" in falkor_client.list_graphs(), "repo:taskflow must exist"

# ----------------------------------------------------
# TEST 1: SCENARIO 1 (HIDDEN COLLISION)
# ----------------------------------------------------
print("\n--- Testing Scenario 1: Hidden Collision ---")
run_s1 = "run_test_s1"
init_coordination_graph(run_s1, "taskflow")
register_run(run_s1, "Migrate config to ConfigObject and update worker execution")
register_agent(run_s1, "agent_1", "ConfigCoder", "Backend Engineer", "#3b82f6")
register_agent(run_s1, "agent_2", "WorkerCoder", "Pipeline Engineer", "#f59e0b")

# Agent 1 changes signature of load_config
register_claim(run_s1, "agent_1", "taskflow.config.load_config", "SIGNATURE_CHANGE", "Return ConfigObject")
# Agent 2 edits body of worker.execute_job
register_claim(run_s1, "agent_2", "taskflow.worker.execute_job", "BODY_EDIT", "Add retry loop")

collisions_s1 = detect_collisions(run_s1)
print(f"Scenario 1 Collisions detected: {len(collisions_s1)}")
assert len(collisions_s1) >= 1, "Expected at least 1 collision in Scenario 1"

c = collisions_s1[0]
print(f"  Type: {c['type']}")
print(f"  Agents: {c['agent_a']} vs {c['agent_b']}")
print(f"  Symbols: {c['symbol_a']} vs {c['symbol_b']}")
print(f"  Hops: {c['hops']}")
print(f"  Path: {' -> '.join(c['path_nodes'])}")
print(f"  Policy: {c['policy']}")
print(f"  Reason: {c['reason']}")

assert c["hops"] >= 2, f"Expected multi-hop chain, got {c['hops']}"
assert "taskflow.worker.execute_job" in c["path_nodes"] and "taskflow.config.load_config" in c["path_nodes"]
assert c["policy"] == CollisionPolicy.SERIALIZE
print(f"PASSED: Scenario 1 successfully detected {c['hops']}-hop transitive collision with exact path and SERIALIZE policy!")

# Test speculative fork on Agent 1
fork_key = fork_agent_graph(run_s1, "agent_1", "taskflow")
assert fork_key in falkor_client.list_graphs()
sim_res = simulate_on_fork(run_s1, "agent_1", "taskflow.config.load_config", "SIGNATURE_CHANGE")
print(f"Speculative fork simulation on {fork_key}:")
print(f"  Before risk: {sim_res['before']['risk_score']}, After risk: {sim_res['after']['risk_score']}")
print(f"  Blast radius: {sim_res['after']['affected_tests']} affected tests")

# Cleanup S1
cleanup_run_graphs(run_s1)

# ----------------------------------------------------
# TEST 2: SCENARIO 3 (SAFE PARALLEL)
# ----------------------------------------------------
print("\n--- Testing Scenario 3: Safe Parallelism ---")
run_s3 = "run_test_s3"
init_coordination_graph(run_s3, "taskflow")
register_run(run_s3, "Independent tasks on core worker and reports subsystem")
register_agent(run_s3, "agent_1", "WorkerCoder", "Core Engineer", "#3b82f6")
register_agent(run_s3, "agent_3", "ReportsCoder", "Analytics Engineer", "#10b981")

# Agent 1 edits core worker
register_claim(run_s3, "agent_1", "taskflow.worker.execute_job", "BODY_EDIT", "Update worker batch size")
# Agent 3 edits reports subsystem
register_claim(run_s3, "agent_3", "taskflow.reports.generator.generate_summary", "BODY_EDIT", "Add quarterly metrics")

collisions_s3 = detect_collisions(run_s3)
print(f"Scenario 3 Collisions detected: {len(collisions_s3)}")
assert len(collisions_s3) == 0, f"Expected 0 collisions in Scenario 3, got {len(collisions_s3)}"
print("PASSED: Scenario 3 reports ZERO collisions, allowing safe parallel execution (PARALLEL_OK)!")

# Cleanup S3
cleanup_run_graphs(run_s3)

print("\n>>> P2 ACCEPTANCE TEST PASSED SUCCESSFULLY! <<<")
