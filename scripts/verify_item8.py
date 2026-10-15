import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.scenario_runner import execute_scenario_1

# Execute Scenario 1 in live mode
events = execute_scenario_1("test_sc1_live_mode", mode="live")

codegen_events = [e for e in events if e.get("phase") == "CODE_GEN" and e.get("agent") == "ConfigCoder"]
assert len(codegen_events) > 0, "No ConfigCoder CODE_GEN event found!"
print("ConfigCoder Event Message:", codegen_events[0]["message"])
print("ConfigCoder Execution Data:", codegen_events[0]["execution_data"])

verifier_events = [e for e in events if e.get("phase") == "VERIFICATION"]
assert len(verifier_events) > 0, "No VERIFICATION event found!"
print("Verifier Event Message:", verifier_events[0]["message"])
assert verifier_events[0]["execution_data"]["passed_count"] == 12
assert verifier_events[0]["execution_data"]["failed_count"] == 0

print("\nItem 8 Status: VERIFIED & PASSING!")
