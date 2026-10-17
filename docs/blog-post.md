# Git Catches Line Conflicts. ChronoFork Catches the Ones Git Can't See.

*Building a Graph-Coordinated AI Coding Swarm Powered by FalkorDB for Graph Hacks 2026*

---

## The Silent Killer of Multi-Agent Coding

Imagine deploying an autonomous swarm of AI software engineers to your repository. Agent 1 is assigned to refactor configuration loading, while Agent 2 is tasked with optimizing background worker throughput.

They work concurrently. Agent 1 modifies `load_config` in `taskflow/config.py` so it returns a strongly-typed `ConfigObject`. Agent 2 adds retry logic to `execute_job` in `taskflow/worker.py`. 

Both agents commit their work and run `git merge`.

Git reports:
```text
Merge made by the 'ort' strategy.
0 line conflicts detected — Clean merge!
```

Git is happy. The CI pipeline initiates. And then **production crashes**:
```text
TypeError: 'ConfigObject' object is not subscriptable
FAILED tests/test_worker.py::test_execute_job_authorized
FAILED tests/test_auth.py::test_validate_token_valid
FAILED tests/test_auth.py::test_validate_token_invalid
```

Why did this happen?

Because `execute_job` in `worker.py` calls `queue.dequeue_task` in `queue.py`, which calls `auth.validate_token` in `auth.py`, which calls `database.get_connection` in `database.py`, which calls `config.load_config` in `config.py`.

This is a **4-hop transitive semantic collision** across four distinct modules. Because the two agents edited different files on different lines, standard version control was completely blind to the architectural blast radius.

**Git catches line conflicts. ChronoFork catches the ones Git can't see.**

---

## Enter ChronoFork: FalkorDB as the Swarm Brain

**ChronoFork** is an autonomous multi-agent coding swarm coordinator built for the **FalkorDB Graph Hacks Hackathon** under both **Track 1 (Agents That Act on Connected Data)** and **Track 2 (Agent Memory and Coordination)**.

Instead of treating code as dumb text files, ChronoFork compiles Python repositories into a live Abstract Syntax Tree (AST) code graph in **FalkorDB**. Every module, class, function, and test suite becomes a first-class graph citizen:

- Nodes: `(:Symbol:Module)`, `(:Symbol:Class)`, `(:Symbol:Function)`, `(:Symbol:Test)`
- Edges: `[:DEFINES]`, `[:IMPORTS]`, `[:CALLS]`, `[:TESTED_BY]`

```mermaid
flowchart LR
    Worker["worker.execute_job"] -->|CALLS| Queue["queue.dequeue_task"]
    Queue -->|CALLS| Auth["auth.validate_token"]
    Auth -->|CALLS| DB["database.get_connection"]
    DB -->|CALLS| Cfg["config.load_config"]
    
    style Worker fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff
    style Cfg fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff
    style Queue fill:#1e293b,stroke:#475569,stroke-width:1px,color:#fff
    style Auth fill:#1e293b,stroke:#475569,stroke-width:1px,color:#fff
    style DB fill:#1e293b,stroke:#475569,stroke-width:1px,color:#fff
```

By maintaining the code graph and swarm coordination entities inside FalkorDB, ChronoFork accomplishes what relational databases and vector stores cannot: **single-digit millisecond multi-hop transitive collision detection and architectural risk evaluation**.

---

## Why FalkorDB is Irreplaceable (No Decorative Graph)

A hackathon rule we took to heart is: *FalkorDB must be the irreplaceable core of the product. If it is removed, the product must stop working.*

Here is why ChronoFork cannot exist without FalkorDB:

### 1. Variable-Length Transitive Traversals (`0.76 ms` median)
Detecting transitive collisions requires discovering whether Agent 2's target calls Agent 1's target up to arbitrary depths. In SQL, this requires recursive Common Table Expressions (CTEs) with repeated self-joins that become computationally prohibitive as call trees branch. In FalkorDB, openCypher traverses arbitrary depths in **0.76 ms** (median on repo:taskflow):

```cypher
MATCH (a1:Agent)-[c1:CLAIMS]->(s1:Symbol),
      (a2:Agent)-[c2:CLAIMS]->(s2:Symbol)
WHERE a1.id <> a2.id
  AND c1.intent IN ['SIGNATURE_CHANGE', 'DELETE']
MATCH path = (s2)-[:CALLS*1..4]->(s1)
RETURN a1.id AS agent_a, a2.id AS agent_b,
       [n IN nodes(path) | n.qualname] AS path_nodes,
       length(path) AS hops
```

### 2. In-Memory PageRank & Betweenness Centrality (`1.36 ms` & `1.80 ms` median)
Not all collisions carry equal risk. Modifying an internal helper function on a leaf node is low danger; modifying a foundational module sitting at the bottleneck of the entire system threatens catastrophic failure.
FalkorDB executes graph algorithms directly in Redis memory without exporting data to external graph engines:
- `CALL algo.pageRank('Symbol', 'CALLS')`: Computes structural prominence across all 69 symbols in **1.36 ms** (median on repo:taskflow).
- `CALL algo.betweenness({nodeLabels: ['Symbol'], relationshipTypes: ['CALLS']})`: Identifies bridge functions on the shortest paths in **1.80 ms** (median on repo:taskflow).

