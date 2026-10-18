# ChronoFork Single Source of Truth Numbers & Metrics

> **Authority Document**: All documentation files (`README.md`, `docs/blog-post.md`, `docs/evidence/phase6/claims_table.md`, `docs/demo-script.md`, `docs/QA_PREP.md`) derive their metrics strictly from this document, which is regenerated directly from raw execution logs in `docs/evidence/phase9/` and `docs/evidence/phase8/`.

---

## 1. Centrality Risk Score (load_config)

- **Calculated Risk Score**: `0.854` (formatted to exactly 3 decimals)
- **Centrality Components**:
  - PageRank ($PR$): `0.056058` (Normalized $PR = 1.0$)
  - Betweenness ($BW$): `34.0` / Max `48.0` (Normalized $BW = 0.7083$)
  - Formula: $\text{Risk} = 0.5 \times 1.0 + 0.5 \times 0.7083 = 0.854$
- **Policy Threshold**: $0.50$
- **Coordination Verdict**: `0.854 >= 0.50` $\implies$ **Policy: `SERIALIZE`** (Callee-first merge order enforced via FalkorDB `[:BLOCKED_BY]` and `[:HANDED_OFF_TO]`).

---

## 2. Pytest Verification Counts & Timing

| Scenario / Experiment | Pytest Status | Failed Tests | Passed Tests | Total Tests | Pytest-Internal Duration | Wall Clock Duration |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Naive Git Merge Experiment** | 💥 FAILED | **5** | **7** | **12** | **0.44s** (pytest-internal) | **~1.48s** (wall time: git init, branch, merge, verify) |
| **ChronoFork Serialized Verification (Scenario 1)** | ✅ PASSED | **0** | **12** | **12** | **1.09s** (pytest-internal) | **~1.7s** (wall time) |
| **Scenario 2 (Memory Guided, Adaptation)** | ✅ PASSED | **0** | **12** | **12** | **~0.32-1.1s** (pytest-internal) | **~1.5-2.0s** (wall time) |
| **Scenario 3 (Safe Parallel Subsystems)** | ✅ PASSED | **0** | **12** | **12** | **~0.30-1.0s** (pytest-internal) | **~1.5-1.9s** (wall time) |
| **Scenario 4 (Repo Isolation, Analytics)** | ✅ PASSED | **0** | **1** | **1** | **~0.15s** (pytest-internal) | **~1.2s** (wall time) |

> **Timing Distinction Rule**:
> - **Pytest-Internal Duration**: The raw execution time reported on the pytest summary line (e.g. `12 passed in 1.09s` or `5 failed, 7 passed in 0.44s`).
> - **Wall Clock Duration**: The total end-to-end elapsed time of the parent subprocess, including scratch workspace replication, Git branch creation, AST re-parsing, and disk I/O.

---

## 3. Detection Benchmark Suite (Strict Runtime Pytest Ground Truth)

- **Total Seeded Test Cases**: **58** ($N = 58$)
  - **Ground Truth Positive (Collisions)**: 38 cases
  - **Ground Truth Negative (Safe Changes)**: 20 cases
- **Benchmark Results**:
  - **True Positives (TP)**: **22** (100% on static call chains: `direct_call` 5/5, `two_hops` 4/4, `three_hops` 4/4, `four_hops` 5/5, `import_inside_function` 4/4)
  - **False Positives (FP)**: **0** (100% specificity on safe parallel changes: `unrelated_pairs` 4/4, `same_module_disjoint` 4/4, `nearby_no_call` 4/4, `body_edit_only` 4/4, `unused_function_rename` 4/4)
  - **False Negatives (FN)**: **16** (metaprogramming dynamic call patterns: `self_method` 4, `getattr_call` 4, `alias_call` 4, `dict_dispatch` 4)
  - **True Negatives (TN)**: **20**
- **Evaluation Metrics**:
  - **Precision**: $22 / (22 + 0) = \mathbf{100.0\%}$
  - **Recall**: $22 / 38 = \mathbf{57.9\%}$ overall ($100\%$ on static call chains)
  - **Specificity**: $20 / 20 = \mathbf{100.0\%}$
  - **F1 Score**: $2 \times \frac{1.0 \times 0.5789}{1.0 + 0.5789} = \mathbf{0.733}$

### Comparative Baseline Matrix

