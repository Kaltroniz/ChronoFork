# ChronoFork — 3-Minute Demo Video Script

**Tagline**: *"Git catches line conflicts. ChronoFork catches the ones Git can't see."*  
**Theme**: Graph-Coordinated AI Coding Swarm powered by FalkorDB  
**Tracks**: Track 1 (Agents acting on connected data) & Track 2 (Agent memory and coordination)  
**Total Target Runtime**: 2 minutes 50 seconds (<= 3:00 max)

---

## 🎬 Shot List & Narrative Breakdown

### Shot 1: The Problem — Git's Silent Blind Spot (0:00 – 0:35 | 35s)
- **UI View**: Full ChronoFork console at `http://localhost:5173`. Open the bottom drawer to the **Verdict panel** comparing **Naive Git Merge** against **ChronoFork Coordination**:
  - **Left (Naive Git Merge)**: Shows `git merge` succeeded cleanly with 0 line conflicts ("Merge made by the 'ort' strategy"), but CI verification immediately crashed:
    ```text
    FAILED tests/test_worker.py::test_execute_job_completed - TypeError: 'ConfigObject' object is not subscriptable
    5 failed, 7 passed in 0.17s
    ```
  - **Right (ChronoFork Coordination)**: Shows callee-first serialization policy, dependency handoff, and verification passing:
    ```text
    12 PASSED in 0.12s
    ```
- **Voiceover**:
  > "When multiple autonomous AI agents code in parallel on the same repository, Git only checks for direct line conflicts in identical files.
  > Here in our taskflow service, Agent 1 altered the return signature of `load_config`, while Agent 2 modified `execute_job` 4 call hops away.
  > Because they touched separate files, Git merged them cleanly with zero line conflicts.
  > But when CI ran, production broke: 5 tests failed with `TypeError`.
  > Git catches line conflicts. ChronoFork catches the ones Git can't see."

---

### Shot 2: ChronoFork Architecture & Console Tour (0:35 – 1:05 | 30s)
- **UI View**:
  - **Top Bar**: Tagline, compact provenance pills (`GRAPH`, `GIT`, `PYTEST`, `LLM` showing `CACHED` or `REAL` data sources), and single-line *Reset Demo* button.
  - **Left Rail**: Scenario cards (Scenario 1 Hidden Collision, Scenario 2 Memory Avoidance, Scenario 3 Safe Parallel), *Play the Story* button, timeline scrubber, and Replay/Live mode toggle.
  - **Center Canvas**: Interactive Cytoscape.js code property graph of `repo:taskflow` (69 symbols grouped into compound module containers like `taskflow.config`, `taskflow.worker`).
  - **Right Panel**: **Cypher Inspector** tab recording every openCypher query, row count, execution latency, and payload parameters.
- **Voiceover**:
  > "Meet ChronoFork. Instead of raw text files, ChronoFork compiles the repository AST into FalkorDB as a live property graph of symbols, calls, imports, and test suites.
  > Agents declare their intent on the graph before writing code.
  > On the right, our live Cypher Inspector records every single openCypher query, execution latency, row count, and parameter payload in real time."

---

### Shot 3: Scenario 1 — Multi-Hop Detection & Callee-First Resolution (1:05 – 1:45 | 40s)
- **UI View**:
  - Click Scenario 1 (**Hidden Collision**). Click **Play the Story** (or use the timeline controls).
  - Canvas: Agent 1 claims `taskflow.config.load_config` (`SIGNATURE_CHANGE`, blue ring + elevated chip). Agent 2 claims `taskflow.worker.execute_job` (`BODY_EDIT`, amber ring + elevated chip).
  - Cypher Inspector: FalkorDB executes transitive traversal: `MATCH path = (s2)-[:CALLS*1..4]->(s1)`.
  - Collision HeroSplit card appears: highlights the 4-hop call path across modules (`worker.py` $\to$ `queue.py` $\to$ `auth.py` $\to$ `database.py` $\to$ `config.py`) and auto-docks after 1.5 seconds.
  - Latency displayed: about a millisecond (1.6 ms on screen).
  - Bottleneck Risk displayed: **0.854** (normalized 0.5 PageRank + 0.5 Betweenness).
  - Bottom drawer Verdict panel confirms: callee-first serialization order (`load_config` $\to$ `execute_job`) and 12 passed tests.
