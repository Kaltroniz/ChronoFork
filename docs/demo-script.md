# ChronoFork — 3-Minute Demo Video Script

**Tagline**: *"Git catches line conflicts. ChronoFork catches the ones Git can't see."*  
**Theme**: Graph-Coordinated AI Coding Swarm powered by FalkorDB  
**Tracks**: Track 1 (Agents acting on connected data) & Track 2 (Agent memory and coordination)

---

## Act 1: The Problem (0:00 – 0:40)

**[Visual]**: Split screen showing two separate files in an IDE: `config.py` and `worker.py`. A standard Git diff terminal window shows: `0 conflicts detected — Clean merge`.
**[Voiceover]**:
> "Modern AI coding agents write code in parallel, but when multiple agents touch the same repository, standard developer tooling is blind.
> In our demo repository, Agent 1 modifies `load_config` in `config.py` to return a `ConfigObject` instead of a dictionary.
> Concurrently, Agent 2 optimizes `execute_job` in `worker.py`.
> They edited completely different files across different directories with zero overlapping lines. Git flags **zero conflicts** and merges cleanly.
> But the moment you test or deploy, production crashes! `execute_job` calls `queue.dequeue_task`, which calls `auth.validate_token`, which calls `database.get_connection`, which calls `load_config`.
> That is a **deep 4-hop transitive collision** that Git cannot see."

---

## Act 2: Enter ChronoFork & The FalkorDB Brain (0:40 – 1:25)

**[Visual]**: Open ChronoFork UI at `http://localhost:5173`. Show the dark ops-console with the Cytoscape code graph, FalkorDB status indicator, query telemetry in the inspector, and agent panels.
**[Voiceover]**:
> "Meet **ChronoFork** — a graph-coordinated multi-agent coding swarm where FalkorDB serves as the shared brain.
> ChronoFork doesn't just read files as text; it uses import-aware AST parsing to compile the entire codebase into a live FalkorDB graph (`repo:taskflow`).
> Nodes represent Modules, Classes, Functions, and Tests connected by `CALLS`, `DEFINES`, `IMPORTS`, and `TESTED_BY` relationships.
> Using FalkorDB's native graph algorithms — `algo.pageRank` and `algo.betweenness` — ChronoFork instantly scores every symbol's architectural scarcity and risk in milliseconds.
> Every Cypher query executed is recorded with exact millisecond timings, row counts, and parameters in our live telemetry inspector."

---

## Act 3: Scenario 1 — Hidden Collision, Real Git Merge Failure & Serialization (1:25 – 2:15)

**[Visual]**: Click button **1. Hidden Collision**. Click **Run Swarm**.
The Cytoscape graph pulses. Agent 1 claims `load_config` (blue persistent halo, `SIGNATURE_CHANGE`). Agent 2 claims `execute_job` (amber persistent halo, `BODY_EDIT`).
FalkorDB executes native multi-hop collision detection.
The 4-hop path `worker.execute_job -> queue.dequeue_task -> auth.validate_token -> database.get_connection -> config.load_config` animates hop-by-hop and glows bright red.
The UI Bottom Drawer shows the **Real Naive Git Merge Experiment**: Git merged cleanly with exit code 0, but running real `pytest` failed with 5 errors (`TypeError: 'ConfigObject' object is not subscriptable`).
Then ChronoFork resolves it: sets `BLOCKED_BY` and `HANDED_OFF_TO` edges, serializes execution in callee-first order, applies patches, and Verifier runs real `pytest`: 12 passed!
**[Voiceover]**:
> "Watch what happens when the Planner assigns both agents concurrently.
> Agent 1 claims `load_config` with intent `SIGNATURE_CHANGE`.
> Agent 2 claims `execute_job` with `BODY_EDIT`.
> ChronoFork runs a native multi-hop openCypher query: `(s2)-[:CALLS*1..4]->(s1)`.
> In under 2 milliseconds, FalkorDB uncovers the 4-hop call chain spanning four separate modules.
> To prove the danger, ChronoFork runs a real Git merge experiment in an isolated sandbox: Git merges both branches with zero conflicts, but pytest crashes immediately with 5 test failures!
> ChronoFork's graph coordinator steps in: because `load_config` has high PageRank risk (0.85), it writes a `BLOCKED_BY` edge and serializes execution. ConfigCoder completes its patch, passes its tests in an isolated workspace, hands off execution via a `HANDED_OFF_TO` edge, and then WorkerCoder runs.
> The result? All 12 unit tests pass cleanly!"

---

## Act 4: Scenario 2 & 3 — Cross-Run Memory & Safe Parallelism (2:15 – 2:50)

**[Visual]**: Click **2. Memory Avoidance**. Show the **Memory ON/OFF** toggle in the Control Panel.
With Memory ON, click **Run Swarm**. Show ConfigCoder recalling the `ProceduralRule` from `mem:taskflow` with 90% confidence.
The agent adapts its intent from `SIGNATURE_CHANGE` to `BODY_EDIT` (maintaining dictionary backwards compatibility).
Collision check passes with 0 collisions.
Now flip the **Memory Toggle to OFF** and rerun: without memory, the collision immediately reappears!
Next, click **3. Safe Parallel**. Agents on `taskflow` core and the `reports/` subsystem run simultaneously with green `PARALLEL_OK` status.
**[Voiceover]**:
> "Here is Track 2 in action: Cross-run episodic memory in `mem:taskflow`.
> When run 1 succeeded, ChronoFork recorded an `Episode` and forged a `ProceduralRule`.
> On run 2, with Memory ON, ConfigCoder queries FalkorDB memory, recalls the past collision advice, and proactively adapts its intent to maintain backward compatibility. Collision avoided before any code was written!
> If you toggle Memory OFF to test it, the swarm forgets and the collision immediately returns — proving memory directly drives agent behavior.
> In Scenario 3, when agents work on disjoint subsystems like `reports/`, FalkorDB confirms zero path intersections (`PARALLEL_OK`), allowing agents to execute concurrently without false blockages."

---

## Act 5: Architecture, Cloud Ready & Conclusion (2:50 – 3:00)

**[Visual]**: Show FalkorDB Cloud settings in `.env.example`, Cypher inspector live traces, and the Memory Reset button.
**[Voiceover]**:
> "Every capability is fully cloud-ready with FalkorDB Cloud TLS authentication, exposed via 7 official FastMCP tools, and validated by real workspace pytest execution.
> If you take FalkorDB away, ChronoFork stops working. FalkorDB isn't a decorative database — it is the coordination brain of the swarm.
> ChronoFork: Git catches line conflicts. ChronoFork catches the ones Git can't see."
