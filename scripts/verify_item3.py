import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.scenario_runner import execute_scenario_1

events = execute_scenario_1("test_trace_isolation")

tools_without_falkor = ["git_merge", "generate_patch", "run_pytest"]
tools_with_falkor = ["recall_memory", "claim_symbols", "fork_graph", "detect_collisions", "apply_policy", "get_impact", "record_handoff", "record_episode"]

no_leakage = True
for e in events:
    tool = e.get("tool")
    trace = e.get("trace")
    if tool in tools_without_falkor:
        if trace is not None:
            print(f"FAILED: Tool {tool} has non-null trace! Leakage detected!")
            no_leakage = False
        else:
            print(f"PASSED: Tool {tool} correctly has trace = None")
    elif tool in tools_with_falkor:
        if trace is None:
            print(f"WARNING: Tool {tool} expected trace but got None")
        else:
            print(f"PASSED: Tool {tool} correctly has trace: {trace.get('cypher', '')[:40]}...")

print("\nItem 3 Status:", "ALL TRACES CORRECTLY ISOLATED" if no_leakage else "LEAKAGE FOUND")
