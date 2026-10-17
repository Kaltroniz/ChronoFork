# ChronoFork — Judge & Technical QA Preparation

This document contains 15 technical questions and rigorous, verified answers prepared for hackathon judges, technical reviewers, and architectural deep-dives.

---

### Q1: Why use a graph database like FalkorDB? Why couldn't this be done with PostgreSQL or a document store?
**Answer**:
1. **Arbitrary-Depth Transitive Traversal**: Finding whether Agent 2's target calls Agent 1's target across intermediate functions requires variable-length path traversal `(caller)-[:CALLS*1..4]->(target)`. In relational SQL, this requires recursive Common Table Expressions (CTEs) with multiple self-joins that become computationally prohibitive and unindexable as depth grows. In FalkorDB, openCypher evaluates this 4-hop chain in **0.76 ms** on the 69-node repository graph.
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
- **Concurrency & Blast Radius**: Multiple runs or speculative forks (`fork:<run_id>:<agent_id>`) can mutate claims, test candidate patches, and record speculative blast radius without risking race conditions or polluting persistent repository data.

---

### Q4: How is architectural risk calculated, and when is serialization enforced?
**Answer**:
From [`backend/app/algorithms.py:53-56`](backend/app/algorithms.py#L53-L56), risk is a normalized blend of structural dependency scarcity (PageRank) and bridge centrality (Betweenness):
$$\text{Risk}(S) = 0.5 \times \frac{\text{PageRank}(S)}{\max(\text{PageRank})} + 0.5 \times \frac{\text{Betweenness}(S)}{\max(\text{Betweenness})}$$
- For `taskflow.config.load_config`, raw PageRank is 0.0561 (normalized 1.0000) and raw Betweenness is 26.0 (normalized 0.6500), yielding Risk = $0.5(1.0) + 0.5(0.65) = \mathbf{0.8250}$.
- **Policy Enforcement**: If Agent 1's intent is `SIGNATURE_CHANGE` or `DELETE`, ChronoFork's coordinator **forces policy `SERIALIZE_CALLEE_FIRST` regardless of the risk threshold**, because altering a callee's interface will break caller execution irrespective of centrality.

---

### Q5: How does the procedural memory system update confidence scores?
**Answer**:
- Managed exclusively by `backend/app/memory.py:update_rule_confidence`.
- Procedural rules are initialized with an initial prior confidence of `0.85`.
- On verified execution success (`pytest` passes), confidence increases by `+0.10` and saturates at a ceiling of `0.99`.
- On failure, confidence decreases by `-0.20`, clamped to a minimum floor of `0.10`.
- In Scenario 1, the rule is learned with confidence `0.85` and boosted to `0.95`. In Scenario 2, the rule is recalled, prevents collision, and rises to `0.99`.

---

### Q6: What are ChronoFork's blind spots?
**Answer**:
As documented in [`docs/benchmark.md`](docs/benchmark.md):
1. **Dynamic Attribute Lookup (`getattr`)**: `getattr(mod, 'func')()` cannot be resolved by static AST without runtime dataflow.
2. **Dynamic Dispatch Tables (`dict_dispatch`)**: `DISPATCH['op']()` table lookups are parsed as subscript calls without dictionary constant propagation.
3. **Variable Aliasing (`alias`)**: Module-level alias assignments (`alias = func; alias()`) are not aliased across symbol tables by the simple AST visitor.
4. **Instance Method Resolution (`self_method`)**: In `worker = ServiceWorker(); worker.f()`, the static visitor links the CALLS edge to the class `ServiceWorker` rather than the method symbol `ServiceWorker.f` because it lacks receiver type inference.

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
- When FalkorDB is stopped, calling `POST /runs` in live mode, `GET /graph/taskflow`, or `GET /collisions/test_run` returns HTTP **`503 Service Unavailable`** with body `{"detail": "FalkorDB connection refused or offline: Error 61 connecting to 127.0.0.1:6379"}`.
- The frontend renders an explicit red error toast banner. No stale mock graphs are rendered. Verified via Playwright in [`docs/screens/live-fail-loudly.png`](docs/screens/live-fail-loudly.png).

---

### Q9: Why are agents implemented as deterministic scripted patches rather than live LLMs?
**Answer**:
- To guarantee **100% reproducible coordination benchmarks and hackathon demonstrations**.
- The core innovation of ChronoFork is the **graph coordination engine, collision detection, and procedural memory**, not the LLM code generator.
- While LLM invocation via Gemini API is scaffolded in `backend/app/agents/llm.py`, live LLM mode was intentionally not validated against production API keys to prevent flaky LLM outputs from contaminating graph coordination verification.

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
- Any dependency chain of length $k \ge 5$ hops is **silent** to ChronoFork under current configuration.
- This bound represents an intentional engineering trade-off: in empirical software engineering, transitive impact beyond 4 hops decays rapidly, while unbounded Cypher traversals (`*1..`) on dense graphs risk exponential path explosion. Expanding the bound to $k \le 6$ requires only changing the query parameter.

---

### Q13: What does `DEMO_MODE` do in configuration?
**Answer**:
- Configurable via `.env` or Docker Compose environment: `DEMO_MODE=true`.
- In `DEMO_MODE`, the backend enforces replay mode across all endpoints, blocking accidental live runs and external API invocations to guarantee deterministic exhibition during conference presentations or judge evaluations.

---

### Q14: How is provenance tracked across event sources?
**Answer**:
- Every swarm event carries a granular `provenance` dictionary stamping each executing subsystem independently:
  - `graph`: FalkorDB query execution timestamp.
  - `git`: Real Git branch/merge execution timestamp.
  - `pytest`: Real test execution timestamp.
  - `llm`: LLM model execution timestamp (omitted when deterministic).
- `captured_at` represents the actual timestamp of event emission. In replay mode, the UI displays `CACHED` alongside these capture dates.

---

### Q15: What tools were used to build ChronoFork, and what did the human team personally verify?
**Answer**:
- **Google Antigravity**: Used for autonomous codebase implementation, Playwright end-to-end verification, test suite authoring, and Docker containerization.
- **Anthropic Claude**: Used for initial design review, architectural planning, and benchmark methodology design.
- **TEAM TO CONFIRM: what we personally verified**:
  - The team personally validated the openCypher collision queries on FalkorDB.
  - The team personally executed the 5-failed vs 12-passed pytest comparison on real workspaces.
  - The team personally verified the Docker Compose multi-stage build, container healthchecks, and Playwright UI recordings.
