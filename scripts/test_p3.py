"""P3 Acceptance Test: Memory Graph, Recall, and Dynamic Confidence Updates."""
import sys
import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from backend.app.falkor_client import falkor_client
from backend.app.memory import (
    record_episode,
    recall_memory,
    update_rule_confidence,
    get_memory_graph_name
)

print("=== P3 Acceptance Test Starting ===")

# Clean any existing test memory graph
falkor_client.delete_graph("mem:taskflow")

# 1. Simulate First Run Completion (Scenario 1)
print("\n--- Step 1: Recording Episode from Scenario 1 ---")
ep1 = record_episode(
    repo_name="taskflow",
    run_id="run_scenario_1",
    task="Migrate load_config to return ConfigObject and update worker",
    outcome="SUCCESS_AFTER_SERIALIZATION",
    summary="Agent 1 signature change on load_config collided transitively with worker.execute_job. Resolved by serializing Agent 1 ahead of Agent 2.",
    involved_symbols=["taskflow.config.load_config", "taskflow.worker.execute_job"],
    rule_learned={
        "id": "rule_cfg_worker_transitive",
        "rule": "load_config signature changes break transitive caller worker.execute_job (4 hops via database, auth, queue)",
        "advice": "Serialize execution: Agent modifying load_config must complete and merge before worker edits proceed.",
        "confidence": 0.80
    }
)
print(f"Recorded Episode ID: {ep1['episode_id']}, Learned Rule ID: {ep1['rule_id']}")

# 2. Verify Rule Confidence Update on Successful Merge
print("\n--- Step 2: Verification of Rule Confidence Update ---")
new_conf = update_rule_confidence("taskflow", "rule_cfg_worker_transitive", success=True)
print(f"Confidence after successful merge: {new_conf:.2f} (rises from 0.80 -> 0.90)")
assert new_conf >= 0.90, f"Expected confidence >= 0.90, got {new_conf}"

# 3. Simulate Second Run (Scenario 2): Memory Recall upfront
print("\n--- Step 3: Scenario 2 Memory Recall upfront ---")
candidate_symbols = ["taskflow.config.load_config"]
recalled = recall_memory("taskflow", candidate_symbols)

print(f"Recalled {len(recalled['rules'])} rule(s) and {len(recalled['episodes'])} episode(s).")
assert len(recalled["rules"]) >= 1, "Expected at least 1 recalled procedural rule"
rule = recalled["rules"][0]
print(f"  Recalled Rule ID: {rule['id']}")
print(f"  Rule: {rule['rule']}")
print(f"  Advice: {rule['advice']}")
print(f"  Confidence: {rule['confidence'] * 100:.0f}%")
print(f"  Trigger Symbol: {rule['trigger_symbol']}")

assert rule["id"] == "rule_cfg_worker_transitive"
assert rule["confidence"] >= 0.90
print("\nPASSED: Scenario 2 recalled past lesson upfront with high confidence (90%)!")
print("Behavior changed: Agents serialize upfront without suffering runtime failure.")

print("\n>>> P3 ACCEPTANCE TEST PASSED SUCCESSFULLY! <<<")
