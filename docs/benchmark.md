# ChronoFork Collision Detection Benchmark Report

> **Evaluation Date**: 2026-10-17  
> **Random Seed**: `2026`  
> **Dataset**: $N = 58$ seeded test cases (38 ground-truth collisions, 20 ground-truth safe cases)  
> **Evidence Artifacts**: [`docs/evidence/phase3b/benchmark_results.csv`](docs/evidence/phase3b/benchmark_results.csv), [`docs/evidence/phase3b/benchmark_results.json`](docs/evidence/phase3b/benchmark_results.json), [`docs/evidence/phase3b/benchmark_stdout.txt`](docs/evidence/phase3b/benchmark_stdout.txt)

---

## 1. Methodology & Evaluation Protocol

### Ground Truth from Execution (Not Graph Assumption)
To avoid circular reasoning where graph queries label their own detections as ground truth, **ground truth is defined strictly by real runtime execution**:
1. For each test case, an isolated scratch workspace is created with base modules (`pkg/callee.py`, `pkg/caller.py`) and a unit test runner (`test_suite.py`).
2. **Patch A (Agent 1)** modifies symbol $F$ (e.g. adding a mandatory argument or editing internal body). Verified that Patch A alone passes its local specification.
3. **Patch B (Agent 2)** modifies symbol $G$ (calling $F$ with old signature or performing caller operations). Verified that Patch B alone passes on the baseline code.
4. Both patches are applied to a merged tree and executed under `pytest`:
   - **Ground Truth POSITIVE (True Collision)**: Patch A alone passes, Patch B alone passes, but the combined merged execution raises a runtime error (`TypeError`).
   - **Ground Truth NEGATIVE (Safe / Non-Colliding)**: Both changes pass independently and the merged code passes runtime execution with zero errors.

### Compared Detectors: A Question of WHEN, Not Just IF
The benchmark compares four detection mechanisms across the agent lifecycle:

1. **(a1) Git text conflict only**:
   - Evaluated at merge time based strictly on file/line conflicts. In all 58 cases, $F$ and $G$ reside in different functions or separate files. Git merges with zero text conflicts (`exit code 0`).
2. **(a2) Per-branch repo tests**:
   - Evaluated pre-merge on each agent's isolated branch. **(a2) is 0% recall by construction**: tests running on Branch A only execute code in Branch A; tests running on Branch B only execute code in Branch B. Neither branch test ever executes the cross-branch unmerged code, making transitive collisions structurally invisible prior to landing.
3. **(a3) Repo tests on the MERGED tree**:
   - Evaluated **post-merge** after both agents have completely finished generating code and landing their commits.
   - **Important note on methodology**: Because ground truth is defined by merged-tree `pytest` execution, **(a3) equals ground truth by construction (100% recall post-merge)**. The comparison between ChronoFork and (a3) is **NOT** about whether tests eventually fail; it is about **WHEN** the collision is discovered:
     - **ChronoFork**: Discovers the collision at **claim time** before agents write code, enabling serialized coordination or intent adaptation.
     - **(a3)**: Discovers the collision only **post-merge** after both agents wasted compute writing conflicting code, breaking CI.
