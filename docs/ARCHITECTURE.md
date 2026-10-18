# ChronoFork — System Architecture

ChronoFork is an autonomous multi-agent coding swarm coordinator where **FalkorDB is the core brain**. When multiple AI agents modify separate files concurrently, Git reports zero text conflicts while runtime tests break. ChronoFork models codebases and agent intent directly as a graph to detect, serialize, and adapt cross-file dependencies in millisecond-scale time.

---

## 1. Multi-Graph Namespace Model

FalkorDB maintains four distinct graph namespaces per repository:

```
               [AST Parser]
                    │
                    ▼
           ┌─────────────────┐
           │ repo:<repo_name>│ ── Code Graph (Symbols, CALLS, IMPORTS, TESTED_BY)
           └─────────────────┘
                    │
       GRAPH.COPY   │   GRAPH.COPY
      ┌─────────────┴─────────────┐
      ▼                           ▼
┌──────────────────┐    ┌─────────────────────────┐
│ coord:<run_id>   │    │ fork:<run_id>:<agent_id>│ ── Speculative Blast Radius
└──────────────────┘    └─────────────────────────┘
  ▲  │
  │  └── Overlays [:CLAIMS], [:COLLIDES_WITH], [:BLOCKED_BY], [:HANDED_OFF_TO]
  │
┌──────────────────┐
│ mem:<repo_name>  │ ── Episodic & Procedural Memory (:Episode, :ProceduralRule)
└──────────────────┘
```

1. **`repo:<name>` (Code Graph)**: Static AST structure. Nodes have label `:Symbol` plus one sublabel (`:Module`, `:Class`, `:Function`, `:Test`). Edges: `DEFINES`, `IMPORTS`, `CALLS`, `TESTED_BY`.
2. **`coord:<run_id>` (Coordination Graph)**: Cloned per swarm run via `GRAPH.COPY`. Agent nodes (`:Agent`) connect to code `:Symbol` nodes via `[:CLAIMS {intent, subtask, claimed_at}]` edges.
3. **`fork:<run_id>:<agent_id>` (Speculative Graph Fork)**: Cloned to simulate candidate modifications and calculate blast radius via reverse-`CALLS` reachability before modifying physical code.
4. **`mem:<repo>` (Memory Graph)**: Persistent memory storing historical `:Episode` and `:ProceduralRule` nodes linked to `:Symbol` nodes via `[:INVOLVED]`.

---

## 2. End-to-End Coordination Pipeline

```
1. PLANNING          2. RECALL            3. CLAIM             4. COLLISION DETECTION
Planner decomposes   Agents query         Agents write         openCypher traverses
task into subtasks   mem:<repo> for       [:CLAIMS] edges      (s2)-[:CALLS*1..4]->(s1)
and assigns agents.  procedural rules.    to coord graph.      in ~1-2 ms (1.97 ms).
      │                    │                    │                    │
      ▼                    ▼                    ▼                    ▼
5. GIT COMPARISON    6. RESOLUTION        7. EXECUTION         8. VERIFICATION & MEMORY
Naive Git merge      SERIALIZE policy     Agent 1 lands;       Real pytest runs;
experiment runs;     enforces callee-     Agent 2 adapts       rules updated with
confirms 0 conflict. first merge order.   via handoff diff.    new confidence (0.95 -> 0.99).
```

### Key Execution Stages:
- **Pre-Execution Claiming**: Agents claim symbols before generating code. Claims are edges (`[:CLAIMS]`), not disconnected nodes.
- **Transitive Querying**: openCypher evaluates multi-hop chains `(caller:Symbol)-[:CALLS*1..4]->(target:Symbol)` where target has `intent IN ['SIGNATURE_CHANGE', 'DELETE']`.
- **Topological Merge Ordering**: When a collision is detected, ChronoFork marks `(:Agent)-[:BLOCKED_BY]->(:Agent)` and schedules the callee (Agent 1) to land first. Agent 2 receives Agent 1's patch diff via `[:HANDED_OFF_TO]`, adapting its consumer code before running verification.
- **Procedural Memory Feedback**: Successful rule-guided runs boost rule confidence by `+0.10` (up to `0.99`). Future runs recall rules upfront, automatically mutating claims from breaking `SIGNATURE_CHANGE` to backward-compatible `BODY_EDIT`.

---

## 3. Subsystem Breakdown

| Subsystem | Source Location | Responsibility |
|---|---|---|
| **AST Parser** | [`backend/app/parser.py`](backend/app/parser.py) | Python AST visitor resolving module imports, symbol definitions, calls, and test relationships. |
| **Swarm Coordinator** | [`backend/app/coordinator.py`](backend/app/coordinator.py) | Coordinates agent lifecycle, multi-hop collision detection, topological sorting, and handoffs. |
| **Graph Algorithms** | [`backend/app/algorithms.py`](backend/app/algorithms.py) | Computes PageRank and Betweenness Centrality directly in FalkorDB; evaluates unified risk. |
| **Memory Engine** | [`backend/app/memory.py`](backend/app/memory.py) | Manages episodic and procedural graphs in `mem:<repo>` with heuristic confidence clamping `[0.10, 0.99]`. |
| **Workspace Sandbox** | [`backend/app/agents/coder.py`](backend/app/agents/coder.py) | Isolated temporary directory manager running Git merge experiments and real `pytest` runners. |
| **Event Bus & API** | [`backend/app/main.py`](backend/app/main.py) | FastAPI service delivering REST endpoints and SSE telemetry streams with millisecond-scale query timing. |
| **Frontend Console** | [`frontend/src/App.tsx`](frontend/src/App.tsx) | React 19 + Cytoscape.js instrument console rendering AST compounds, claim rings, collision paths, and telemetry. |

---

## 4. Production Deployment Topology

The entire system is containerized via Docker Compose:
- **`falkordb`**: In-memory graph engine with healthcheck (`redis-cli ping | grep PONG`).
- **`backend`**: Python 3.11 FastAPI service with auto-seed on startup, restricted CORS, and native `pytest`/`git` tooling.
- **`frontend`**: Production multi-stage build running static Nginx on port 5173, reverse-proxying API and SSE connections to backend port 8000.
