# ChronoFork Handoff Status & Phase Audit

> **Branch**: `SS1`  
> **Timestamp**: 2026-10-17T13:58:00+05:30  
> **Target Track**: Graph Hacks (FalkorDB) - Track 1 (Agents on Connected Data) & Track 2 (Memory & Coordination)

---

## 1. System Architecture Map (File $\to$ Purpose)

### Backend (`backend/app/`)
| File | Purpose |
|---|---|
| [`main.py`](file:///Users/souhardya/ChronoFork/backend/app/main.py) | FastAPI service exposing REST and SSE streaming endpoints (`/runs`, `/runs/{id}/events`, `/graph/{name}`, `/memory/{repo}`, `/repos`, `/health`). |
| [`coordinator.py`](file:///Users/souhardya/ChronoFork/backend/app/coordinator.py) | Swarm coordination, openCypher multi-hop collision detection, topological callee-first merge ordering, handoffs, and speculative graph forking (`fork:<run_id>:<agent_id>`). |
| [`algorithms.py`](file:///Users/souhardya/ChronoFork/backend/app/algorithms.py) | Native FalkorDB graph algorithms (`CALL algo.pageRank`, `CALL algo.betweenness`), unified risk scoring, and reverse-CALLS transitive impact analysis. |
| [`parser.py`](file:///Users/souhardya/ChronoFork/backend/app/parser.py) | Python AST parser generating import-aware code graphs (`:Symbol:Module`, `:Symbol:Class`, `:Symbol:Function`, `:Symbol:Test`) and relationships (`DEFINES`, `IMPORTS`, `CALLS`, `TESTED_BY`). |
| [`memory.py`](file:///Users/souhardya/ChronoFork/backend/app/memory.py) | Episodic and procedural memory management in `mem:<repo>`, managing `:Episode` and `:ProceduralRule` nodes with heuristic confidence clamping `[0.10, 0.99]`. |
| [`scenario_runner.py`](file:///Users/souhardya/ChronoFork/backend/app/scenario_runner.py) | Deterministic and live orchestrator for Scenarios 1–4, driving isolated git merge experiments, coder patch applications, and verifier pytest runs. |
| [`mcp_tools.py`](file:///Users/souhardya/ChronoFork/backend/app/mcp_tools.py) | FastMCP tool server and in-process interface exposing 7 native tools (`get_impact`, `rank_risk`, `claim_symbols`, `detect_collisions`, `recall_memory`, `fork_graph`, `record_episode`). |
| [`event_stream.py`](file:///Users/souhardya/ChronoFork/backend/app/event_stream.py) | In-memory SSE event bus with index-buffered replay and pacing via `delay_ms`. |
| [`falkor_client.py`](file:///Users/souhardya/ChronoFork/backend/app/falkor_client.py) | Redis/FalkorDB connection management, query execution timing, and graph lifecycle operations. |
| [`agents/coder.py`](file:///Users/souhardya/ChronoFork/backend/app/agents/coder.py) | Real workspace isolation (`WorkspaceManager`), automated pytest runner (`Verifier`), and the naive git merge experiment sandbox (`run_naive_git_merge_experiment`). |
| [`agents/llm.py`](file:///Users/souhardya/ChronoFork/backend/app/agents/llm.py) | LLM patch generator supporting Gemini API with deterministic fallback. |

### Frontend (`frontend/src/`)
| File | Purpose |
|---|---|
| [`App.tsx`](file:///Users/souhardya/ChronoFork/frontend/src/App.tsx) | Master console state, SSE stream listener, scenario switcher, playback pacing, and drawer controls. |
| [`components/GraphCanvas.tsx`](file:///Users/souhardya/ChronoFork/frontend/src/components/GraphCanvas.tsx) | Cytoscape.js interactive canvas rendering code AST, compound module clusters, agent claim rings, collision chains, and handoffs. |
| [`components/HeroSplit.tsx`](file:///Users/souhardya/ChronoFork/frontend/src/components/HeroSplit.tsx) | Comparison card contrasting Naive Git 0-conflict clean merge vs ChronoFork 4-hop transitive collision detection. |
| [`components/ResultStrip.tsx`](file:///Users/souhardya/ChronoFork/frontend/src/components/ResultStrip.tsx) | Bottom telemetry drawer with tabs for Verdict, Fork Diff, Memory Drawer, and Merge Receipt. |
| [`components/ZeroPathProof.tsx`](file:///Users/souhardya/ChronoFork/frontend/src/components/ZeroPathProof.tsx) | Zero-path proof card showing graph traversal results between claimed symbols. |
| [`components/QueryInspector.tsx`](file:///Users/souhardya/ChronoFork/frontend/src/components/QueryInspector.tsx) | Live Cypher query inspector displaying exact Cypher text, parameters, and query execution times. |
| [`components/AgentTimeline.tsx`](file:///Users/souhardya/ChronoFork/frontend/src/components/AgentTimeline.tsx) | Chronological swarm event timeline with phase indicators and tool call chips. |
| [`components/ProvenanceStrip.tsx`](file:///Users/souhardya/ChronoFork/frontend/src/components/ProvenanceStrip.tsx) | Data provenance indicators (`GRAPH`, `GIT`, `PYTEST`, `LLM` as REAL vs CACHED). |

---

## 2. Graph Schema: AS IMPLEMENTED vs AS CLAIMED

### Implemented Schema in Code
1. **`repo:<name>` (Code Graph)**:
   - Node Labels: `:Symbol` base label plus exactly one of `:Module`, `:Class`, `:Function`, or `:Test`.
   - Node Properties: `name` (str), `qualname` (str), `path` (str), `lineno` (int), `signature_hash` (str).
   - Relationship Types:
     - `(:Symbol:Module)-[:DEFINES]->(:Symbol)`
     - `(:Symbol:Module)-[:IMPORTS]->(:Symbol)`
     - `(:Symbol)-[:CALLS]->(:Symbol)`
     - `(:Symbol)-[:TESTED_BY]->(:Symbol:Test)`
2. **`coord:<run_id>` (Coordination Graph)**:
   - Cloned via `GRAPH.COPY repo:<name> coord:<run_id>`.
   - Node Labels: `:Run` (`id`, `task`, `status`, `created_at`), `:Agent` (`id`, `name`, `role`, `color`).
   - Relationship Types:
     - `(:Run)-[:HAS_AGENT]->(:Agent)`
     - `(:Agent)-[:CLAIMS {intent, subtask, claimed_at}]->(:Symbol)` *(Claims are EDGES, not nodes)*
     - `(:Agent)-[:COLLIDES_WITH {hops, policy, path_nodes, reason}]->(:Agent)`
     - `(:Agent)-[:BLOCKED_BY {target_symbol, risk_score, hops}]->(:Agent)`
     - `(:Agent)-[:HANDED_OFF_TO {timestamp, reason}]->(:Agent)`
3. **`fork:<run_id>:<agent_id>` (Speculative Fork)**:
   - Cloned via `GRAPH.COPY repo:<name> fork:<run_id>:<agent_id>` for blast-radius calculation.
4. **`mem:<repo>` (Memory Graph)**:
   - Node Labels:
     - `:Episode` (`id`, `run_id`, `task`, `outcome`, `summary`, `timestamp`)
     - `:ProceduralRule` (`id`, `rule`, `advice`, `recommended_intent`, `confidence`, `samples`, `created_at`, `updated_at`)
     - `:Symbol` (`qualname`)
   - Relationship Types:
     - `(:Episode)-[:INVOLVED]->(:Symbol)`
     - `(:ProceduralRule)-[:INVOLVED]->(:Symbol)`
     - `(:Episode)-[:LEARNED_RULE]->(:ProceduralRule)`

### Discrepancies Flagged (Claimed in Docs vs Code Reality)
- ❌ **`:Subtask` Nodes**: Mentioned in README diagrams; in actual code, `subtask` is solely a string property on `[:CLAIMS]` edges.
- ❌ **`:SemanticFact` Nodes**: Mentioned in early planning/docs; does NOT exist in code.
- ❌ **`OCCURRED_AFTER` Edges**: Mentioned in design docs; does NOT exist in code (episodes use timestamps).
- ❌ **`:Claim` or `:AgentClaim` Nodes**: Mentioned in prompt context; in actual code, claims are strictly **EDGES** (`[:CLAIMS]`).
- ❌ **`DEPENDS_ON` Edges**: Mentioned in generic docs; code exclusively uses `CALLS` edges between symbols.

---

## 3. How to Run & Prerequisites

### Prerequisites
- Docker (for FalkorDB container)
- Python 3.11 (`.venv/bin/python`)
- Node.js 18+ (for frontend)

### Running Services
1. **Start FalkorDB**:
   ```bash
   docker compose up -d falkordb
   ```
2. **Start Backend**:
   ```bash
   source .venv/bin/activate
   export PYTHONPATH=.
   uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
   ```
3. **Start Frontend**:
   ```bash
   cd frontend && npm run dev
   ```

---

## 4. Scripts Inventory & Verification Matrix

| Script | Purpose | Status in Audit | Observed Output / Exit Code |
|---|---|---|---|
| `scripts/verify_phase0.py` | Validates FalkorDB syntax, copy, PageRank, betweenness, paths | PASS | Exit 0. Toy graph 10 nodes, 9 rels. PageRank: 3.84ms. Betweenness: 2.21ms. |
| `scripts/verify_item1.py` | Validates real git failure vs verifier serialized pass | PASS | Exit 0. Naive Git Pytest: 5 failed, 7 passed (0.17s). Verifier: 12 passed (0.12s). |
| `scripts/verify_item3.py` | Asserts Cypher query traces are isolated per tool | PASS | Exit 0. All 14 traces verified and matching expected query templates. |
| `scripts/verify_item4.py` | Tests replay mode caching and SSE event streaming | PASS | Exit 0. Streamed 15 event lines; replay cache latency: 7.7ms. |
| `scripts/verify_item8.py` | Verifies real pytest execution in isolated workspace copies | PASS | Exit 0. Real pytest in temp workspace: 12 passed in 0.13s. |
| `scripts/verify_item9.py` | Verifies DEMO_MODE safety (403 on /repos, forced replay on /runs) | PASS | Exit 0. 403 returned on /repos; replay cached on /runs. |
| `scripts/verify_scenarios_2_3_4.py`| Validates scenarios 2 (memory hit), 3 (safe parallel), 4 (analytics repo) | PASS | Exit 0. S2 adapted rule, S3 12 passed, S4 1 passed. |
| `scripts/test_p1.py` | Ingestion of taskflow, 4-hop chain resolution, centrality rankings | PASS | Exit 0. 69 symbols, 29 CALLS, 16 TESTED_BY. validate_token risk: 0.8561. |
| `scripts/test_p2.py` | Collision detection & speculative fork acceptance | PASS | Exit 0. 4-hop collision found; S3 reports 0 collisions. |
| `scripts/test_p3.py` | Episodic memory record, confidence rise (+0.10), upfront recall | PASS | Exit 0. Confidence 0.80 -> 0.90; recalled upfront with 90%. |
| `scripts/test_p4.py` | FastMCP in-process tools and FastAPI SSE replay | PASS | Exit 0. 14 events streamed, health 200, MCP tools pass. |
| `scripts/test_p6.py` | Real isolated workspace manager and verifier | PASS | Exit 0. 12 passed in workspace copy. |
| `scripts/test_all_scenarios.py` | Executes all 4 scenarios end-to-end | PASS | Exit 0. All 4 scenarios generated expected events and passed. |
| `scripts/test_api_execution.py` | HTTP end-to-end against live backend `/runs` | PASS | Exit 0. Git 5 failed / 7 passed; ChronoFork 12 passed / 0 failed. |
| `scripts/test_memory_toggle.py` | HTTP test of Scenario 2 with MEMORY ON vs OFF | PASS | Exit 0. Memory ON: 0 collisions; Memory OFF: 1 collision returned. |
| `scripts/test_migration_sandbox.py`| Migration sandbox test | PASS (FIXED) | Exit 0. Returncode: 0, Passed count: 12, Failed count: 0 (repo-relative path). |
| `scripts/regenerate_replays.py` | Re-executes scenarios live and rewrites replays/*.json | PASS | Exit 0. Regenerated scenario_1.json, scenario_2_mem.json, scenario_2.json, scenario_3.json, scenario_4.json with full provenance. |

---

## 5. Phase 0 Audit Findings

### Done (with Evidence Path)
- **FalkorDB Syntax & Latency Benchmarks**: `docs/evidence/phase0/verify_phase0_stdout.txt`
  - FalkorDB server module version: `42201` (v4.22.1) running on Redis `8.10.2` (Linux aarch64).
  - `graph.copy`: 105.46 ms on 10-node graph. Failed with `destination key already exists` when target pre-exists.
  - `CALL algo.pageRank('Symbol', 'CALLS')`: 3.84 ms on 10-node graph (sums to 1.0). Requires exactly 2 arguments.
  - `CALL algo.betweenness({...})`: 2.21 ms on 10-node graph with map syntax.
  - `shortestPath`: Requires `WITH` or `RETURN` clause; 2.02 ms.
  - Variable-length path `CALLS*1..4`: 1.41 ms (8 paths found on toy graph).
- **Test Suite Results**:
  - `demo_repo/taskflow/tests`: 12 passed in 0.03s (`docs/evidence/phase0/pytest_taskflow_stdout.txt`).
  - `demo_repo/analytics/tests`: 2 passed in 0.00s (`docs/evidence/phase0/pytest_analytics_stdout.txt`).
  - Naive Git merge experiment: 5 FAILED / 7 PASSED (`docs/evidence/phase0/test_api_execution_stdout.txt`).
  - Coordinated serialized run: 12 PASSED / 0 FAILED (`docs/evidence/phase0/test_api_execution_stdout.txt`).
- **Git State**:
  - Active branch: `SS1` (tracking `origin/SS1`).
  - Working tree clean except `docs/evidence/` and `docs/HANDOFF_STATUS.md`.
  - Head commit: `c9f178d`.
- **Replay mtimes vs Backend Commit Date**:
  - Replay files commit: `fbb67cb` (2026-10-16 06:05:20 +0530).
  - Last backend commit: `2032d9b` (2026-10-16 05:29:31 +0530).
  - Replays commit is 35 minutes newer than backend code.

### Partial
- **Reset Demo Behavior**:
  - Backend resets `mem:taskflow` completely (rules count = 0, episodes = 0).
  - Frontend toggles both bind to `memoryEnabled`, but `memoryWasReset` flag never resets to `false` when Scenario 1 is re-run, causing "Memory state: carried over" to stay hidden forever until browser reload.

### Not Done (Reserved for Later Phases)
- Code changes in `frontend/` (Phase 1).
- Backend replay regeneration with provenance fields and path-existence query (Phase 2).
- Detection benchmark suite (Phase 3).

### Known Bugs Fixed
1. **Hardcoded WSL path in `scripts/test_migration_sandbox.py`**:
   - **STATUS**: FIXED (Phase 2).
   - Changed WSL path `/mnt/c/Users/Acer/...` to repo-relative `demo_repo/taskflow`, and changed pytest execution to `sys.executable -m pytest`.
   - Verified assertion: Returncode 0, Passed count 12, Failed count 0 (`docs/evidence/phase2/migration_sandbox_log.txt`).
2. **ResultStrip Verdict Placeholder Bug**:
   - **STATUS**: FIXED (Phase 1). Neutral `PENDING` and `Not run in this scenario` rendered.
3. **GraphCanvas Fallback Symbol Hardcoding**:
   - **STATUS**: FIXED (Phase 1). All 9 hard-coded fallback occurrences removed; renders nothing when event claims are missing.
4. **Permanent `memoryWasReset` in Frontend**:
   - **STATUS**: FIXED (Phase 1). `setMemoryWasReset(false)` fires on `MEMORY_UPDATE` and memory writes, restoring the "carried over" label.
5. **Coder `pytest_cmd` Search Path**:
   - **STATUS**: FIXED (Phase 2).
   - In `backend/app/agents/coder.py`, pytest command now invokes `sys.executable -m pytest` with isolated `sys` import.

---

## 6. Phase 1 Frontend Corrections Findings

### Done (with Evidence Path: `docs/evidence/phase1/`)
- **Single Source of Truth (`replays/`)**:
  - Deleted duplicate fixture file `frontend/src/fixtures/scenario_1.json` (Commit `a6de138`).
  - Removed dev fallback in `frontend/src/App.tsx`; the console strictly consumes backend SSE streams from `replays/`.
- **Zero Hard-Coded Results**:
  - `git grep` verified 0 hits for `12 PASSED`, `5 FAILED`, `1.39`, and `taskflow.` fallback strings across `frontend/src/`.
- **GraphCanvas.tsx Fallback Strings Removed**:
  - All 9 fallback occurrences removed. If a node/claim is missing, it renders nothing.
  - Compound module label font size constrained to 15px (within 13px - 16px constraint).
  - Explicit legend swatches added for A2 (`#E0A458`) and A3 (`#4FB286`) in Scenario 3.
- **Verdict & ZeroPath Proof Placeholders Fixed**:
  - Before test data arrives, displays neutral `PENDING`.
  - For Scenarios 2 and 3 in the Git column, displays `Not run in this scenario`.
  - ChronoFork column never displays `FAILED` beside a SAFE card.
  - Scenario 2 card text updated to: `"memory changed A1's claim to BODY_EDIT; the breaking-intent query returned 0 rows"`.
  - Intent-filtered query card footer updated to: `"no breaking-intent claim reaches another claim · Parallel execution authorized"`.
- **Provenance & Badges**:
  - Derived strictly from `event.provenance`. If missing, renders `UNLABELLED`.
  - LLM badge hidden unless `activeEvent.provenance.llm` is defined.
  - Receipt capture timestamp formatted with date and timezone via `toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium', timeZoneName: 'short' })`.
- **Memory Reset State Progression**:
  - Verified live sequence `Reset -> Run S1 -> Label State` (`docs/evidence/phase1/reset_run_s1_sequence_stdout.txt`).
- **Playwright State-Assertion Code Embedded**:
  - Embedded and executed in `scripts/ui_shots.ts`.

---

## 7. Phase 2 & Phase 1b Verification Findings

### Done (with Evidence Path: `docs/evidence/phase2/`)

#### Phase 2: Backend Truth, Real Queries & Benchmarks
- **Hygiene & Live Replay Protection**:
  - `git show --stat HEAD~3..HEAD` confirmed zero tracking of `.venv`, `node_modules`, `dist`, or `__pycache__`.
  - Updated `backend/app/main.py:141-146`: Live runs write strictly to `replays/live_{run_id}.json`. Canonical `replays/scenario_N.json` are written only by `scripts/regenerate_replays.py`.
- **FalkorDB Real Query Event Fields**:
  - `CLAIM` events: `agent_id`, `agent_name`, `symbol` qualname, and `intent` returned directly from Cypher query.
  - `FORK` event: `blast_radius` queried via `MATCH path = (caller:Symbol)-[:CALLS*1..4]->(target:Symbol {qualname: $qname}) RETURN DISTINCT caller.qualname AS caller_qname, length(path) AS depth ORDER BY depth ASC` (7 callers within <= 4 hops + claimed symbol = 8 nodes).
  - `S3 DETECT` event: Neighborhoods `neighborhood_a2` (13 symbols) and `neighborhood_a3` (9 symbols) queried via undirected `<=4`-hop CALLS traversal. Machine assertion confirmed: `intersection count: 0` (empty set).
  - `COLLISION` event: Path query returns `path_nodes` (5 nodes), `hops: 4`, `risk_score: 0.8250` (4 decimals), and full `risk_inputs` breakdown (`pagerank: 0.0561`, `betweenness: 26.0`, `max_pagerank: 0.0561`, `max_betweenness: 40.0`, `norm_pagerank: 1.0`, `norm_betweenness: 0.65`, formula: `"0.5 * (PR/max_PR) + 0.5 * (BW/max_BW)"`).
- **Risk Mismatch Explanation**:
  - Algorithm used: Max-normalization in `backend/app/algorithms.py:53-56`.
  - Computed values on `repo:taskflow`:
    - `taskflow.config.load_config`: Raw PR: 0.056058, Raw BW: 26.0 $\to$ Norm PR: 1.0000, Norm BW: 0.6500 $\to$ Risk = $0.5(1.0) + 0.5(0.65) = \mathbf{0.8250}$.
    - `taskflow.auth.validate_token`: Raw PR: 0.039920, Raw BW: 40.0 $\to$ Norm PR: 0.7121, Norm BW: 1.0000 $\to$ Risk = $0.5(0.7121) + 0.5(1.0) = \mathbf{0.8561}$.
  - The old replay hardcoded/typed `0.85` from an approximation of `validate_token`. All event messages and UI displays are now formatted dynamically from the numeric field `{risk_score:.4f}`.
- **Path-Existence Control Queries (No Intent Filter)**:
  - S1 Pair (`worker.execute_job` $\to$ `config.load_config`): **1 row** (4 hops).
  - S2 Pair (`worker.execute_job` $\to$ `config.load_config`): **1 row** (path exists, but intent is `BODY_EDIT` $\to$ 0 breaking collisions).
  - S3 Pair (`worker.execute_job` $\leftrightarrow$ `reports.generator.generate_summary`): **0 rows** (disjoint subgraphs).
- **Provenance per Event**:
  - Every event carries `{graph, git, pytest}` each with `{source: 'REAL', captured_at: ISO-8601}`.
  - `llm` key is present **ONLY** if an LLM produced output; deterministic events omit the key.
- **FalkorDB Latencies on `repo:taskflow` (69 symbols, 29 CALLS, 16 TESTED_BY)**:
  - `graph.copy` (20 runs): min=55.408ms, median=108.317ms, max=112.076ms
  - `pageRank` (20 runs): min=1.200ms, median=1.359ms, max=1.985ms
  - `betweenness` (20 runs): min=1.389ms, median=1.801ms, max=2.600ms
  - `collision query` (20 runs): min=0.609ms, median=0.756ms, max=2.435ms

#### Phase 1b: Frontend Corrections, Bounding Box Clearance & Media
- **Hero Card Height & Overlap Clearance (Playwright Verified)**:
  - Hero card maximum height: `230px` (clamped by `max-h-[230px]`).
  - First-render bounding box non-overlap assertion:
    - Hero box: `[top: 68, bottom: 298]`
    - Chain top: `399`
    - Vertical clearance gap: **101px**
    - Intersect assertion: `false` (PASSED).
- **ZeroPathProof Dynamic Intent**:
  - Derived dynamically from `a1Claim.intent` without scenario-number branching.
- **Reset $\to$ Memory State Progression (Playwright Test `scripts/test_memory_state_label.ts`)**:
  - Observed Value 1 (After Reset): `null` (element absent from DOM because `memoryWasReset === true`)
  - Observed Value 2 (After S1 Replay): `"Memory state: carried over from previous runs"`
  - Code line: `const labelAfterReset = await page.evaluate(() => document.querySelector('[data-testid="memory-state-indicator"]')?.textContent ?? null);`
  - Exit code 0 (`docs/evidence/phase2/memory_state_label_test.txt`).
- **Cytoscape Label Legibility & Idle Clearance**:
  - Idle state: 0 intersections across 24 visible labels. Font size clamped between 13.00px and 16.00px.
  - Focus state: 0 intersections across 13 visible labels.
- **Fail-Loudly Verification (Container Stop & Restart)**:
  - When FalkorDB container stopped:
    - `POST /runs` (live mode) $\to$ Status: **503**, Body: `{"detail":"Live run execution failed (FalkorDB connection refused or offline): Error 61 connecting to 127.0.0.1:6379. Connection refused."}` (No cached fallback).
    - `GET /graph/taskflow` $\to$ Status: **503**, Body: `{"detail":"FalkorDB connection refused or offline: Error 61 connecting to 127.0.0.1:6379. Connection refused."}`
    - `GET /collisions/test_run` $\to$ Status: **503**, Body: `{"detail":"FalkorDB connection refused or offline: Error 61 connecting to 127.0.0.1:6379. Connection refused."}`
  - When FalkorDB container restarted:
    - `GET /health` $\to$ Status: **200**, healthy.
    - `GET /graph/taskflow` $\to$ Status: **200**, recovery confirmed.
- **Video Durations (ffprobe Verified)**:
  - `docs/screens/scenario1.webm`: **17.84s** (stream duration, target $\le 28$s, ends 2.0s after MERGE APPROVED).
  - `docs/screens/scenario2.webm`: **13.60s** (stream duration, target $\sim 12$s).
  - `docs/screens/scenario3.webm`: **13.52s** (stream duration, target $\sim 12$s).
- **Policy Label Verification (UI vs Event)**:
  - Event `collision.policy` field: `"SERIALIZE_CALLEE_FIRST"`
  - UI Pill in Hero card: `"POLICY: SERIALIZE_CALLEE_FIRST"`
  - UI Strip Policy: `"SERIALIZE_CALLEE_FIRST"`
  - UI Query Inspector Policy: `"Policy: SERIALIZE_CALLEE_FIRST"` (Exact 1:1 match).

### Partial (Honest Status)
- **Live LLM Execution Mode**: NOT DONE. The codebase scaffolds Gemini integration via `backend/app/agents/llm.py`, but scenario runner currently relies on verified deterministic fallback patches (`backend/app/scenario_runner.py:251-275`). Live model invocation has not been validated end-to-end with production Gemini API keys.

### Not Done (Reserved for Phase 3)
- **Detection Benchmark Suite**: NOT DONE (`scripts/benchmark_detection.py` across 10+ synthetic collision cases, reserved for Phase 3).

