#!/usr/bin/env python3
"""ChronoFork Phase 7 Final Regression Suite Runner.

Executes all core verification scripts, UI tests, and benchmarks.
Saves complete raw stdout/stderr to docs/evidence/phase7/.
Outputs a summary table with Script, Exit Code, and Observed Assertion Value.
"""

import os
import sys
import subprocess

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EVIDENCE_DIR = os.path.join(WORKSPACE_ROOT, "docs", "evidence", "phase7")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

SCRIPTS = [
    ("verify_item1", ".venv/bin/python scripts/verify_item1.py"),
    ("verify_item3", ".venv/bin/python scripts/verify_item3.py"),
    ("verify_item4", ".venv/bin/python scripts/verify_item4.py"),
    ("verify_item8", ".venv/bin/python scripts/verify_item8.py"),
    ("verify_item9", ".venv/bin/python scripts/verify_item9.py"),
    ("verify_scenarios_2_3_4", ".venv/bin/python scripts/verify_scenarios_2_3_4.py"),
    ("test_p1", ".venv/bin/python scripts/test_p1.py"),
    ("test_p2", ".venv/bin/python scripts/test_p2.py"),
    ("test_p3", ".venv/bin/python scripts/test_p3.py"),
    ("test_p4", ".venv/bin/python scripts/test_p4.py"),
    ("test_p6", ".venv/bin/python scripts/test_p6.py"),
    ("test_all_scenarios", ".venv/bin/python scripts/test_all_scenarios.py"),
    ("test_api_execution", ".venv/bin/python scripts/test_api_execution.py"),
    ("test_memory_toggle", ".venv/bin/python scripts/test_memory_toggle.py"),
    ("benchmark_detection", ".venv/bin/python scripts/benchmark_detection.py"),
    ("run_shots_both_resolutions", "NODE_PATH=./frontend/node_modules node scripts/run_shots_both_resolutions.cjs"),
]


def extract_assertion_value(name: str, stdout: str) -> str:
    lines = [l.strip() for l in stdout.splitlines() if l.strip()]
    if not lines:
        return "No output"

    for l in lines:
        if "ASSERTION PASSED" in l:
            return l[:80]
        if "VERIFIED" in l:
            return l[:80]
        if "PASSED" in l and ("test" in l.lower() or "cases" in l.lower() or "items" in l.lower()):
            return l[:80]
        if "Precision" in l or "Recall" in l:
            return l[:80]
        if "Node Count" in l or "nodes" in l.lower():
            return l[:80]

    # Return last non-empty line
    return lines[-1][:80]


def main():
    print("================================================================================")
    print("PHASE 7 FINAL REGRESSION EXECUTION")
    print("================================================================================\n")

    results = []

    for name, cmd in SCRIPTS:
        print(f"Running {name}...")
        log_file = os.path.join(EVIDENCE_DIR, f"{name}_stdout.txt")

        env = dict(os.environ)
        env["PYTHONPATH"] = WORKSPACE_ROOT

        res = subprocess.run(
            cmd,
            shell=True,
            cwd=WORKSPACE_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env
        )

        with open(log_file, "w", encoding="utf-8") as f:
            f.write(res.stdout)

        val = extract_assertion_value(name, res.stdout)
        results.append((name, res.returncode, val))
        print(f"  -> Exit: {res.returncode} | Assertion: {val}")

    print("\n================================================================================")
    print("SUMMARY TABLE OF REGRESSION RESULTS")
    print("================================================================================\n")
    print("| Script | Exit Code | Observed Assertion Value | Evidence Log |")
    print("|:---|:---:|:---|:---|")
    for name, rc, val in results:
        status_icon = "0 (PASS)" if rc == 0 else f"{rc} (FAIL)"
        clean_val = val.replace("|", "\\|")
        print(f"| `{name}` | {status_icon} | {clean_val} | [`{name}_stdout.txt`]({name}_stdout.txt) |")


if __name__ == "__main__":
    main()
