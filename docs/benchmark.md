# ChronoFork Collision Detection Benchmark Report

> **Evaluation Date**: 2026-10-17  
> **Random Seed**: `2026`  
> **Dataset**: $N = 58$ seeded test cases (38 ground-truth collisions, 20 ground-truth safe cases)  
> **Evidence Artifacts**: [`docs/evidence/phase3b/benchmark_results.csv`](file:///Users/souhardya/ChronoFork/docs/evidence/phase3b/benchmark_results.csv), [`docs/evidence/phase3b/benchmark_results.json`](file:///Users/souhardya/ChronoFork/docs/evidence/phase3b/benchmark_results.json), [`docs/evidence/phase3b/benchmark_stdout.txt`](file:///Users/souhardya/ChronoFork/docs/evidence/phase3b/benchmark_stdout.txt)

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
   - Evaluated pre-merge on each agent's isolated branch. Agent 1 runs local tests (passes); Agent 2 runs local tests (passes). Cross-branch semantic incompatibility is **invisible** before code lands.
3. **(a3) Repo tests on the MERGED tree**:
   - Evaluated **post-merge** after both agents have completely finished generating code and landing their commits.
   - **Important note on methodology**: Because ground truth is defined by merged-tree `pytest` execution, **(a3) equals ground truth by construction (100% recall post-merge)**. The comparison between ChronoFork and (a3) is **NOT** about whether tests eventually fail; it is about **WHEN** the collision is discovered:
     - **ChronoFork**: Discovers the collision at **claim time** before agents write code, enabling serialized coordination or intent adaptation.
     - **(a3)**: Discovers the collision only **post-merge** after both agents wasted compute writing conflicting code, breaking CI.
4. **(b) ChronoFork (FalkorDB)**:
   - Ingests repository AST into FalkorDB.
   - Records claims on $F$ and $G$ before code generation.
   - Executes the exact multi-hop openCypher collision query from [`backend/app/coordinator.py`](file:///Users/souhardya/ChronoFork/backend/app/coordinator.py#L160-L170).

---

## 2. Benchmark Summary Table (First-Run Numbers)

*Note: In accordance with benchmark rules, parser and Cypher queries were NOT modified after viewing test runs. First-run numbers are reported honestly.*

| Detector | When Collision is Known | TP | FP | FN | TN | Precision | Recall |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **(a1) Git text conflict only** | Merge time (text only) | 0 | 0 | 38 | 20 | **0.0%** | **0.0%** |
| **(a2) Per-branch repo tests** | Pre-merge (isolated branch) | 0 | 0 | 38 | 20 | **0.0%** | **0.0%** |
| **(a3) Merged-tree repo tests** | Post-merge (runtime CI) | 38 | 0 | 0 | 20 | **100.0%** | **100.0%** |
| **(b) ChronoFork (FalkorDB)** | **Claim time (pre-code)** | **22** | **0** | **16** | **20** | **100.0%** | **57.9%*** |

*\*Aggregate recall reflects the specific synthetic pattern mix (42% deliberately chosen static-analysis blind spots). See Headline Per-Pattern Recall below.*

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

### False Positive Analysis
- **False Positives**: **0** across all 20 negative cases ($FP = 0$, $TN = 20$).
- ChronoFork never flagged safe edits (e.g. sibling callers of a shared tool, independent functions in the same module, or backward-compatible `BODY_EDIT` changes) as collisions.

---

## 4. Latency Accounting & Graph Metrics

### Latency Scope (What is Included vs Excluded)
- **Collision Query Latency**: Evaluates purely the FalkorDB openCypher traversal query (`MATCH (a1)-[:CLAIMS]... MATCH path=(s2)-[:CALLS*1..4]->(s1)...`).
  - **Min**: `0.64 ms`
  - **Median**: `1.37 ms`
  - **Max**: `2.04 ms`
  - *Excludes*: AST parsing, initial FalkorDB code graph ingestion, and agent claim creation.
- **AST Parsing & Ingestion Latency**: Mean = `8.33 ms` (one-time cost per commit).
- **Claim Write Latency**: Mean = `1.48 ms` (two Cypher `CREATE [:CLAIMS]` queries).

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
- `same_module_disjoint`: Avg Nodes = 8.0, Avg CALLS Edges = 0.0
- `nearby_no_call`: Avg Nodes = 9.0, Avg CALLS Edges = 2.0
- `body_edit_only`: Avg Nodes = 8.0, Avg CALLS Edges = 1.0
- `unused_function_rename`: Avg Nodes = 8.0, Avg CALLS Edges = 0.0

---

## 5. Honest Blind Spot Analysis & Benchmark Limitations

### Identified Blind Spots (16 Misses out of 38 Collisions)
1. **Dynamic Attribute Lookup (`getattr_call`, Cases 21–24)**: `getattr(mod, 'target_func')()` resolves targets dynamically at runtime via strings; static AST parsing does not construct a `:CALLS` edge.
2. **Table-Driven Dynamic Dispatch (`dict_dispatch`, Cases 29–32)**: Handlers registered in dictionary structures (`DISPATCH = {'op': func}; DISPATCH['op']()`) are parsed as subscript calls without dictionary constant propagation.
3. **Identifier Aliasing (`alias_call`, Cases 25–28)**: Variable assignments (`alias = func; alias()`) are not aliased across symbol tables by the simple AST visitor.
4. **Instance Method Resolution (`self_method`, Cases 17–20)**: Class instance calls (`worker.target_func()`) require receiver type inference to link `worker` to `ServiceWorker.target_func`.

### Critical Benchmark Limitations
> [!WARNING]
> **Synthetic Pattern Limitation**: All 58 test cases in this benchmark are synthetic modules designed and written by the project team. They are **not independent** of the parser's design. The 57.9% aggregate recall is directly a function of our deliberate 50/50 split between static call chains and dynamic Python metaprogramming patterns. In production codebases dominated by standard static imports and function calls, real-world recall will be substantially higher; in heavily dynamic frameworks (e.g. Django ORM, Celery dispatchers), static recall will encounter these documented blind spots.
