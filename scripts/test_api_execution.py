"""Verification test for FastAPI Scenario 1 API endpoint with Real Pytest comparison."""
import urllib.request
import json

req = urllib.request.Request(
    'http://localhost:8000/runs',
    data=json.dumps({'scenario': 1, 'mode': 'replay', 'memory_enabled': True}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
res = urllib.request.urlopen(req)
body = json.loads(res.read().decode())
run_id = body['run_id']
print(f"Run {run_id} started successfully!")

events_res = urllib.request.urlopen(f'http://localhost:8000/runs/{run_id}/events?delay_ms=0')
lines = [l for l in events_res.read().decode().splitlines() if l.startswith('data: ')]
print(f"Total events streamed: {len(lines)}")

git_data = None
verifier_data = None

for l in lines:
    evt = json.loads(l.replace('data: ', ''))
    if evt.get('phase') == 'GIT_COMPARISON':
        git_data = evt.get('execution_data')
    elif evt.get('phase') == 'VERIFICATION':
        verifier_data = evt.get('execution_data')

print("\n--- 1. NAIVE GIT MERGE EXPERIMENT RESULTS ---")
print(f"Git Clean Merge: {git_data.get('git_status')} (conflicts: {git_data.get('git_conflicts_count')})")
print(f"Pytest Result: Success={git_data.get('pytest_success')} | Failed={git_data.get('pytest_failed')} | Passed={git_data.get('pytest_passed')}")

print("\n--- 2. CHRONOFORK SERIALIZED EXECUTION RESULTS ---")
print(f"Pytest Result: Success={verifier_data.get('success')} | Failed={verifier_data.get('failed_count')} | Passed={verifier_data.get('passed_count')}")

assert git_data.get('pytest_failed') > 0, "Git merge experiment must fail tests!"
assert verifier_data.get('success') is True, "ChronoFork serialized execution must pass all tests!"
assert verifier_data.get('passed_count') == 12, "All 12 tests must pass in ChronoFork!"
print("\n>>> API SCENARIO 1 END-TO-END VERIFICATION PASSED WITH FLYING COLORS! <<<")
