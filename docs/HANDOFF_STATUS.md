# ChronoFork Current Status & System Handoff

> **Branch**: `SS1`  
> **Target Track**: Graph Hacks (FalkorDB) - Track 1 (Agents on Connected Data) & Track 2 (Memory & Coordination)

---

## 1. System Architecture Map (File $\to$ Purpose)

### Backend (`backend/app/`)
| File | Purpose |
|---|---|
| [`main.py`](backend/app/main.py) | FastAPI service exposing REST and SSE streaming endpoints (`/runs`, `/runs/{id}/events`, `/graph/{name}`, `/memory/{repo}`, `/repos`, `/health`). |
| [`coordinator.py`](backend/app/coordinator.py) | Swarm coordination, openCypher multi-hop collision detection, topological callee-first merge ordering, handoffs, and speculative graph forking (`fork:<run_id>:<agent_id>`). |
| [`algorithms.py`](backend/app/algorithms.py) | Native FalkorDB graph algorithms (`CALL algo.pageRank`, `CALL algo.betweenness`), unified risk scoring, and reverse-CALLS transitive impact analysis. |
| [`parser.py`](backend/app/parser.py) | Python AST parser generating import-aware code graphs (`:Symbol:Module`, `:Symbol:Class`, `:Symbol:Function`, `:Symbol:Test`) and relationships (`DEFINES`, `IMPORTS`, `CALLS`, `TESTED_BY`). |
| [`memory.py`](backend/app/memory.py) | Episodic and procedural memory management in `mem:<repo>`, managing `:Episode` and `:ProceduralRule` nodes with heuristic confidence clamping `[0.10, 0.99]`. |
| [`scenario_runner.py`](backend/app/scenario_runner.py) | Orchestrator for Scenarios 1–4, driving isolated git merge experiments, coder patch applications, and verifier pytest runs. |
| [`mcp_tools.py`](backend/app/mcp_tools.py) | FastMCP tool server and in-process interface exposing 7 native tools (`get_impact`, `rank_risk`, `claim_symbols`, `detect_collisions`, `recall_memory`, `fork_graph`, `record_episode`). |
| [`event_stream.py`](backend/app/event_stream.py) | In-memory SSE event bus with index-buffered replay and pacing via `delay_ms`. |
| [`falkor_client.py`](backend/app/falkor_client.py) | Redis/FalkorDB connection management, query execution timing, and graph lifecycle operations. |
| [`agents/coder.py`](backend/app/agents/coder.py) | Real workspace isolation (`WorkspaceManager`), automated pytest runner (`Verifier`), and the naive git merge experiment sandbox (`run_naive_git_merge_experiment`). |
| [`agents/llm.py`](backend/app/agents/llm.py) | LLM patch generator supporting Gemini API with deterministic fallback. |

### Frontend (`frontend/src/`)
| File | Purpose |
|---|---|
| [`App.tsx`](frontend/src/App.tsx) | Master console state, SSE stream listener, scenario switcher, playback pacing, and drawer controls. |
| [`components/GraphCanvas.tsx`](frontend/src/components/GraphCanvas.tsx) | Cytoscape.js interactive canvas rendering code AST, compound module clusters, agent claim rings, collision chains, and handoffs. |
| [`components/HeroSplit.tsx`](frontend/src/components/HeroSplit.tsx) | Comparison card contrasting Naive Git 0-conflict clean merge vs ChronoFork 4-hop transitive collision detection. |
| [`components/ResultStrip.tsx`](frontend/src/components/ResultStrip.tsx) | Bottom telemetry drawer with tabs for Verdict, Fork Diff, Memory Drawer, and Merge Receipt. |
| [`components/ZeroPathProof.tsx`](frontend/src/components/ZeroPathProof.tsx) | Zero-path proof card showing graph traversal results between claimed symbols. |
| [`components/QueryInspector.tsx`](frontend/src/components/QueryInspector.tsx) | Live Cypher query inspector displaying exact Cypher text, parameters, and query execution times. |
| [`components/AgentTimeline.tsx`](frontend/src/components/AgentTimeline.tsx) | Chronological swarm event timeline with phase indicators and tool call chips. |
| [`components/ProvenanceStrip.tsx`](frontend/src/components/ProvenanceStrip.tsx) | Data provenance indicators (`GRAPH`, `GIT`, `PYTEST`, `LLM` as REAL vs CACHED). |

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

