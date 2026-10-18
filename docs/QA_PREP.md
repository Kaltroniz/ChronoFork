# ChronoFork — Judge & Technical QA Preparation

This document contains 16 technical questions and rigorous, verified answers prepared for hackathon judges, technical reviewers, and architectural deep-dives.

---

### Q1: Why use a graph database like FalkorDB? Why couldn't this be done with PostgreSQL or a document store?
**Answer**:
1. **Arbitrary-Depth Transitive Traversal**: Finding whether Agent 2's target calls Agent 1's target across intermediate functions requires variable-length path traversal `(caller)-[:CALLS*1..4]->(target)`. In relational SQL, this requires recursive Common Table Expressions (CTEs) with multiple self-joins that become computationally prohibitive and unindexable as depth grows. In FalkorDB, openCypher evaluates this 4-hop chain in **~1-2 ms (median 1.97 ms; see `docs/NUMBERS.md`)** on the 69-node repository graph.
2. **Native In-Memory Graph Algorithms**: PageRank and Betweenness Centrality determine whether a symbol is an architectural bottleneck. Running these on SQL tables requires exporting the adjacency matrix to an external compute engine (e.g. NetworkX) on every claim. FalkorDB executes `algo.pageRank` in **1.36 ms** and `algo.betweenness` in **1.80 ms** directly in Redis memory.
3. **Unified Code and Swarm Model**: In FalkorDB, coordination entities (`:Agent`, `:Run`) connect directly to code AST symbols (`:Symbol`) via `[:CLAIMS]` edges. A single query traverses from Agent $\to$ Claim $\to$ Symbol $\to$ CALLS chain $\to$ Symbol $\to$ Claim $\to$ Agent, returning the entire causal chain in a single graph transaction.

---

