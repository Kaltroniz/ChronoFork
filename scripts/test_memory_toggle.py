"""Verification test for Scenario 2 Memory ON/OFF Toggle via FastAPI."""
import urllib.request
import json

def run_s2(memory_enabled: bool):
    req = urllib.request.Request(
        'http://localhost:8000/runs',
        data=json.dumps({'scenario': 2, 'mode': 'replay', 'memory_enabled': memory_enabled}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    res = urllib.request.urlopen(req)
    body = json.loads(res.read().decode())
    run_id = body['run_id']
    events_res = urllib.request.urlopen(f'http://localhost:8000/runs/{run_id}/events?delay_ms=0')
    lines = [l for l in events_res.read().decode().splitlines() if l.startswith('data: ')]
    evts = [json.loads(l.replace('data: ', '')) for l in lines]
    return evts

print("--- 1. Testing Scenario 2 with MEMORY ON ---")
evts_on = run_s2(memory_enabled=True)
collisions_on = [e for e in evts_on if e.get('collision') is not None]
avoidance_on = [e for e in evts_on if "ADAPTATION" in e.get("phase", "") or "AVOIDANCE" in e.get("phase", "")]
print(f"Memory ON: {len(avoidance_on)} adaptations, {len(collisions_on)} collisions")
assert len(avoidance_on) > 0, "Memory ON must trigger adaptation"
assert len(collisions_on) == 0, "Memory ON must avoid collisions"
print("PASSED: Memory ON successfully recalled rule and avoided collision!")

print("\n--- 2. Testing Scenario 2 with MEMORY OFF ---")
evts_off = run_s2(memory_enabled=False)
collisions_off = [e for e in evts_off if e.get('collision') is not None]
print(f"Memory OFF: {len(collisions_off)} collisions detected!")
assert len(collisions_off) > 0, "Memory OFF must detect collision when memory is disabled!"
print("PASSED: Memory OFF demonstrates the collision returns when memory is disabled!")

print("\n>>> MEMORY ON/OFF TOGGLE VERIFICATION PASSED WITH FLYING COLORS! <<<")
