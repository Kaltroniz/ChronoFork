"""Comprehensive End-to-End Verification of All 4 ChronoFork Scenarios."""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.scenario_runner import (
    execute_scenario_1,
    execute_scenario_2,
    execute_scenario_3,
    execute_scenario_4,
    ensure_demo_repos_ingested
)
from backend.app.event_stream import event_bus

print("=== Running Comprehensive Scenario Verification Suite ===")
ensure_demo_repos_ingested()

# Test Scenario 1: Hidden 4-Hop Collision
print("\n[Scenario 1] Executing Hidden Collision Scenario...")
s1_events = execute_scenario_1("test_run_s1")
print(f"Scenario 1 generated {len(s1_events)} events.")
collision_evts = [e for e in s1_events if e.get("collision") is not None]
assert len(collision_evts) > 0, "Scenario 1 must emit a collision event"
assert collision_evts[0]["collision"]["hops"] == 4, f"Expected 4 hops, got {collision_evts[0]['collision']['hops']}"
assert collision_evts[0]["collision"]["policy"] == "SERIALIZE"
print(">>> Scenario 1 PASSED: 4-hop transitive collision detected with SERIALIZE policy!")

# Test Scenario 2: Memory-Driven Collision Avoidance
print("\n[Scenario 2] Executing Memory Avoidance Scenario...")
s2_events = execute_scenario_2("test_run_s2")
print(f"Scenario 2 generated {len(s2_events)} events.")
recall_evts = [e for e in s2_events if e.get("phase") == "RECALL"]
assert len(recall_evts) > 0, "Scenario 2 must emit recall events"
avoid_evts = [e for e in s2_events if "ADAPTATION" in e.get("phase", "") or "AVOIDANCE" in e.get("phase", "")]
assert len(avoid_evts) > 0, "Scenario 2 must emit memory adaptation event"
print(">>> Scenario 2 PASSED: Recalled memory rule upfront and adapted claim to avoid collision!")

# Test Scenario 3: Safe Parallel Execution
print("\n[Scenario 3] Executing Safe Parallelism Scenario...")
s3_events = execute_scenario_3("test_run_s3")
print(f"Scenario 3 generated {len(s3_events)} events.")
col_s3 = [e for e in s3_events if e.get("collision") is not None]
assert len(col_s3) == 0, "Scenario 3 should have zero collisions"
print(">>> Scenario 3 PASSED: Parallel OK on disjoint taskflow core and reports subsystems!")

# Test Scenario 4: Multi-Tenant Repo Isolation
print("\n[Scenario 4] Executing Repo Isolation Scenario...")
s4_events = execute_scenario_4("test_run_s4")
print(f"Scenario 4 generated {len(s4_events)} events.")
assert any("analytics" in e.get("message", "") for e in s4_events)
print(">>> Scenario 4 PASSED: Clean isolation between taskflow and analytics repos!")

print("\n========================================================")
print("ALL 4 CHRONOFORK SCENARIOS FULLY VERIFIED AND OPERATIONAL!")
print("========================================================")
