# ChronoFork Current Status & System Handoff

> **Branch**: `SS1`  
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
| [`scenario_runner.py`](file:///Users/souhardya/ChronoFork/backend/app/scenario_runner.py) | Orchestrator for Scenarios 1–4, driving isolated git merge experiments, coder patch applications, and verifier pytest runs. |
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

## 2. Graph Schema: AS IMPLEMENTED

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

### Documentation Discrepancies Removed
- Claims are strictly **EDGES** (`[:CLAIMS]`), not `:Claim` or `:AgentClaim` nodes.
- `subtask` is a string property on `[:CLAIMS]` edges, not a separate `:Subtask` node.
- Symbol relationships are strictly `CALLS`, not `DEPENDS_ON`.
- `:SemanticFact` and `OCCURRED_AFTER` edges do not exist.

---

## 3. How to Run & Prerequisites

### Prerequisites
- Docker (for FalkorDB container or full Compose deployment)
- Python 3.11 (`.venv/bin/python`)
- Node.js 18+ (for frontend development)

### Option A: Complete Docker Compose Deployment (Production Build)
```bash
docker compose up --build -d
```
- Frontend: `http://localhost:5173` (static build served via Nginx, reverse-proxying API calls)
- Backend: `http://localhost:8000` (FastAPI with healthcheck and startup auto-seed)
- FalkorDB: `localhost:6379` (FalkorDB graph engine with healthcheck)

### Option B: Local Development
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
   cd frontend
   npm run dev
   ```

---

## 4. Current System Status

### Core Engine & Coordinator
- **Full Transitive Collision Detection**: Successfully traces multi-hop call chains (up to $k=4$ hops in FalkorDB via openCypher). Correctly reports call path `['taskflow.worker.execute_job', 'taskflow.queue.dequeue_task', 'taskflow.auth.validate_token', 'taskflow.database.get_connection', 'taskflow.config.load_config']`.
- **Topological Merge Ordering**: Applies `SERIALIZE_CALLEE_FIRST` policy, allowing callee changes (Agent 1) to land before caller adaptations (Agent 2).
- **Blast Radius & Speculative Forks**: Speculatively clones graphs into `fork:<run_id>:<agent_id>` and computes reverse-CALLS impact trees within $\le 4$ hops.
- **Fail-Loudly Architecture**: When FalkorDB is offline or unreachable, backend returns HTTP `503 Service Unavailable` with explicit connection error details across `/runs`, `/graph/{name}`, and `/collisions/{run_id}`. No stale mock fallbacks are used. The frontend displays an error toast banner read directly from the response.

### Provenance Tracking
- **Granular Per-Source Stamps**: Every event tracks executing sources independently (`graph`, `git`, `pytest`, `llm`).
- **Timestamp Definition**: `captured_at` represents the actual timestamp of that source's execution (event emission time).
- **Replay vs Live Semantics**: In replay mode, the UI shows `CACHED` alongside the captured date for each source. In live runs, the UI displays `REAL`.

### Memory Graph & Rule Confidence
- **Initial Confidence Prior**: Procedural rules are seeded with an initial confidence prior of `0.85` (chosen prior).
- **Single Confidence Updater**: Managed exclusively by `backend/app/memory.py:update_rule_confidence`.
- **Trajectory Dynamics**: On every successful rule-guided run, confidence rises by `+0.10` and saturates at `0.99`. On failure, confidence decreases by `-0.20`, clamped to a minimum of `0.10`.
- **Adaptive Execution**: In Scenario 2 with memory enabled, recalled rules dynamically mutate agent intent from a breaking `SIGNATURE_CHANGE` to a backward-compatible `BODY_EDIT`, preventing collision.

### Detection Benchmark (Phase 3 Corrections)
- **Dataset**: $N = 58$ seeded cases (38 ground-truth collisions, 20 ground-truth safe cases).
- **Ground Truth**: Strictly defined by merged-tree `pytest` runtime execution.
- **Detector Comparison**:
  - `(a1) Git text conflict`: $0\%$ recall (all edits in separate functions/files merge with 0 text conflicts).
  - `(a2) Per-branch tests`: $0\%$ recall (cross-branch semantic collisions are invisible on isolated branches before landing).
  - `(a3) Merged-tree tests`: $100\%$ recall, but known only **post-merge** after CI breaks and compute is wasted.
  - `(b) ChronoFork`: Discovers collisions at **claim time** before code is written, achieving **100% precision** ($FP=0, TN=20$), **100% recall on static call chains (1–4 hops)**, with a median query latency of **1.37 ms**.
- **Documented Blind Spots**: Dynamic metaprogramming patterns (`getattr`, `dict_dispatch`, `alias`, `self_method`) require runtime dataflow or type inference.

### Docker & Deployment (Phase 5-lite)
- **Production Build**: Multi-stage Docker build serving production frontend bundle statically via Nginx on port 5173, proxying API and SSE streaming to FastAPI backend on port 8000.
- **Auto-Seed on Startup**: Automatically parses and ingests `taskflow` (69 nodes, 109 edges) and `analytics` repos into FalkorDB upon service start.
- **Clean Clone Verified**: Validated via automated test [`scripts/test_clean_clone_docker.py`](file:///Users/souhardya/ChronoFork/scripts/test_clean_clone_docker.py) cloning `SS1` into an isolated temp directory, building containers, verifying `/health`, `/graph/taskflow`, Scenario 1 replay (`Passed = 12, Failed = 0, ExitCode = 0`), frontend HTTP status (`200 OK`), and capturing UI screenshot [`docs/screens/clean-clone-story.png`](file:///Users/souhardya/ChronoFork/docs/screens/clean-clone-story.png).
- **CORS Restricted**: Controlled via `CORS_ORIGINS` environment variable, defaulting to explicit localhost and 127.0.0.1 ports with allowed methods `["GET", "POST", "OPTIONS"]`.

### Explicitly Not Done (Scope Boundaries)
- **FalkorDB Cloud**: NOT DONE. The system runs against local/containerized FalkorDB instances. No remote cloud instance configuration was attempted.
- **MCP Server in Deployment**: NOT DONE. In-process tool wrappers and FastMCP definitions exist in `backend/app/mcp_tools.py`, but a standalone deployed MCP service daemon is not configured in Docker.
- **Live LLM Execution Mode**: NOT DONE. Scenario runner relies on verified deterministic scripted patches. Live Gemini API execution is scaffolded but not validated against production keys.
