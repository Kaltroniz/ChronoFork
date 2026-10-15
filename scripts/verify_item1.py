import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.scenario_runner import execute_scenario_1

events = execute_scenario_1("test_sc1_verification")
print(f"Total events emitted: {len(events)}")

git_events = [e for e in events if e.get("tool") == "git_merge"]
if git_events:
    ge = git_events[0]["execution_data"]
    print(f"Git Merge Pytest: failed={ge.get('pytest_failed')} passed={ge.get('pytest_passed')} duration={ge.get('duration_seconds')}s")

impact_events = [e for e in events if e.get("tool") == "get_impact"]
if impact_events:
    callers = [c["qualname"] for c in impact_events[0]["execution_data"]["dependent_callers"]]
    print(f"Impact Event Callers: {callers}")

verifier_events = [e for e in events if e.get("tool") == "run_pytest"]
if verifier_events:
    ve = verifier_events[0]["execution_data"]
    print(f"Verifier Pytest: passed={ve.get('passed_count')} failed={ve.get('failed_count')} duration={ve.get('duration_seconds')}s")
    print(f"Verifier Message: {verifier_events[0]['message']}")