### 3. Fast Speculative Graph Branching (`108.3 ms` median)
Before an agent writes a single line of physical code, it forks the repository graph using FalkorDB's native `GRAPH.COPY` (`graph.copy(clone_key)` in **108.32 ms** median on repo:taskflow). The agent speculatively modifies the function's AST signature, re-runs PageRank and reverse `CALLS` queries on the fork, and calculates its exact blast radius without impacting other agents.

---

## Track 1: Agents That Act on Connected Data

ChronoFork agents don't guess — they traverse connected graph structures at every phase of execution:

1. **Reverse Impact Analysis**:
   When an agent targets `config.load_config`, FalkorDB executes a reverse traversal along incoming `CALLS` and `TESTED_BY` edges:
   ```cypher
   MATCH (target:Symbol {qualname: $qualname})
   OPTIONAL MATCH path = (caller:Symbol)-[:CALLS*1..4]->(target)
   OPTIONAL MATCH (target)<-[:TESTED_BY]-(direct_test:Test)
   OPTIONAL MATCH (caller)<-[:TESTED_BY]-(transitive_test:Test)
   RETURN collect(DISTINCT caller.qualname) AS dependent_callers,
          collect(DISTINCT direct_test.qualname) + collect(DISTINCT transitive_test.qualname) AS affected_tests
   ```
   Within 1.13 ms (median 0.76 ms), the agent knows that altering `load_config` impacts 7 callers across 4 modules and threatens 5 unit test suites.

2. **Centrality-Driven Risk Scoring**:
   ChronoFork combines PageRank ($PR$) and Betweenness ($BW$) into a normalized risk metric ($0.0 \le \text{Risk} \le 1.0$). If a symbol's risk exceeds $0.50$, the Coordinator refuses optimistic parallel merges and elevates the coordination policy to `SERIALIZE`.

3. **Speculative Fork Simulation**:
   Using `fork:<run_id>:<agent_id>`, an agent parses its proposed patch with Python's AST parser, computes the updated SHA-256 signature hash, compares before and after risk scores, and streams telemetry to the operator before touching the file system.

---

## Track 2: Agent Memory and Coordination

### Unified Coordination Graph (`coord:<run_id>`)
At run start, FalkorDB clones the repository into `coord:<run_id>`. Coordination entities (`:Run`, `:Agent`) attach directly to the AST code `:Symbol` nodes via `[:CLAIMS]` edges.

When Agent 1 claims `load_config` and Agent 2 claims `worker.execute_job`, the Coordinator detects the 4-hop call path and evaluates the policy:
- `load_config` Risk = $0.8542 \ge 0.50$ $\implies$ **Policy: SERIALIZE**.
- FalkorDB writes an explicit blocking edge:
  `(:WorkerCoder)-[:BLOCKED_BY]->(:ConfigCoder)`

### Graph-Computed Merge Order
Rather than hardcoding execution sequences, ChronoFork calculates the optimal merge order dynamically via an openCypher query:
```cypher
MATCH (a:Agent)-[c:CLAIMS]->(s:Symbol)
OPTIONAL MATCH (s)<-[:CALLS*1..4]-(s_caller:Symbol)<-[:CLAIMS]-(a_caller:Agent)
RETURN a.id AS agent_id, a.name AS agent_name, s.qualname AS symbol, count(s_caller) AS depth
ORDER BY depth DESC
```
This guarantees dependencies (callees) are patched, verified, and merged before callers run.

### Track 2 Handoff Edges
When ConfigCoder completes its patch in its isolated workspace, the Coordinator executes:
```cypher
MATCH (a1:Agent {id: 'agent_1'}), (a2:Agent {id: 'agent_2'})
MATCH (a2)-[b:BLOCKED_BY]->(a1)
DELETE b
CREATE (a1)-[:HANDED_OFF_TO {reason: 'Contract verified with pytest'}]->(a2)
```
The handoff is persisted as a visible graph relationship in FalkorDB.

### Cross-Run Episodic Memory & Dynamic Heuristic Confidence
In `mem:<repo>`, ChronoFork persists historical episodes and procedural rules:
- `(:Episode)-[:INVOLVED]->(:Symbol)`
- `(:ProceduralRule)-[:INVOLVED]->(:Symbol)`

Each procedural rule stores actionable advice, a `recommended_intent` (`BODY_EDIT`), and a confidence score ($0.10 \le C \le 0.99$):
- Rule: *"load_config signature changes break transitive caller worker.execute_job (4 hops via database, auth, queue)"*
- Advice: *"Maintain backward-compatible dictionary access or serialize execution."*
- Recommended Intent: `BODY_EDIT`

When the swarm completes a run successfully, rule confidence rises ($+0.10$); on failure, confidence drops ($-0.20$).

On subsequent runs, agents execute `recall_memory` upfront. In **Scenario 2**, ConfigCoder recalls the rule with 95% confidence and **proactively adapts its claim** from `SIGNATURE_CHANGE` to `BODY_EDIT`. The collision check reports 0 collisions, allowing concurrent execution!

