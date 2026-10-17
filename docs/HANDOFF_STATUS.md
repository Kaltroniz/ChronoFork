# ChronoFork Handoff Status & Phase Audit

> **Branch**: `SS1`  
> **Timestamp**: 2026-10-17T12:46:00+05:30  
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
| [`event_stream.py`](file:///Users/souhardya/ChronoFork/backend/app/event_stream.py) | In-memory SSE event bus with zero-drop buffering and replay pacing via `delay_ms`. |
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
| [`components/ZeroPathProof.tsx`](file:///Users/souhardya/ChronoFork/frontend/src/components/ZeroPathProof.tsx) | Mathematical proof card showing zero-path disjoint graph execution in Scenario 3. |
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
| `scripts/test_migration_sandbox.py`| Migration sandbox test | **FAILED** | Exit 1. Hardcoded WSL path `/mnt/c/Users/Acer/...` causes FileNotFoundError. |
| `scripts/regenerate_replays.py` | Re-executes scenarios live and rewrites replays/*.json | Ready for Phase 2 | Untouched in Phase 0 audit. |

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
  - Head commit: `8ec8f85`.
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

### Known Bugs Found in Audit
1. **Hardcoded WSL path in `scripts/test_migration_sandbox.py`**:
   Line 4 contains `/mnt/c/Users/Acer/OneDrive/Documents/hackathons/New folder/demo_repo/taskflow`, crashing on non-WSL environments.
2. **ResultStrip Verdict Placeholder Bug**:
   In `frontend/src/components/ResultStrip.tsx` lines 332 and 403, when `!gitOccurred` and `!verificationOccurred`, the UI hardcodes `— PASSED` in the Git column and `— FAILED` in the ChronoFork column before any pytest event has arrived.
3. **GraphCanvas Fallback Symbol Hardcoding**:
   `frontend/src/components/GraphCanvas.tsx` lines 132, 144, 902, 988, 989, 1277-1294 fall back to hardcoded strings (`taskflow.config.load_config`, `taskflow.worker.execute_job`, `taskflow.reports.generator.generate_summary`).
4. **Permanent `memoryWasReset` in Frontend**:
   `setMemoryWasReset(false)` is never called in `App.tsx`, preventing the "carried over" label from reappearing after Scenario 1 writes a new memory episode.
5. **Coder `pytest_cmd` Search Path**:
   `coder.py` line 41 checks `/opt/venv/bin/pytest` and falls back to `pytest`. If `pytest` is not in the system `PATH`, it fails with 0 passed / 1 failed.

### Unverified Claims Found in Docs/README
1. **"Bayesian" Confidence**:
   `backend/app/memory.py` calls it "Dynamic Bayesian/heuristic confidence", but the update equation is a linear step (`+0.10` / `-0.20`) clamped to `[0.10, 0.99]`. It is a heuristic, not Bayesian probability inference.
2. **"LLM CACHED" Badge**:
   `frontend/src/adapters/events.ts` line 423 unconditionally marks `LLM: CACHED` in replay mode, even for deterministic patches where no LLM was used.
3. **Blog Post Latencies without Graph Sizes**:
   `docs/blog-post.md` claims `1.8 ms`, `1.45 ms`, `36.1 ms` without specifying graph size, whereas live verification measured `105.46 ms` for `graph.copy` on the 10-node graph and `3.84 ms` for `algo.pageRank`.
4. **"Microsecond" Speculative Graph Branching**:
   `docs/blog-post.md` section header claims "Microsecond Speculative Graph Branching (`36.1 ms`)"—36 ms is milliseconds, not microseconds.
5. **Zero-Collision Attribution in Scenario 2 & 3**:
   The Cypher query filters by `c1.intent IN ['SIGNATURE_CHANGE', 'DELETE']`. When both agents claim `BODY_EDIT`, the query returns 0 rows due to the intent filter alone, regardless of graph connectivity. Calling it "disjoint subgraphs confirmed" in Scenario 2 is inaccurate (a 4-hop physical path exists).
