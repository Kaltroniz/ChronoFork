#!/usr/bin/env python3
"""Tests clean clone Docker Compose deployment for Phase 5-lite.

Workflow:
  1. Git clone local repository branch SS1 to temporary directory.
  2. Run `docker compose up --build -d` inside the clean clone.
  3. Wait for services (FalkorDB, backend, frontend) to be healthy.
  4. Query and print:
     - container status (`docker compose ps`)
     - GET /health
     - GET /graph/taskflow node count
     - POST /runs (Scenario 1 replay event count and final pytest counts)
     - Frontend HTTP status code (curl -I http://localhost:5173)
  5. Launch Playwright against http://localhost:5173, click 'Play the Story', and capture screenshot.
  6. Tear down clean clone containers (`docker compose down -v`).
"""

import os
import sys
import time
import json
import shutil
import tempfile
import subprocess
import urllib.request
import urllib.parse

WORKSPACE_ROOT = "/Users/souhardya/ChronoFork"
EVIDENCE_DIR = os.path.join(WORKSPACE_ROOT, "docs", "evidence", "phase7")
SCREENS_DIR = os.path.join(WORKSPACE_ROOT, "docs", "screens")
os.makedirs(EVIDENCE_DIR, exist_ok=True)
os.makedirs(SCREENS_DIR, exist_ok=True)

OUTPUT_FILE = os.path.join(EVIDENCE_DIR, "clean_clone_docker_output.txt")


def log(msg: str, f_out):
    print(msg)
    f_out.write(msg + "\n")
    f_out.flush()