To prove this memory actively dictates agent behavior, the ChronoFork UI includes a **Memory ON/OFF toggle**:
- **Memory ON**: Recalls lesson, adapts intent, 0 collisions.
- **Memory OFF**: Swarm forgets, claims colliding signatures, and the 4-hop collision returns immediately!

---

## Real Execution: Proving Git's Blind Spot

We refused to present scripted results or mocked pytest strings. Every scenario in ChronoFork executes real code, real Git merges, and real subprocess pytests in isolated workspaces:

| Coordination Strategy | Git Merge Status | Real Pytest Verification | Outcome |
| :--- | :---: | :---: | :---: |
| **Naive Git Merge** | `0 line conflicts` (Exit 0) | **5 FAILED**, 7 PASSED | 💥 **Silent Production Crash** |
| **ChronoFork Serialized** | Callee-First Graph Order | **12 PASSED**, 0 FAILED | ✅ **Clean Zero-Defect Production** |

```
============================= test session starts ==============================
rootdir: /tmp/chronofork_naive_git_sandbox
tests/test_auth.py::test_validate_token_valid FAILED                     [  8%]
tests/test_auth.py::test_validate_token_invalid FAILED                   [ 16%]
tests/test_config.py::test_get_default_config PASSED                     [ 25%]
tests/test_config.py::test_load_config_default FAILED                    [ 33%]
tests/test_config.py::test_compute_config_signature PASSED               [ 41%]
tests/test_database.py::test_get_connection FAILED                       [ 50%]
tests/test_database.py::test_save_and_get_result PASSED                  [ 58%]
tests/test_models.py::test_create_job_result PASSED                      [ 66%]
tests/test_queue.py::test_dequeue_task_unauthorized PASSED               [ 75%]
tests/test_queue.py::test_dequeue_task_authorized FAILED                 [ 83%]
tests/test_worker.py::test_execute_job_unauthorized PASSED               [ 91%]
tests/test_worker.py::test_execute_job_completed FAILED                  [100%]
========================= 5 failed, 7 passed in 0.88s =========================
```

In the ChronoFork console, the **Verifier Tab** displays this exact comparison side-by-side, giving judges and engineers instant proof of the value proposition.

---

## Real-Time Cypher Telemetry & Ops Console

ChronoFork features a high-performance dark console built with **React 19**, **Cytoscape.js**, and **TailwindCSS**:

1. **Persistent Agent Halos**: Claimed nodes maintain vibrant glow halos (`agent_1` blue, `agent_2` amber) across the entire run so operators can visualize agent territorial blast radii simultaneously.
2. **Compound Module Clustering**: Symbols are grouped into visual container clusters corresponding to their Python files (`taskflow.config`, `taskflow.worker`, etc.).
3. **Hop-by-Hop Collision Animation**: When a collision is uncovered, the canvas animates each hop of the path sequentially in pulsing red.
4. **Live Cypher Telemetry Inspector**: Every single query executed against FalkorDB is captured with its exact latency in milliseconds, parameter payload, row count, and returned row previews.

---

## 7 Standardized FastMCP Tools

ChronoFork exposes its entire coordination engine through 7 official Model Context Protocol (MCP) tools:

1. `get_impact(repo_name, qualname, max_hops=4)`
2. `rank_risk(repo_name)`
3. `claim_symbols(run_id, agent_id, qualnames, intent, reason)`
4. `detect_collisions(run_id)`
5. `fork_graph(run_id, agent_id, repo_name)`
6. `recall_memory(repo_name, symbol_qualnames)`
7. `record_episode(repo_name, run_id, task, outcome, summary, involved_symbols, rule_learned)`

External AI coding agents running in Cursor, Claude Desktop, or custom orchestrators can connect directly to ChronoFork's MCP server and participate in graph-coordinated swarms.

---

## Benchmarks & Verification

All benchmarks measured live using `scripts/verify_phase0.py` and real subprocess pytests in `scripts/verify_item1.py`:

- **Graph Cloning (`GRAPH.COPY`)**: `36.50 ms – 84.81 ms`
- **PageRank Centrality (`algo.pageRank`)**: `19.30 ms – 21.73 ms`
- **Betweenness Centrality (`algo.betweenness`)**: `7.67 ms – 13.62 ms`
- **Variable-Length Path Traversal (`CALLS*1..4`)**: `4.12 ms – 4.31 ms`
- **Shortest Path Calculation (`algo.SPpaths`)**: `2.02 ms – 4.30 ms`
- **Real Pytest Verification (Merged Workspace)**: `12 passed in 0.45s`

---

## Summary

Multi-agent software engineering cannot scale with 1970s line-based diff tools. Code is a deeply interconnected directed graph of calls, imports, type signatures, and test suites.

By placing FalkorDB at the center of the agent swarm, **ChronoFork bridges the gap between text files and semantic reality**.

- **Repository**: [github.com/Kaltroniz/ChronoFork](https://github.com/Kaltroniz/ChronoFork)
- **Tagline**: *"Git catches line conflicts. ChronoFork catches the ones Git can't see."*