4. **(b) ChronoFork (FalkorDB)**:
   - Ingests repository AST into FalkorDB.
   - Records claims on $F$ and $G$ before code generation.
   - Executes the exact multi-hop openCypher collision query verbatim from [`backend/app/coordinator.py:160-170`](backend/app/coordinator.py#L160-L170):
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

---

## 2. Benchmark Summary Table (First-Run Numbers)

*Note: In accordance with benchmark rules, parser and Cypher queries were NOT modified after viewing test runs. First-run numbers are reported honestly.*

| Detector | When Collision is Known | TP | FP | FN | TN | Precision | Recall |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **(a1) Git text conflict only** | Merge time (text only) | 0 | 0 | 38 | 20 | **0.0%** | **0.0%** |
| **(a2) Per-branch repo tests** | Pre-merge (isolated branch) | 0 | 0 | 38 | 20 | **0.0%** | **0.0%*** |
| **(a3) Merged-tree repo tests** | Post-merge (runtime CI) | 38 | 0 | 0 | 20 | **100.0%** | **100.0%** |
| **(b) ChronoFork (FalkorDB)** | **Claim time (pre-code)** | **22** | **0** | **16** | **20** | **100.0%** | **57.9%** |

*\*Note: (a2) is 0% recall by construction because tests on an isolated branch never execute unmerged cross-branch changes.*

---

## 3. Headline Per-Pattern Breakdown

| Pattern Group | Pattern | Total Cases | Ground Truth Collisions | ChronoFork Detected | ChronoFork Recall | Detection Status |
|---|---|:---:|:---:|:---:|:---:|---|
| **Positive (Collision)** | `direct_call` ($k=1$) | 5 | 5 | 5 | **100%** | **DETECTED** |
| **Positive (Collision)** | `two_hops` ($k=2$) | 4 | 4 | 4 | **100%** | **DETECTED** |
| **Positive (Collision)** | `three_hops` ($k=3$) | 4 | 4 | 4 | **100%** | **DETECTED** |
| **Positive (Collision)** | `four_hops` ($k=4$) | 5 | 5 | 5 | **100%** | **DETECTED** |
| **Positive (Collision)** | `import_inside_function` | 4 | 4 | 4 | **100%** | **DETECTED** |
| **Positive (Collision)** | `self_method` | 4 | 4 | 0 | **0%** | **BLIND SPOT** |
| **Positive (Collision)** | `getattr_call` | 4 | 4 | 0 | **0%** | **BLIND SPOT** |
| **Positive (Collision)** | `alias_call` | 4 | 4 | 0 | **0%** | **BLIND SPOT** |
| **Positive (Collision)** | `dict_dispatch` | 4 | 4 | 0 | **0%** | **BLIND SPOT** |
| **Negative (Safe)** | `unrelated_pairs` | 4 | 0 | 0 (TN=4) | **100% Spec** | **SAFE (NO FP)** |
| **Negative (Safe)** | `same_module_disjoint` | 4 | 0 | 0 (TN=4) | **100% Spec** | **SAFE (NO FP)** |
| **Negative (Safe)** | `nearby_no_call` | 4 | 0 | 0 (TN=4) | **100% Spec** | **SAFE (NO FP)** |
| **Negative (Safe)** | `body_edit_only` | 4 | 0 | 0 (TN=4) | **100% Spec** | **SAFE (NO FP)** |
| **Negative (Safe)** | `unused_function_rename` | 4 | 0 | 0 (TN=4) | **100% Spec** | **SAFE (NO FP)** |

---

## 4. Breakdown of Negatives (20 Total Cases, 0 False Positives)

The 20 ground-truth negative cases evaluate two distinct filtering mechanisms in ChronoFork:

### Category A: Negative by Intent Rule (4 Cases)
- **`body_edit_only` (4 Cases)**: A direct call path exists ($G \to F$, 1 hop), but Agent 1 claims $F$ with intent `BODY_EDIT` (refactoring internal logic while preserving signature compatibility).
- **Coordinator Filter**: `WHERE c1.intent IN ['SIGNATURE_CHANGE', 'DELETE']` evaluates to `false`.
- **Verdict**: 0 collisions returned. Correctly recognized as non-breaking concurrent work.

### Category B: Negative by Graph Reachability (16 Cases)
- **`unrelated_pairs` (4 Cases)**: $F$ and $G$ reside in independent modules with zero connecting edges.
- **`same_module_disjoint` (4 Cases)**: $F$ and $G$ reside in the same module (`pkg.callee`), but neither calls the other.
- **`nearby_no_call` (4 Cases)**: $F$ and $G$ both call a shared utility (`shared_tool`), but neither calls each other (sibling callers). Zero directed paths exist from $G$ to $F$.
- **`unused_function_rename` (4 Cases)**: $F$ is an uncalled utility; Agent 1 renames it while Agent 2 edits $G$. Zero paths exist.
- **Coordinator Traversal**: `MATCH path = (s2)-[:CALLS*1..4]->(s1)` yields 0 rows.
- **Verdict**: 0 collisions returned. **Zero False Positives ($FP = 0, TN = 20$)**.

---

## 5. Latency Accounting & Graph Metrics

### Latency Scope (Included vs Excluded)
- **Collision Query Latency**: Evaluates purely the FalkorDB openCypher traversal query execution time (`MATCH (a1)-[:CLAIMS]... MATCH path=(s2)-[:CALLS*1..4]->(s1)...`).
  - **Min**: `0.64 ms`
  - **Median**: `1.37 ms`
  - **Max**: `2.04 ms`
  - *Excludes*: AST repository parsing, graph ingestion, and claim edge writes.
- **Auxiliary System Times**:
  - **AST Parsing & Ingestion Latency**: Mean = `8.33 ms` (one-time cost per repository commit).
  - **Claim Write Latency**: Mean = `1.48 ms` (two Cypher `CREATE [:CLAIMS]` transactions).
- **Scale Comparison**: The synthetic benchmarks run on 8–11 node graphs with 1.37 ms median query latency. On the full 69-node, 109-edge `repo:taskflow` graph, the same multi-hop collision query executes in **0.76 ms median** (see `docs/evidence/phase2/falkordb_bench_stdout.txt`), demonstrating that index-backed openCypher traversal scales sub-linearly with graph size.

### Graph Sizes per Pattern Group
- `direct_call`: Avg Nodes = 8.0, Avg CALLS Edges = 1.0
- `two_hops`: Avg Nodes = 9.0, Avg CALLS Edges = 2.0
- `three_hops`: Avg Nodes = 10.0, Avg CALLS Edges = 3.0
- `four_hops`: Avg Nodes = 11.0, Avg CALLS Edges = 4.0
- `self_method`: Avg Nodes = 9.0, Avg CALLS Edges = 1.0
- `getattr_call`: Avg Nodes = 8.0, Avg CALLS Edges = 0.0
- `alias_call`: Avg Nodes = 8.0, Avg CALLS Edges = 0.0
- `dict_dispatch`: Avg Nodes = 8.0, Avg CALLS Edges = 0.0
- `import_inside_function`: Avg Nodes = 8.0, Avg CALLS Edges = 1.0
- `unrelated_pairs`: Avg Nodes = 8.0, Avg CALLS Edges = 0.0
- `same_module_disjoint`: Avg Nodes = 8.0, Avg CALLS Edges = 0.0
- `nearby_no_call`: Avg Nodes = 9.0, Avg CALLS Edges = 2.0
- `body_edit_only`: Avg Nodes = 8.0, Avg CALLS Edges = 1.0
- `unused_function_rename`: Avg Nodes = 8.0, Avg CALLS Edges = 0.0

---

## 6. Detailed Analysis of Misses & Limitations

### Why `self_method` is Missed Despite a CALLS Edge (Cases 17–20)
In `self_method`, caller `pkg.caller.caller_func_17` instantiates `worker = ServiceWorker()` and calls `worker.target_func_17()`.
- **Target Claimed**: Agent 1 claims `pkg.callee.ServiceWorker.target_func_17`.
- **Actual Edge in Code Graph**: The AST visitor resolves the constructor instantiation and records an edge:
  `('pkg.caller.caller_func_17', 'pkg.callee.ServiceWorker')`
- **Root Cause**: The CALLS edge points to the **Class** symbol `ServiceWorker`, not the **Method** symbol `ServiceWorker.target_func_17`. Without receiver type inference, the static visitor does not know that `worker` is an instance of `ServiceWorker`, so no edge connects `caller_func_17` to `target_func_17`.
- When querying `MATCH path = (s2)-[:CALLS*1..4]->(s1)` where `s1` is the method, 0 rows are returned.

### Additional Static Blind Spots (12 Misses)
1. **Dynamic Attribute Lookup (`getattr_call`, Cases 21–24)**: `getattr(mod, 'target_func')()` resolves targets dynamically via string lookup.
2. **Table-Driven Dynamic Dispatch (`dict_dispatch`, Cases 29–32)**: Handlers registered in dictionary tables (`DISPATCH['op']()`) are parsed as subscript calls without dictionary constant propagation.
3. **Identifier Aliasing (`alias_call`, Cases 25–28)**: Variable assignments (`alias = func; alias()`) are not aliased across symbol tables by the AST visitor.

### Critical Benchmark Limitations
> [!WARNING]
> 1. **Synthetic Corpus Limitation**: All 58 test cases were synthetically authored by the implementation team and are not independent of the AST parser implementation.
> 2. **Max Hop Depth Bound**: The coordinator query uses `[:CALLS*1..4]`. Any transitive dependency chain of length $k \ge 5$ hops is structurally invisible to ChronoFork unless the query depth bound is increased.
> 3. **Signature Breaks Only**: Ground truth tests evaluate breaking signature modifications (`TypeError`). Semantic contract regressions (e.g., changes in return value invariants, side effects, or database schema assumptions) without signature alterations are not evaluated by this benchmark.
