import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.scenario_runner import execute_scenario_2, execute_scenario_3, execute_scenario_4
from backend.app.memory import reset_memory

# 1. Test Scenario 2 with Cold Start (empty memory)
reset_memory("taskflow")
events_2_cold = execute_scenario_2("test_sc2_cold", memory_enabled=True)
cold_event = [e for e in events_2_cold if "Cold Start" in e.get("message", "")]
print("Scenario 2 Cold Start Event:", cold_event[0]["message"] if cold_event else "NOT FOUND")

# 2. Re-run Scenario 1 to seed rule with recommended_intent
from backend.app.scenario_runner import execute_scenario_1
execute_scenario_1("seed_run_1")

# 3. Test Scenario 2 with Memory Hit and recommended_intent
events_2_mem = execute_scenario_2("test_sc2_mem", memory_enabled=True)
mem_hit = [e for e in events_2_mem if "MEMORY HIT" in e.get("message", "")]
print("Scenario 2 Memory Hit:", mem_hit[0]["message"] if mem_hit else "NOT FOUND")
mem_adapt = [e for e in events_2_mem if e.get("tool") == "adapt_intent"]
print("Scenario 2 Intent Adaptation:", mem_adapt[0]["message"] if mem_adapt else "NOT FOUND")

# 4. Test Scenario 3
events_3 = execute_scenario_3("test_sc3")
ver_3 = [e for e in events_3 if e.get("tool") == "run_pytest"]
print("Scenario 3 Pytest:", ver_3[0]["message"] if ver_3 else "NOT FOUND")

# 5. Test Scenario 4
events_4 = execute_scenario_4("test_sc4")
ver_4 = [e for e in events_4 if e.get("tool") == "run_pytest"]
print("Scenario 4 Pytest:", ver_4[0]["message"] if ver_4 else "NOT FOUND")