## 4. Current System Status (Phase 7 Complete)

### DONE (With Evidence Paths)
- **Phase 7 Submission Checklist**: Created [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) auditing all 11 hackathon criteria: 9 PASS, 0 FAIL, 2 UNKNOWN (demo video link & external blog post link awaiting creator recording/publishing).
- **Phase 7 Open Source License**: Confirmed existing permissive MIT License in root [`LICENSE`](LICENSE) (Copyright 2026 Vivek C K).
- **Phase 7 Secret & Environment Scan**: Grepped tracked files for private API keys, tokens, and credentials; verified `.env` is unversioned and ignored by `.gitignore:4:*.env`. Output: 0 secrets.
- **Phase 7 Dual-Resolution Screenshots & Non-Intersection Assertions**: Re-ran full screenshot suite at both 1440x900 and 1920x1080. Asserted 10 pairwise label non-intersections and 5 label vs A2 chip non-intersections for both resolutions (15 PASS at 1440x900, 15 PASS at 1920x1080). Verified log in [`docs/evidence/phase7/screenshots_resolutions_stdout.txt`](docs/evidence/phase7/screenshots_resolutions_stdout.txt).
- **Phase 7 Final Full Regression Suite**: Ran all 16 verification scripts, unit tests, benchmark detector, and Playwright screenshot capture in [`scripts/run_final_regression.py`](scripts/run_final_regression.py). All 16 scripts passed with exit code 0. Individual stdout logs saved in [`docs/evidence/phase7/`](docs/evidence/phase7/).
- **Phase 7 Clean-Clone Docker Test**: Cloned local `SS1` commit into temporary directory, built and started Docker Compose stack, asserted `GET /health` healthy, 69 graph nodes in `repo:taskflow`, 14 replay events in Scenario 1, captured clean-clone screenshot, and verified memory label on initial load is ABSENT (`null`). Verified log in [`docs/evidence/phase7/clean_clone_docker_output.txt`](docs/evidence/phase7/clean_clone_docker_output.txt).
- **Phase 6 Documentation Pack**:
  - 1-page architecture document: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
  - 15 judge technical Q&A: [`docs/QA_PREP.md`](docs/QA_PREP.md)
  - Story-led blog post with captured pytest output: [`docs/blog-post.md`](docs/blog-post.md)
  - $\le 3$-minute UI video demo script: [`docs/demo-script.md`](docs/demo-script.md)
  - Comprehensive Claims vs Evidence table: [`docs/evidence/phase6/claims_table.md`](docs/evidence/phase6/claims_table.md)

### PARTIAL
- **FastMCP Tools**: In-process tool wrappers and FastMCP server definitions exist in `backend/app/mcp_tools.py` with 7 native tools, but are not exposed as an independent standalone microservice in Docker Compose.
- **LLM Agent Mode**: Scaffolded in `backend/app/agents/llm.py` with Gemini SDK interface, but demo execution uses deterministic scripted patches for benchmark stability.

### NOT DONE (Explicit Scope Boundaries)
- **FalkorDB Cloud**: NOT DONE. The system runs against local/containerized FalkorDB instances. No remote cloud instance configuration was attempted.
- **Dynamic Metaprogramming Analysis**: NOT DONE. Static AST analysis cannot trace runtime dynamic reflection (`getattr`, dictionary dispatch tables, variable aliases).

### KNOWN BUGS & LIMITATIONS
- **Instance Method Linking (`self_method`)**: When code calls `worker = ServiceWorker(); worker.f()`, the AST visitor creates a `CALLS` edge from caller to the Class symbol (`pkg.callee.ServiceWorker`) instead of the method symbol (`ServiceWorker.f`) due to lack of type inference. Documented in [`docs/benchmark.md`](docs/benchmark.md) (1 false negative out of 20 ground-truth calls).
- **4-Hop Traversal Boundary**: OpenCypher query uses `[:CALLS*1..4]`. Any dependency chains of length $k \ge 5$ are silent by query design.


