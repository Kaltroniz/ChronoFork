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

### Verification & Agents
- **Deterministic Scripted Patches**: Agent code generation is executed via deterministic scripted patches designed to simulate specific refactor and collision scenarios.
- **LLM Mode Status**: Live LLM invocation via Gemini API (`backend/app/agents/llm.py`) is scaffolded with fallback handling, but live model execution is **NOT validated** against production API keys.
- **Real Test Isolation**: Automated verification runs real `pytest` in isolated workspace directory copies, proving that naive git merges fail (5 failed, 7 passed) while ChronoFork coordinated merges pass (12 passed, 0 failed).

### Media & Assets
- **Video Recordings**: `docs/screens/scenario1.webm` (17.80s), `docs/screens/scenario2.webm` (13.52s), and `docs/screens/scenario3.webm` (13.56s) are preserved in git tracking as essential evidence deliverables for submission.
- **Screenshots**: Screen captures verifying clean layout, bounding box clearance, and fail-loudly error states are stored in `docs/screens/`.
