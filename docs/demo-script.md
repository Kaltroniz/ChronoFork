# ChronoFork — 3-Minute Demo Video Script

**Tagline**: *"Git catches line conflicts. ChronoFork catches the ones Git can't see."*  
**Theme**: Graph-Coordinated AI Coding Swarm powered by FalkorDB  
**Tracks**: Track 1 (Agents acting on connected data) & Track 2 (Agent memory and coordination)  
**Total Target Runtime**: 2 minutes 50 seconds (<= 3:00 max)

---

## 🎬 Shot List & Narrative Breakdown

### Shot 1: The Problem — Git's Silent Blind Spot (0:00 – 0:35 | 35s)
- **UI View**: Split screen: VS Code showing `taskflow/config.py` on the left (`load_config` changed to return a custom object) and `taskflow/worker.py` on the right (`execute_job` calling queue/auth/db/config). A terminal window shows `git merge agent-1-config agent-2-worker`:
  ```text
  Merge made by the 'ort' strategy.
  0 line conflicts detected — Clean merge!
  ```
  Followed immediately by `pytest`:
  ```text
  FAILED tests/test_worker.py::test_execute_job_completed - TypeError: 'ConfigObject' object is not subscriptable
  5 failed, 7 passed in 0.17s
  ```
- **Voiceover**:
  > "When multiple autonomous AI agents code in parallel on the same repo, Git only checks for direct line conflicts.
  > Here, Agent 1 changes the signature of `load_config`, while Agent 2 edits `execute_job` 4 call hops away.
  > Because they touched different files, Git merges cleanly with zero line conflicts.
  > But when CI runs, production crashes! `execute_job` calls `dequeue_task`, calls `validate_token`, calls `get_connection`, calls `load_config`.
  > Git catches line conflicts. ChronoFork catches the ones Git can't see."

---

### Shot 2: ChronoFork Architecture & Live UI Console (0:35 – 1:05 | 30s)
- **UI View**: Full browser window at `http://localhost:5173`.
  - **Left Rail**: Brand title *"ChronoFork — Graph Hacks 2026"*, Track badges, Mode selector (*Replay* / *Live*), Scenario cards 1–4, and *Run Swarm* action button.
  - **Center Canvas**: Cytoscape.js dark-mode AST graph of `repo:taskflow` (69 symbols, grouped into compound module containers like `taskflow.config`, `taskflow.worker`).
  - **Right Panel**: Tabs for *Activity Log* and *Cypher Inspector*.
- **Voiceover**:
  > "Meet ChronoFork. Instead of dumb text files, ChronoFork compiles the repository AST into FalkorDB as a live property graph of symbols, calls, imports, and test suites.
  > Every symbol is continuously analyzed with native FalkorDB algorithms: `algo.pageRank` and `algo.betweenness`.
  > On the right, our live Cypher Inspector records every single openCypher query, execution latency in milliseconds, row counts, and payload parameters."

---

### Shot 3: Scenario 1 — Multi-Hop Detection & Callee-First Resolution (1:05 – 1:45 | 40s)
- **UI View**:
  - Click Scenario 1 (**Hidden Collision**). Click **Run Swarm** (or press `Space`).
  - Cytoscape canvas: Agent 1 claims `taskflow.config.load_config` (`SIGNATURE_CHANGE`, blue glowing halo). Agent 2 claims `taskflow.worker.execute_job` (`BODY_EDIT`, amber glowing halo).
  - FalkorDB executes transitive traversal: `MATCH path = (s2)-[:CALLS*1..4]->(s1)`.
  - The 4-hop call path lights up sequentially with pulsing red halos across the 4 modules.
  - Open bottom drawer to **Verifier Tab**:
    - **Naive Git Merge**: shows real subprocess pytest failure (5 failed, 7 passed in 0.17s).
    - **ChronoFork Coordination**: `load_config` risk = 0.8250 forces `SERIALIZE_CALLEE_FIRST`. Graph writes `(:Agent)-[:BLOCKED_BY]->(:Agent)` and `[:HANDED_OFF_TO]`.
    - Real subprocess verifier pytest runs: **12 passed in 0.12s!**