### Q2: What is the exact collision detection query and how does it work?
**Answer**:
From [`backend/app/coordinator.py:160-170`](backend/app/coordinator.py#L160-L170):
```cypher
MATCH (a1:Agent)-[c1:CLAIMS]->(s1:Symbol),
      (a2:Agent)-[c2:CLAIMS]->(s2:Symbol)
WHERE a1.id <> a2.id
  AND c1.intent IN ['SIGNATURE_CHANGE', 'DELETE']
MATCH path = (s2)-[:CALLS*1..4]->(s1)
RETURN a1.id AS a1, a2.id AS a2, s1.qualname AS s1_qname, s2.qualname AS s2_qname,
       c1.intent AS intent1, c2.intent AS intent2,
       [n in nodes(path) | n.qualname] AS path_nodes, length(path) AS hops
```
- It filters for different agents (`a1.id <> a2.id`) where Agent 1 has declared an incompatible modification (`SIGNATURE_CHANGE` or `DELETE`).
- It matches a directed call chain from Agent 2's symbol `s2` to Agent 1's symbol `s1` of length between 1 and 4 hops.
- It returns the involved agents, symbol qualnames, intents, exact node list along the path, and hop count.

---

### Q3: Why does ChronoFork copy the graph per run (`GRAPH.COPY`) instead of operating on a single graph?
**Answer**:
- **Isolation of Swarm State**: The baseline code structure in `repo:<name>` must remain pristine. Each swarm execution clones the graph into `coord:<run_id>` via FalkorDB's native `GRAPH.COPY` (median latency **108.32 ms**).
- **Concurrency & Blast Radius**: Multiple runs or speculative forks (`fork:<run_id>:<agent_id>`) can mutate claims, test candidate patches, and record speculative blast radius without risking race conditions or polluting persistent repository data. Speculative fork simulation creates an isolated graph copy (`graph.copy`) used strictly to evaluate blast radius; it does not apply the patch.

---

### Q4: How is architectural risk calculated, and when is serialization enforced?
**Answer**:
From [`backend/app/algorithms.py:53-56`](backend/app/algorithms.py#L53-L56), risk is a normalized blend of structural dependency scarcity (PageRank) and bridge centrality (Betweenness):
$$\text{Risk}(S) = 0.5 \times \frac{\text{PageRank}(S)}{\max(\text{PageRank})} + 0.5 \times \frac{\text{Betweenness}(S)}{\max(\text{Betweenness})}$$
- For `taskflow.config.load_config`, raw PageRank is 0.056058 (normalized 1.0000) and raw Betweenness is 34.0 (max 48.0, normalized 0.7083), yielding Risk = $0.5(1.0) + 0.5(0.7083) = \mathbf{0.854}$ (formatted as 0.854 across the UI and documented in `docs/NUMBERS.md`).
- **Policy Enforcement**: Policy is intent-driven (`SIGNATURE_CHANGE` and `DELETE` always serialize). Centrality risk is reported and ranks severity. Betweenness is sampled (32 sources, seed 42), so risk is approximate.

---

### Q5: How does the procedural memory system update confidence scores?
**Answer**:
- Managed exclusively by `backend/app/memory.py:update_rule_confidence`.
- Procedural rules are initialized with an initial prior confidence of `0.85`.
- On verified execution success (`pytest` passes), confidence increases by `+0.10` and **saturates at a ceiling of `0.99`**.
- On failure, confidence decreases by `-0.20`, clamped to a minimum floor of `0.10`.
- In Scenario 1, the rule is learned with confidence `0.85` and boosted to `0.95`. In Scenario 2, the rule is recalled, prevents collision, and rises to `0.99`.

---

### Q6: What are ChronoFork's blind spots?
**Answer**:
As documented in [`docs/benchmark.md`](docs/benchmark.md):
1. **Dynamic Attribute Lookup (`getattr`)**: `getattr(mod, 'func')()` cannot be resolved by static AST without runtime dataflow.
2. **Dynamic Dispatch Tables (`dict_dispatch`)**: `DISPATCH['op']()` table lookups are parsed as subscript calls without dictionary constant propagation.
3. **Variable Aliasing (`alias`)**: Module-level alias assignments (`alias = func; alias()`) are not aliased across symbol tables by the simple AST visitor.
4. **Instance Method Resolution (`instance_method`)**: Methods are registered as module-level names (`pkg.callee.target_func`); the claimed qualname `pkg.callee.ServiceWorker.target_func` does not exist in the graph, so the claim edge is never created.
5. **Call chains of 5 or more hops**: Chains of 5 hops or more are not checked under the coordinator's bound.

---

### Q7: How does ChronoFork distinguish between Replay and Live mode?
**Answer**:
- **Replay Mode**: Serves pre-recorded JSON event logs from `replays/scenario_N.json`. The UI displays a `CACHED` badge for each source with its original execution timestamp.
- **Live Mode**: Executes live against FalkorDB, creates real Git branches, applies patches, and executes real `pytest` in isolated workspaces. The UI displays a `REAL` badge.
- Replays serve as instant, zero-API-key demonstrations of real recorded swarm runs.

---

### Q8: What happens if FalkorDB is shut down during execution?
**Answer**:
ChronoFork **fails loudly with zero mock fallbacks**:
- When FalkorDB is stopped, calling `POST /runs` in live mode, or `GET /graph/taskflow` returns HTTP **`503 Service Unavailable`** with body `{"detail": "FalkorDB connection refused or offline: ... failure to connect ..."}`.
- The frontend renders an explicit red error toast banner. No stale mock graphs are rendered. Verified via Playwright in [`docs/screens/live-fail-loudly.png`](docs/screens/live-fail-loudly.png).

---

### Q9: Why are agents implemented as deterministic scripted patches rather than live LLMs?
**Answer**:
- ChronoFork supports both **Replay Mode** (serving deterministic, pre-captured event logs for instant zero-key verification) and **Live Gemini Mode** (`backend/app/agents/llm.py`), which calls Gemini to synthesize caller migration patches (`database.py`) and validates them against real `pytest` inside isolated workspaces before falling back to verified patches if tests fail.
- The core innovation of ChronoFork is the **graph coordination engine, collision detection, and procedural memory**, providing mathematical guarantees that prevent silent semantic merge breakages regardless of which LLM provider generates code.

---

### Q10: How do you avoid circular reasoning in the benchmark evaluation?
**Answer**:
- Ground truth is **NEVER derived from the graph**.
- Ground truth is established strictly by **runtime execution (`pytest`)**:
  - Patch A alone passes locally.
  - Patch B alone passes locally.
  - Both patches are applied to a merged workspace copy and executed under `pytest`.
  - If merged execution raises a runtime error (e.g. `TypeError`), it is labeled a **Ground Truth Positive (Collision)**. If it passes, it is labeled **Negative (Safe)**.
- Detectors are evaluated against this runtime ground truth.

---

### Q11: Why are agent claims represented as EDGES instead of NODES in FalkorDB?
**Answer**:
- A claim represents a directional relationship between an actor and a resource: `(:Agent)-[:CLAIMS {intent, subtask, claimed_at}]->(:Symbol)`.
- Modeling claims as edges allows openCypher to traverse directly from an Agent to its claimed Symbol, across `[:CALLS]` edges, to another claimed Symbol, and to the colliding Agent in a single path pattern without intermediate hop overhead.

---

### Q12: What happens if a collision chain is 5 or more hops away?
**Answer**:
- The coordinator query uses the bound `[:CALLS*1..4]`.
- Any dependency chain of length $k \ge 5$ hops is not checked under the coordinator's current bound.
- This bound is an intentional query-cost choice: bounded variable-length path queries maintain predictable 1-2 ms latency, whereas unbounded Cypher traversals (`*1..`) on dense graphs risk exponential path explosion. Expanding the bound to $k \le 6$ requires only changing the query parameter.

---

### Q13: What does `DEMO_MODE` disable in configuration?
**Answer**:
Configurable via `.env` or Docker Compose environment: `DEMO_MODE=true` (which is default for production safety):
1. **Live Subprocess Execution**: In `POST /runs`, `DEMO_MODE=true` forces execution to `replay` mode (`req_mode = "replay" if demo_mode else req.mode`), disabling live Git branch creation, live subprocess merges, and live `pytest` invocations on the host.
2. **Arbitrary Repository Ingestion**: In `POST /repos`, `DEMO_MODE=true` returns HTTP **`403 Forbidden`** (`"Repository upload and ingestion is disabled in Demo Mode."`), completely disabling arbitrary directory tree parsing and FalkorDB graph ingestion from external requests.
3. **Memory Graph Reset**: `POST /memory/{repo}/reset` returns HTTP `403 Forbidden` in Demo Mode.
4. **MCP-Compatible Endpoint**: MCP-compatible JSON-RPC endpoint (`/mcp` with hand-rolled `tools/list` and `tools/call`); write tools (`claim_symbols`, `fork_graph`, `record_episode`) are disabled in Demo Mode (returning code `-32001`), allowing only read tools (`get_impact`, `rank_risk`, `recall_memory`).

---

### Q14: How is provenance tracked across event sources?
**Answer**:
- Every swarm event carries a granular `provenance` dictionary stamping each executing subsystem independently:
  - `graph`: FalkorDB query execution timestamp.
  - `git`: Real Git branch/merge execution timestamp.
  - `pytest`: Real test execution timestamp.
  - `llm`: LLM model execution timestamp (implemented; falls back to the scripted patch).
- `captured_at` represents the actual timestamp of event emission. In replay mode, the UI displays `CACHED` alongside these capture dates.

---

### Q15: What does Rule 3 mean here?
**Answer**:
Graph Hacks Rule 3 says the graph must do real work, and the product must stop working if FalkorDB is removed.
- In Live mode (`DEMO_MODE=false`), stopping the container makes runs fail with HTTP 503 and no fallback.
- Claims, the collision query, the risk scores, merge ordering and memory recall all run in FalkorDB.
- Replay mode serves cached events captured from real runs.

---

### Q16: What tools were used to build ChronoFork, and what did the human team personally verify?
**Answer**:
- **Google Antigravity**: Used for autonomous codebase implementation, Playwright end-to-end verification, test suite authoring, and Docker containerization.
- **Anthropic Claude**: Used for initial design review, architectural planning, and benchmark methodology design.
- **Verified by Team Mutants (Vivek C K & Souhardya Saha)**:
  - Verified by Vivek C K and Souhardya Saha: we ran the clean-clone docker compose up, the benchmark and the 5-failed/12-passed experiment ourselves, checked the docs against docs/NUMBERS.md and the evidence logs, and can explain the schema, the collision query, the risk formula and the memory update.

---

### Q17: Wouldn't each agent's own tests catch this? Isn't "git merges cleanly" a weak baseline?
**Answer**: Partly, in this demo. Agent 1's branch changes `load_config`'s contract without migrating its callers, so Agent 1's own branch fails tests too. We did not measure git merges or per-branch tests in the benchmark (those columns say "not measured"); the only measured baseline is the merged-tree test run, which equals ground truth by construction. What we claim and measured is claim-time detection: before any code exists, ChronoFork knows a breaking-intent claim reaches another agent's claim within 4 CALLS hops (22/38 seeded collisions, 0 false positives), and it sequences the contract change and the caller migration. Limits: synthetic corpus, static call resolution only, 4-hop bound.