- **Voiceover**:
  > "In Scenario 1, Agent 1 claims `load_config` with a breaking signature change. Agent 2 claims `execute_job`.
  > In about a millisecond (1.6 ms on screen), FalkorDB traverses 4 call hops and flags the collision before a single line of code is written.
  > ChronoFork calculates the bottleneck risk — 0.854 — from FalkorDB's native PageRank and Betweenness algorithms, and enforces callee-first serialization.
  > ConfigCoder lands its contract first, hands off execution to WorkerCoder via a graph edge, and the Verifier runs real pytest: all 12 test suites pass!"

---

### Shot 4: Scenario 2 & Cross-Run Episodic Memory (1:45 – 2:15 | 30s)
- **UI View**:
  - Click Scenario 2 (**Memory Avoidance**).
  - Highlight the **Memory ON / Memory OFF** toggle in the Left Rail.
  - Run with **Memory ON**: Agent 1 queries `mem:taskflow`, recalls `rule_cfg_worker_transitive` learned from Run 1 with 95% confidence, and automatically adapts its claim from `SIGNATURE_CHANGE` to `BODY_EDIT` (preserving backward compatibility).
  - Cypher Inspector shows 0 collision rows returned.
  - Flip toggle to **Memory OFF** and rerun: without memory recall, Agent 1 repeats the breaking `SIGNATURE_CHANGE`, and the 4-hop collision warning returns immediately.
- **Voiceover**:
  > "Now for Track 2: Cross-run episodic memory in `mem:taskflow`.
  > From the first run, ChronoFork stored an `Episode` and forged a `ProceduralRule`.
  > In Scenario 2, with Memory ON, ConfigCoder recalls that past collision with 95% confidence and proactively adapts its intent to `BODY_EDIT`, avoiding the collision entirely.
  > If we flip the Memory toggle to OFF, the swarm forgets, and the 4-hop collision immediately returns. The graph memory directly controls agent behavior."

---

### Shot 5: Live Mode Proof — Fail Loudly Without Fallback (2:15 – 2:40 | 25s)
- **UI View**:
  - Run the application with `DEMO_MODE=false docker compose up`.
  - In the UI, switch Mode toggle from **Replay** to **Live**.
  - Simulate an unreachable database (stop the FalkorDB container or disconnect the network).
  - Click **Run Swarm** in the UI.
  - The UI immediately surfaces an explicit red error toast banner at top-right indicating the database is unreachable. Zero events play; no fake mock fallback is triggered.
  - Restart the FalkorDB container and click **Run Swarm** again $\to$ live execution proceeds immediately with real FalkorDB timestamps and green `REAL` provenance badges.
- **Voiceover**:
  > "ChronoFork does not fake anything. If we run with `DEMO_MODE=false` and the database service is offline or unreachable, clicking Run Swarm halts immediately with a clear error notification.
  > There is zero fallback to cached data or decorative mocks. FalkorDB is the required engine; if it goes down, the swarm halts loudly.
  > Restoring the database resumes live execution with real queries, real git branches, and real test execution."

---

### Shot 6: Wrap-up & Hackathon Summary (2:40 – 2:50 | 10s)
- **UI View**: Display Scenario 3 (**Safe Parallel**) with two disjoint neighborhoods in Agent 2 and Agent 3 colors, the docked SAFE card, and the GitHub repository link.
- **Voiceover**:
  > "ChronoFork: Multi-agent coordination powered by FalkorDB graph algorithms, multi-hop Cypher queries, and episodic memory.
  > Git catches line conflicts. ChronoFork catches the ones Git can't see."
