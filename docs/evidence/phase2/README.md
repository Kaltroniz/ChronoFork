# Phase 2 & Phase 1b Evidence Pack

This directory contains the machine-verifiable execution logs, test outputs, and real FalkorDB query results for **Phase 2 (Backend Truth + Live Mode)** and **Phase 1b (Frontend Corrections & Media Assertions)**.

---

## 1. Files in this Directory

- **`migration_sandbox_log.txt`**: Execution log of `scripts/test_migration_sandbox.py` using repo-relative `demo_repo/taskflow` and `sys.executable -m pytest`.
  - Returncode: 0
  - Passed count: 12
  - Failed count: 0

- **`falkordb_benchmarks_and_queries.txt`**: FalkorDB queries, control path-existence queries (no intent filter), S3 neighborhood disjointness assertion, and latencies measured across 20 runs each on `repo:taskflow` (69 symbols / 29 CALLS / 16 TESTED_BY).
  - `graph.copy`: min=55.408ms, median=108.317ms, max=112.076ms
  - `pageRank`: min=1.200ms, median=1.359ms, max=1.985ms
  - `betweenness`: min=1.389ms, median=1.801ms, max=2.600ms
  - `collision query`: min=0.609ms, median=0.756ms, max=2.435ms
  - S1 pair path query: 1 row (4 hops)
  - S2 pair path query: 1 row (path exists, but intent is BODY_EDIT -> 0 breaking collisions)
  - S3 pair path query: 0 rows (disjoint subgraphs)
  - S3 Neighborhood intersection: [] (0 symbols)

- **`memory_state_label_test.txt`**: Playwright test asserting memory label transitions across Reset and S1 replay:
  - After Reset: `"ABSENT (hidden because memoryWasReset is true)"`
  - After S1 Replay: `"Memory state: carried over from previous runs"`

- **`ui_shots_assertions.txt`**: Playwright assertions for UI layout, hero card clearance, bounding-box non-overlap, font size clamping (13-16px), and video generation timings.
  - Screenshots: `docs/screens/01-idle.png` through `09-focus-view-4hop.png`
  - Videos: `docs/screens/scenario1.webm` (16.0s), `docs/screens/scenario2.webm` (12.0s), `docs/screens/scenario3.webm` (12.0s)