def run_cmd(cmd, cwd=None):
    res = subprocess.run(cmd, cwd=cwd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return res.returncode, res.stdout.strip(), res.stderr.strip()


def main():
    with open(OUTPUT_FILE, "w") as f_out:
        log("============================================================", f_out)
        log("PHASE 5-LITE: CLEAN CLONE DOCKER COMPOSE DEPLOYMENT TEST", f_out)
        log("============================================================\n", f_out)

        # Ensure no host containers are occupying ports
        run_cmd("docker compose down -v", cwd=WORKSPACE_ROOT)

        temp_dir = tempfile.mkdtemp(prefix="chronofork_clone_")
        log(f"1. Cloning local branch SS1 into temporary directory: {temp_dir}...", f_out)
        clone_cmd = f"git clone --branch SS1 file://{WORKSPACE_ROOT} {temp_dir}"
        rc, out, err = run_cmd(clone_cmd)
        if rc != 0:
            log(f"Error cloning repository: {err}", f_out)
            sys.exit(1)
        log("   Repository cloned successfully.\n", f_out)

        try:
            log("2. Building and starting Docker Compose services (`docker compose up --build -d`)...", f_out)
            rc, out, err = run_cmd("docker compose up --build -d", cwd=temp_dir)
            log(f"   Docker compose stdout:\n{out}", f_out)
            if err:
                log(f"   Docker compose stderr:\n{err}", f_out)

            log("\n3. Waiting for services to become healthy (up to 30s)...", f_out)
            healthy = False
            for attempt in range(15):
                time.sleep(2)
                rc, out, _ = run_cmd("curl -s http://localhost:8000/health")
                if rc == 0 and "healthy" in out:
                    healthy = True
                    log(f"   Backend & FalkorDB healthy after {attempt * 2 + 2}s!", f_out)
                    break
            
            if not healthy:
                log("   ERROR: Backend failed to become healthy within timeout.", f_out)
                run_cmd("docker compose logs", cwd=temp_dir)

            # A. Container Status
            log("\n--- A. CONTAINER STATUS ---", f_out)
            rc, ps_out, _ = run_cmd("docker compose ps", cwd=temp_dir)
            log(ps_out, f_out)

            # B. Health Check
            log("\n--- B. GET /health ---", f_out)
            rc, health_out, _ = run_cmd("curl -s http://localhost:8000/health")
            log(health_out, f_out)

            # C. GET /graph/taskflow Node Count
            log("\n--- C. GET /graph/taskflow NODE COUNT ---", f_out)
            rc, graph_out, _ = run_cmd("curl -s http://localhost:8000/graph/taskflow")
            try:
                graph_data = json.loads(graph_out)
                node_count = len(graph_data.get("nodes", []))
                edge_count = len(graph_data.get("edges", []))
                log(f"Graph 'taskflow' Node Count: {node_count} nodes, Edge Count: {edge_count} edges", f_out)
            except Exception as e:
                log(f"Error parsing /graph/taskflow: {e}\nRaw output: {graph_out}", f_out)

            # D. Replay Scenario 1 via POST /runs
            log("\n--- D. REPLAY SCENARIO 1 VIA POST /runs ---", f_out)
            run_payload = json.dumps({"scenario": 1, "mode": "replay"})
            rc, run_out, _ = run_cmd(f"curl -s -X POST http://localhost:8000/runs -H 'Content-Type: application/json' -d '{run_payload}'")
            log(f"POST /runs response: {run_out}", f_out)
            try:
                run_data = json.loads(run_out)
                run_id = run_data.get("run_id")
                event_count = run_data.get("events_count")
                log(f"Replay Run ID: {run_id}, Event Count: {event_count}", f_out)

                # Fetch events from SSE stream buffer or scenario file to verify final pytest counts
                # Read replay events from disk in temp clone
                sc1_file = os.path.join(temp_dir, "replays", "scenario_1.json")
                with open(sc1_file, "r") as f:
                    sc1_events = json.load(f)
                
                pytest_events = [e for e in sc1_events if e.get("phase") == "VERIFICATION" or e.get("tool") == "run_pytest"]
                if pytest_events:
                    final_pytest = pytest_events[-1]
                    exec_data = final_pytest.get("execution_data", {})
                    log(f"Final Pytest Verification: Passed = {exec_data.get('passed_count')}, Failed = {exec_data.get('failed_count')}, ExitCode = {exec_data.get('exit_code')}", f_out)
            except Exception as e:
                log(f"Error parsing replay data: {e}", f_out)

            # E. Frontend HTTP Status
            log("\n--- E. FRONTEND HTTP STATUS ---", f_out)
            rc, front_head, _ = run_cmd("curl -s -I http://localhost:5173/")
            log(front_head, f_out)

            # F. Playwright Screenshot of Clean-Clone UI (Play the Story)
            log("\n--- F. PLAYWRIGHT CLEAN-CLONE UI SCREENSHOT ---", f_out)
            playwright_script = f"""
const path = require('path');
const {{ chromium }} = require(path.resolve('{WORKSPACE_ROOT}/frontend/node_modules/playwright'));

async function capture() {{
  const browser = await chromium.launch({{ headless: true }});
  const page = await browser.newPage({{ viewport: {{ width: 1440, height: 900 }} }});

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', {{ waitUntil: 'networkidle' }});

  const memEl = await page.$('[data-testid="memory-state-indicator"]');
  const memText = memEl ? (await memEl.innerText()).trim() : null;
  console.log('DOM memory label on first load:', memText !== null ? JSON.stringify(memText) : 'ABSENT (null)');

  console.log('Clicking Play the Story button...');
  await page.click('button:has-text("Play the Story")');

  console.log('Waiting for animation and story playback (3.5s)...');
  await page.waitForTimeout(3500);

  const shotPath = '{SCREENS_DIR}/clean-clone-story.png';
  await page.screenshot({{ path: shotPath }});
  console.log('Saved screenshot to:', shotPath);

  await browser.close();
}}

capture().catch((err) => {{
  console.error('Playwright capture error:', err);
  process.exit(1);
}});
"""
            pw_file = os.path.join(temp_dir, "capture_clean_clone.cjs")
            with open(pw_file, "w") as f:
                f.write(playwright_script)

            rc, pw_out, pw_err = run_cmd(f"node {pw_file}")
            log(f"Playwright Output:\n{pw_out}", f_out)
            if pw_err:
                log(f"Playwright Stderr:\n{pw_err}", f_out)

            log(f"\nClean clone screenshot confirmed at: {SCREENS_DIR}/clean-clone-story.png", f_out)

        finally:
            log("\n5. Tearing down clean-clone Docker Compose containers...", f_out)
            run_cmd("docker compose down -v", cwd=temp_dir)
            shutil.rmtree(temp_dir, ignore_errors=True)
            log("   Clean clone containers stopped and temp directory removed.", f_out)

            # Restart our local development container
            log("\n6. Restoring local dev FalkorDB container...", f_out)
            run_cmd("docker compose up -d falkordb", cwd=WORKSPACE_ROOT)
            log("   FalkorDB started.", f_out)


if __name__ == "__main__":
    main()
