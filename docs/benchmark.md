# ChronoFork Collision Detection Benchmark Report

> **Evaluation Date**: 2026-10-17  
> **Random Seed**: `2026`  
> **Evidence Artifacts**: [`benchmark_results.csv`](file:///Users/souhardya/ChronoFork/docs/evidence/phase3/benchmark_results.csv), [`benchmark_results.json`](file:///Users/souhardya/ChronoFork/docs/evidence/phase3/benchmark_results.json), [`benchmark_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase3/benchmark_stdout.txt)

---

## 1. Methodology & Evaluation Protocol

### Ground Truth from Execution (Not Graph Assumption)
To avoid circular reasoning where the graph labels its own detections as correct, **ground truth is defined strictly by real runtime execution**:
1. For each test case, an isolated temporary repository environment is instantiated with base modules (`callee.py`, `caller.py`) and a unit test suite.
2. **Patch A (Agent 1)** applies a breaking signature change to symbol $F$ (e.g. introducing a required positional argument). Verified that Patch A alone passes its local specification.
3. **Patch B (Agent 2)** applies an edit to symbol $G$ (calling $F$ or performing caller operations). Verified that Patch B alone passes on the baseline code.
4. Both patches are combined (simulating a merged repository state) and evaluated under `pytest`:
   - **Ground Truth POSITIVE (True Collision)**: Patch A alone passes, Patch B alone passes, but the combined merged execution raises a runtime error (e.g. `TypeError: missing required argument`).
   - **Ground Truth NEGATIVE (Safe / Non-Colliding)**: Both changes pass independently and the merged code passes runtime execution with zero errors.

### Tested Detectors
1. **Detector A: Git Merge + Repository Unit Tests**:
   - Standard source-control behavior: since $F$ and $G$ reside in different files or hunks, git merge applies both changes cleanly with zero text conflicts (`exit code 0`).
   - Git merge relies on pre-merge local test runs, which only execute tests for each agent's individual branch and do not catch cross-branch semantic incompatibilities before landing.
2. **Detector B: ChronoFork (FalkorDB)**:
   - Ingests the baseline AST into an ephemeral FalkorDB graph (`repo:bench_<case_id>`).
   - Records Agent 1's claim on $F$ with `intent = 'SIGNATURE_CHANGE'` and Agent 2's claim on $G$ with `intent = 'BODY_EDIT'`.
   - Executes the exact multi-hop openCypher collision query from [`backend/app/coordinator.py`](file:///Users/souhardya/ChronoFork/backend/app/coordinator.py#L160-L170):
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

### External Public Repository Note
In accordance with instructions, testing against an external public repository was skipped to guarantee 100% reproducible execution within the local isolated environment. All 42 seeded cases were evaluated against synthetic and taskflow-modeled structural patterns in isolated workspaces.

---

## 2. Benchmark Summary Results (First-Run Numbers)

*Note: As required by benchmark protocol, parser and Cypher queries were NOT modified after observing initial outputs. First-run numbers are reported honestly.*

| Detector | TP | FP | FN | TN | Precision | Recall | F1-Score |
|---|---|---|---|---|---|---|---|
| **Git Merge + Repo Tests** | 0 | 0 | 38 | 4 | **0.0%** | **0.0%** | 0.0% |
| **ChronoFork (FalkorDB)** | 22 | 0 | 16 | 4 | **100.0%** | **57.9%** | **73.3%** |

### Detection Latency (ChronoFork FalkorDB Query)
- **Minimum**: `0.55 ms`
- **Median**: `1.44 ms`
- **Maximum**: `2.14 ms`

---

## 3. Per-Pattern Breakdown

| Pattern ID | Description | Total Cases | Ground Truth Collisions | ChronoFork Detected | ChronoFork Recall | Detection Status |
|---|---|---|---|---|---|---|
| `direct_call` | 1-hop direct call: $G \to F$ | 5 | 5 | 5 | **100%** | DETECTED |
| `two_hops` | 2-hop call chain: $G \to H \to F$ | 4 | 4 | 4 | **100%** | DETECTED |
| `three_hops` | 3-hop call chain: $G \to H_1 \to H_2 \to F$ | 4 | 4 | 4 | **100%** | DETECTED |
| `four_hops` | 4-hop call chain: $G \to H_1 \to H_2 \to H_3 \to F$ | 5 | 5 | 5 | **100%** | DETECTED |
| `import_inside_function` | Lazy import of $F$ inside $G$'s function body | 4 | 4 | 4 | **100%** | DETECTED |
| `unrelated_pairs` | Disjoint modules with 0 call edges | 4 | 0 | 0 (TN=4) | **N/A (100% Spec)** | SAFE (NO FP) |
| `self_method` | Method invocation on class instance: `obj.method() \to self.F()` | 4 | 4 | 0 | **0%** | BLIND SPOT |
| `getattr_call` | Dynamic attribute lookup: `getattr(mod, 'F')()` | 4 | 4 | 0 | **0%** | BLIND SPOT |
| `alias_call` | Function aliased to variable: `f = F; f()` | 4 | 4 | 0 | **0%** | BLIND SPOT |
| `dict_dispatch` | Dynamic table dispatch: `DISPATCH['key']()` | 4 | 4 | 0 | **0%** | BLIND SPOT |

---

## 4. Honest Analysis of Blind Spots & Misses

ChronoFork does **NOT** catch everything. The benchmark demonstrates a sharp, predictable boundary between static AST reachability and dynamic Python runtime metaprogramming:

### 1. Dynamic Attribute Lookup (`getattr_call`) — 4 Misses (Cases 21–24)
- **Miss Reason**: `getattr(callee_mod, 'target_func')` resolves the function object via a runtime string evaluation.
- **Root Cause**: The AST parser traverses `ast.Call` and `ast.Attribute`, but without dynamic dataflow analysis or symbolic execution, string arguments passed to `getattr` are not converted into `:CALLS` graph edges.

### 2. Table-Driven Dynamic Dispatch (`dict_dispatch`) — 4 Misses (Cases 29–32)
- **Miss Reason**: Functions registered in dictionaries (`DISPATCH = {'op': target_func}`) and called via subscription (`DISPATCH['op']()`).
- **Root Cause**: The AST parser sees `ast.Subscript` as the call target. Without constant propagation or dictionary flow tracking, the target function qualname cannot be resolved statically.

### 3. Intra-Module Aliasing (`alias_call`) — 4 Misses (Cases 25–28)
- **Miss Reason**: `local_alias = target_func; local_alias()`.
- **Root Cause**: The AST parser resolves calls using the module's imported symbol table and function definitions. Variable assignment assigns the function reference to an identifier that the simple visitor does not alias-trace.

### 4. Instance Method Resolution (`self_method`) — 4 Misses (Cases 17–20)
- **Miss Reason**: Method call on class instance: `worker = ServiceWorker(); worker.target_func()`.
- **Root Cause**: The parser creates symbol `pkg.callee.ServiceWorker.target_func`, but call resolution at `worker.target_func()` inspects `worker`'s type. Without type inference mapping `worker` to `ServiceWorker`, the call edge is not linked to the qualified class method symbol.

---

## 5. Conclusions & Architectural Takeaway

1. **Static Graph Traversal is Ultra-Fast**: Across all 42 cases, FalkorDB openCypher graph traversal executed in a median time of **1.44 ms** (max 2.14 ms).
2. **Zero False Positives**: ChronoFork achieved **100% Precision**. In all non-colliding cases (`unrelated_pairs`), it produced zero spurious blocks.
3. **100% Recall on Static Transitive Chains**: For all standard functional and procedural call chains from 1 to 4 hops and function-scoped imports, ChronoFork achieved **100% recall**, completely eliminating the multi-hop blind spot that Git merges suffer from.
4. **Clear Roadmap for Enhancement**: Bridging the 4 identified blind spots requires type inference for class instances and basic variable/alias tracking in the AST visitor.