| Detector | Recall (When Collision is Known) | Specificity (When Changes are Safe) | Precision | False Positives | Mechanism |
|:---|:---:|:---:|:---:|:---:|:---|
| **Git Line Conflict (a1)** | **0.0%** (0/38) | 100.0% (20/20) | N/A | 0 | Blind to cross-file semantic dependencies |
| **Per-Branch Tests (a2)** | **0.0%** (0/38) | 100.0% (20/20) | N/A | 0 | Tests only own branch; cannot see other agent's edits |
| **Merged-Tree Tests (a3)** | **100.0%** (38/38) | 100.0% (20/20) | 100.0% | 0 | Ground truth oracle; requires merging and running full test suite |
| **ChronoFork (Graph Query)** | **57.9%** (22/38 overall, 100% static) | **100.0%** (20/20) | **100.0%** | **0** | **Pre-merge openCypher graph traversal (~1-2 ms)** |

---

## 4. Latency Accounting (Reported as Measured Ranges)

All latencies are measured from direct timer instrumentation against local FalkorDB:

| Operation | Query / Method | Latency Range | Median | Evidence Source |
|:---|:---|:---:|:---:|:---|
| **Collision Detection Query** | `(s2)-[:CALLS*1..4]->(s1)` | **~1-2 ms** (1.13 - 6.06 ms) | **1.97 ms** | `docs/evidence/phase8/benchmark_detection_stdout.txt` |
| **AST Ingest & Edge Loading** | `ingest_code_graph_to_falkordb` | **~12-13 ms** (Mean) | **12.75 ms** | `docs/evidence/phase8/benchmark_detection_stdout.txt` |
| **Claim Registration** | `(:Agent)-[:CLAIMS]->(:Symbol)` | **~3-4 ms** (Mean) | **3.41 ms** | `docs/evidence/phase8/benchmark_detection_stdout.txt` |
| **Speculative Graph Branching** | `graph.copy(clone_key)` | **~55-112 ms** (55.41 - 112.08 ms) | **108.32 ms** | `docs/evidence/phase2/falkordb_bench_stdout.txt` |
| **PageRank Centrality** | `CALL algo.pageRank('Symbol', 'CALLS')` | **~1-2 ms** (1.20 - 1.99 ms) | **1.36 ms** | `docs/evidence/phase2/falkordb_bench_stdout.txt` |
| **Betweenness Centrality** | `CALL algo.betweenness(...)` | **~1-3 ms** (1.39 - 2.60 ms) | **1.80 ms** | `docs/evidence/phase2/falkordb_bench_stdout.txt` |

---

## 5. Repository Graph Sizes

| Repository Graph | Total AST Symbols | Functions | Classes | Modules | Tests | CALLS Edges | TESTED_BY Edges |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `repo:taskflow` | **69** | 35 | 14 | 8 | 12 | **29** | **16** |
| `repo:analytics` | **14** | 6 | 3 | 3 | 2 | **5** | **2** |

---

## 6. UI Layout Geometry & Viewport Assertions

- **Chain Spacing Formula**:
  - `pad = max(110, claimChipWidth / 2 + 16)`
  - `spacing = (canvasWidth - 2 * pad) / 4`
- **1440x900 Viewport** (Canvas Width: `740px`, Valid Bounds: `[8, 732]`):
  - Every chain label bbox lies fully inside `[8, 732]` (Execute: `[74.5, 145.5]`, Config: `[595.5, 664.5]`).
  - Both claim chips lie fully inside `[8, 732]` (A1 chip: `[539.1, 720.9]`, A2 chip: `[46.4, 173.6]`).
  - Adjacent label gaps: **54px, 48px, 44px, 51px** (all $\ge 24\text{px}$).
  - Active parent module labels beneath chain: **0** (hidden via `.hide-label`).
- **1920x1080 Viewport** (Canvas Width: `1220px`, Valid Bounds: `[8, 1212]`):
  - Every chain label bbox lies fully inside `[8, 1212]` (Execute: `[74.5, 145.5]`, Config: `[1075.5, 1144.5]`).
  - Both claim chips lie fully inside `[8, 1212]` (A1 chip: `[1019.1, 1200.9]`, A2 chip: `[46.4, 173.6]`).
  - Adjacent label gaps: **174px, 168px, 164px, 171px** (all $\ge 24\text{px}$).
  - Active parent module labels beneath chain: **0** (hidden via `.hide-label`).
