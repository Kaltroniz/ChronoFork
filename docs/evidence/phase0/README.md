# Phase 0 Audit Evidence Pack

> **Execution Date**: 2026-10-17  
> **Host Environment**: macOS (Darwin 24.3.0, arm64)  
> **Python Version**: Python 3.11.17 (`/opt/homebrew/bin/python3.11`, `.venv/bin/python`)  
> **FalkorDB Version**: v4.22.1 (`ver: 42201`) on Redis 8.10.2 via Docker (`falkordb/falkordb:latest`)

---

## 1. Scripts Run & Stdout Logs

| Log File | Description | Observed Exit Code / Result |
|---|---|---|
| [`verify_phase0_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/verify_phase0_stdout.txt) | FalkorDB syntax verification & performance benchmarks on 10-node toy graph | Exit 0. PageRank: 3.84ms, Betweenness: 2.21ms, Copy: 105.46ms. |
| [`pytest_taskflow_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/pytest_taskflow_stdout.txt) | Native Pytest on baseline `demo_repo/taskflow/tests` | Exit 0. 12 passed in 0.03s. |
| [`pytest_analytics_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/pytest_analytics_stdout.txt) | Native Pytest on baseline `demo_repo/analytics/tests` | Exit 0. 2 passed in 0.00s. |
| [`verify_item1_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/verify_item1_stdout.txt) | Naive Git merge vs ChronoFork verifier comparison | Exit 0. Naive Git: 5 FAILED, 7 PASSED (0.17s). Verifier: 12 PASSED (0.12s). |
| [`verify_item3_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/verify_item3_stdout.txt) | Query trace isolation across all 14 swarm events | Exit 0. All 14 traces isolated per tool. |
| [`verify_item4_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/verify_item4_stdout.txt) | Replay cache latency & SSE stream verification | Exit 0. Replay latency: 7.7ms; 15 event lines streamed. |
| [`verify_item8_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/verify_item8_stdout.txt) | Real isolated workspace pytest execution | Exit 0. 12 passed in 0.13s in `/tmp/chronofork_ws_*`. |
| [`verify_item9_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/verify_item9_stdout.txt) | DEMO_MODE restriction validation | Exit 0. POST /repos returned 403; POST /runs served cache. |
| [`verify_scenarios_2_3_4_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/verify_scenarios_2_3_4_stdout.txt) | Coordinator execution of scenarios 2, 3, 4 | Exit 0. S2: rule recalled, S3: 12 passed, S4: 1 passed. |
| [`test_p1_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/test_p1_stdout.txt) | AST parsing, 4-hop chain resolution, risk scoring | Exit 0. 69 symbols, 29 CALLS, 16 TESTED_BY. |
| [`test_p2_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/test_p2_stdout.txt) | Collision detection & speculative fork simulation | Exit 0. S1: 4-hop collision found; S3: 0 collisions. |
| [`test_p3_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/test_p3_stdout.txt) | Episodic memory record, confidence update, upfront recall | Exit 0. Confidence 0.80 -> 0.90; recalled upfront with 90%. |
| [`test_p4_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/test_p4_stdout.txt) | FastMCP tools in-process & FastAPI SSE replay | Exit 0. MCP tools pass; 14 events streamed. |
| [`test_p6_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/test_p6_stdout.txt) | Real isolated workspace patches & verification | Exit 0. Baseline pytest passes; patch applied; 12 passed. |
| [`test_all_scenarios_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/test_all_scenarios_stdout.txt) | End-to-end execution of all 4 scenarios | Exit 0. All 4 scenarios passed. |
| [`test_api_execution_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/test_api_execution_stdout.txt) | HTTP integration test against live FastAPI `/runs` | Exit 0. Git 5 failed / 7 passed; ChronoFork 12 passed. |
| [`test_memory_toggle_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/test_memory_toggle_stdout.txt) | HTTP test of Scenario 2 with MEMORY ON vs OFF | Exit 0. Memory ON: 0 collisions; Memory OFF: 1 collision returned. |
| [`test_migration_sandbox_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase0/test_migration_sandbox_stdout.txt) | Migration sandbox test | **Exit 1** (FileNotFoundError on hardcoded WSL path `/mnt/c/Users/Acer/...`). |

---

## 2. Key Audit Observations

1. **FalkorDB Native Algorithms**:
   - `algo.pageRank` requires exactly 2 string arguments (`nodeLabel`, `relationshipType`). Calling it without arguments fails with `ResponseError: Procedure algo.pageRank requires 2 arguments, got 0`.
   - `algo.betweenness` succeeds with map syntax `{nodeLabels: ['Symbol'], relationshipTypes: ['CALLS'], samplingSize: 32, samplingSeed: 42}`.
   - `graph.copy` raises `ResponseError: destination key already exists` if the target graph key already exists.
   - `shortestPath` cannot be used in a bare `MATCH ... shortestPath(...)` clause; must be in `WITH` or `RETURN`.
2. **Hardcoded Placeholder Bug in Frontend**:
   - `frontend/src/components/ResultStrip.tsx` lines 332 and 403 hardcode `— PASSED` for Git and `— FAILED` for ChronoFork when awaiting event data.
3. **Intent Filter vs Subgraph Disjointness**:
   - The collision Cypher query requires `c1.intent IN ['SIGNATURE_CHANGE', 'DELETE']`.
   - In Scenario 2 (with memory) and Scenario 3, claims use `BODY_EDIT`. The intent filter alone produces 0 rows, which does not prove topological disjointness in Scenario 2.