- **Voiceover**:
  > "In Scenario 1, Agent 1 claims `load_config` with a breaking signature change. Agent 2 claims `execute_job`.
  > In 0.76 milliseconds, FalkorDB traverses 4 call hops and flags the collision before a single line of code is written.
  > To prove the danger, ChronoFork runs an isolated Git experiment: Git merges with zero conflicts, but pytest crashes with 5 failures.
  > ChronoFork calculates the bottleneck risk — 0.8250 — and forces callee-first serialization. ConfigCoder lands its contract first, hands off execution to WorkerCoder via a graph edge, and the Verifier runs real pytest: all 12 test suites pass!"

---

### Shot 4: Scenario 2 & Cross-Run Episodic Memory (1:45 – 2:15 | 30s)
- **UI View**:
  - Click Scenario 2 (**Memory Avoidance**).
  - Show the **Memory ON / Memory OFF** toggle in the Left Rail.
  - Run with **Memory ON**: Agent 1 queries `mem:taskflow`, recalls the procedural rule learned from Run 1 with 95% confidence, and automatically adapts its claim from `SIGNATURE_CHANGE` to `BODY_EDIT` (preserving backward compatibility). Transitive collision query returns 0 rows!
  - Flip the toggle to **Memory OFF** and rerun: without memory recall, Agent 1 claims `SIGNATURE_CHANGE` again, and the 4-hop collision warning reappears immediately.
- **Voiceover**:
  > "Now for Track 2: Cross-run episodic memory in `mem:taskflow`.
  > From the first run, ChronoFork stored an `Episode` and forged a `ProceduralRule`.
  > In Scenario 2, with Memory ON, ConfigCoder recalls that past collision with 95% confidence and proactively adapts its intent to `BODY_EDIT`, avoiding the collision entirely.
  > If we flip the Memory toggle to OFF, the swarm forgets, and the 4-hop collision immediately returns. The graph memory directly controls agent behavior."

---

### Shot 5: Live Mode Proof — Fail Loudly Without Fallback (2:15 – 2:40 | 25s)
- **UI View**:
  - Switch Mode toggle in top-left from **Replay** to **Live**.
  - Open terminal side-by-side: `docker stop chronofork-falkordb-1`.
  - Click **Run Swarm** in the UI.
  - The UI immediately surfaces an explicit red error toast banner at top-right:
    `Execution error: Live run execution failed (FalkorDB connection refused or offline): Error 61 connecting to 127.0.0.1:6379. Connection refused. Dismiss`
  - Zero events play; no fake mock fallback is triggered.
  - Terminal: `docker start chronofork-falkordb-1`. Click **Run Swarm** again $\to$ live run succeeds with real FalkorDB timestamps and green `REAL` badges.
- **Voiceover**:
  > "ChronoFork does not fake anything. If we switch to Live mode and stop the FalkorDB container, clicking Run Swarm fails loudly with an explicit HTTP 503 error toast.
  > There is zero fallback to cached data or decorative mocks. FalkorDB is the required engine; if it goes down, the swarm halts.
  > Restarting the container resumes live execution with real FalkorDB query execution."

---

### Shot 6: Wrap-up & Hackathon Summary (2:40 – 2:50 | 10s)
- **UI View**: Return to full UI dashboard displaying Scenario 3 (Safe Parallel disjoint execution with green `PARALLEL_OK` status) and GitHub repo link.
- **Voiceover**:
  > "ChronoFork: Multi-agent coordination powered by FalkorDB graph algorithms, multi-hop Cypher queries, and episodic memory.
  > Git catches line conflicts. ChronoFork catches the ones Git can't see."

