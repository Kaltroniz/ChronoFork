"""Regenerates all deterministic replay caches for ChronoFork.

Generates:
  - replays/scenario_1.json
  - replays/scenario_2_mem.json
  - replays/scenario_2.json
  - replays/scenario_3.json
  - replays/scenario_4.json
"""

import os
import sys
import json
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.scenario_runner import (
    execute_scenario_1,
    execute_scenario_2,
    execute_scenario_3,
    execute_scenario_4
)
from backend.app.memory import reset_memory

REPLAYS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "replays"))
os.makedirs(REPLAYS_DIR, exist_ok=True)


def save_replay(filename: str, events: list):
    path = os.path.join(REPLAYS_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2)
    size_kb = round(os.path.getsize(path) / 1024, 1)
    print(f"  [SAVED] {filename} ({len(events)} events, {size_kb} KB)")


def print_scenario_metrics(name: str, events: list):
    risk = None
    for evt in events:
        if evt.get("collision") and evt["collision"].get("risk_score") is not None:
            risk = round(evt["collision"]["risk_score"], 3)
            break
    
    pytest_passed = None
    pytest_failed = None
    pytest_internal_s = None

    for evt in reversed(events):
        data = evt.get("execution_data") or {}
        if "passed_count" in data:
            pytest_passed = data.get("passed_count")
            pytest_failed = data.get("failed_count", 0)
            pytest_internal_s = data.get("duration_seconds")
            break
        elif "pytest_passed" in data:
            pytest_passed = data.get("pytest_passed")
            pytest_failed = data.get("pytest_failed", 0)
            pytest_internal_s = data.get("duration_seconds")
            break

    risk_str = f"{risk:.3f}" if risk is not None else "None"
    pytest_str = f"{pytest_passed} passed, {pytest_failed} failed" if pytest_passed is not None else "N/A"
    sec_str = f"{pytest_internal_s}s" if pytest_internal_s is not None else "N/A"
    
    print(f"\n>>> SCENARIO METRICS [{name}]:")
    print(f"    Risk:                    {risk_str}")
    print(f"    Pytest Passed/Failed:    {pytest_str}")
    print(f"    Pytest-Internal Seconds: {sec_str}")
    print(f"    Event Count:             {len(events)}")


def regenerate_all():
    print("=" * 60)
    print("ChronoFork: Regenerating Scenario Replay Caches")
    print("=" * 60)

    # 1. Reset memory for clean baseline
    reset_memory("taskflow")
    reset_memory("analytics")

    # 2. Scenario 1 (Hidden Collision & Serialization)
    print("\n1. Generating replays/scenario_1.json (Live Execution)...")
    t0 = time.time()
    events_1 = execute_scenario_1("replay_gen_sc1")
    save_replay("scenario_1.json", events_1)
    print(f"     Wall Time: {time.time() - t0:.2f}s")
    print_scenario_metrics("Scenario 1 (Hidden Collision)", events_1)

    # 3. Scenario 2 with Memory (Memory Hit & Adaptation)
    print("\n2. Generating replays/scenario_2_mem.json (Live Execution)...")
    t0 = time.time()
    events_2_mem = execute_scenario_2("replay_gen_sc2_mem", memory_enabled=True)
    save_replay("scenario_2_mem.json", events_2_mem)
    print(f"     Wall Time: {time.time() - t0:.2f}s")
    print_scenario_metrics("Scenario 2 (Memory ON)", events_2_mem)

    # 4. Scenario 2 without Memory (Memory OFF - Collision Re-occurs)
    print("\n3. Generating replays/scenario_2.json (Memory OFF)...")
    t0 = time.time()
    events_2 = execute_scenario_2("replay_gen_sc2_nomem", memory_enabled=False)
    save_replay("scenario_2.json", events_2)
    print(f"     Wall Time: {time.time() - t0:.2f}s")
    print_scenario_metrics("Scenario 2 (Memory OFF)", events_2)

    # 5. Scenario 3 (Safe Parallel Execution)
    print("\n4. Generating replays/scenario_3.json (Live Execution)...")
    t0 = time.time()
    events_3 = execute_scenario_3("replay_gen_sc3")
    save_replay("scenario_3.json", events_3)
    print(f"     Wall Time: {time.time() - t0:.2f}s")
    print_scenario_metrics("Scenario 3 (Safe Parallel)", events_3)

    # 6. Scenario 4 (Repo Isolation)
    print("\n5. Generating replays/scenario_4.json (Live Execution)...")
    t0 = time.time()
    events_4 = execute_scenario_4("replay_gen_sc4")
    save_replay("scenario_4.json", events_4)
    print(f"     Wall Time: {time.time() - t0:.2f}s")
    print_scenario_metrics("Scenario 4 (Repo Isolation)", events_4)

    print("\n" + "=" * 60)
    print("ALL REPLAY CACHES SUCCESSFULLY GENERATED!")
    print("=" * 60)


if __name__ == "__main__":
    regenerate_all()
