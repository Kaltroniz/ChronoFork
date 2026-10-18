"""Compiles all project code and architectural logic into ALL_CODE_AND_PROJECT_EXPLANATION.md."""
import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_FILE = os.path.join(ROOT_DIR, "ALL_CODE_AND_PROJECT_EXPLANATION.md")

FILES_TO_INCLUDE = [
    # Core Architecture & Backend
    "backend/app/main.py",
    "backend/app/coordinator.py",
    "backend/app/algorithms.py",
    "backend/app/memory.py",
    "backend/app/falkor_client.py",
    "backend/app/parser.py",
    "backend/app/event_stream.py",
    "backend/app/scenario_runner.py",
    "backend/app/mcp_tools.py",
    "backend/app/agents/coder.py",
    "backend/app/agents/llm.py",
    "backend/app/agents/reviewer.py",
    "backend/app/agents/verifier.py",
    "backend/app/agents/scripted.py",
    
    # Frontend Types & UI Components
    "frontend/src/types/index.ts",
    "frontend/src/App.tsx",
    "frontend/src/components/GraphCanvas.tsx",
    "frontend/src/components/TopBar.tsx",
    "frontend/src/components/LeftRail.tsx",
    "frontend/src/components/BottomDrawer.tsx",
    "frontend/src/components/CypherInspector.tsx",
    "frontend/src/components/MemoryDrawer.tsx",
    "frontend/src/components/HeroSplitCard.tsx",
    "frontend/src/components/SafeParallelCard.tsx",
    
    # Key Pipeline & Verification Scripts
    "scripts/make_numbers.py",
    "scripts/regenerate_replays.py",
    "scripts/run_phase9_ui_suite.cjs",
    "scripts/benchmark_detection.py",
    "scripts/verify_new_features.py",
    
    # Deployment & Manifests
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "render.yaml",
    "backend/Dockerfile"
]

def read_file(rel_path):
    full_path = os.path.join(ROOT_DIR, rel_path)
    if not os.path.exists(full_path):
        return f"# File not found: {rel_path}\n"
    for enc in ["utf-8", "utf-8-sig", "utf-16", "cp1252", "latin-1"]:
        try:
            with open(full_path, "r", encoding=enc) as f:
                return f.read()
        except Exception:
            continue
    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()

def compile_all():
    print(f"Compiling {len(FILES_TO_INCLUDE)} files into ALL_CODE_AND_PROJECT_EXPLANATION.md...")
    
    header = """# ChronoFork: Complete Project Codebase and Connective Logic

> **Project**: ChronoFork — Graph-Coordinated Autonomous AI Coding Swarm Powered by FalkorDB  
> **Hackathon**: FalkorDB Graph Hacks 2026 (Track 1: Agents That Act on Connected Data & Track 2: Agent Memory and Coordination)  
> **Repository**: [github.com/Kaltroniz/ChronoFork](https://github.com/Kaltroniz/ChronoFork)  
> **Single Source of Truth**: All metrics and numbers derive strictly from `docs/NUMBERS.md`.

---

## 🏗️ Architectural Connective Logic: How the System Works End-to-End

ChronoFork solves the "silent killer" of multi-agent software engineering: **cross-module transitive semantic collisions** that traditional line-based version control (Git) cannot detect.

```
       Git diff: "0 line conflicts detected — Clean merge!"
       Runtime CI: TypeError: 'ConfigObject' object is not subscriptable -> 5 FAILED tests!
```

### 1. Abstract Syntax Tree (AST) Ingestion to FalkorDB
- **Module**: `backend/app/parser.py`
- **Logic**: When a Python repository is ingested, `parse_repository` walks the file tree using Python's native `ast` module.
- It instantiates AST symbols: `(:Symbol:Module)`, `(:Symbol:Class)`, `(:Symbol:Function)`, and `(:Symbol:Test)`.
- It analyzes static calls, imports, and test targets to construct directed relationships: `[:DEFINES]`, `[:IMPORTS]`, `[:CALLS]`, and `[:TESTED_BY]`.
- For `repo:taskflow`, this produces 69 symbols, 29 `CALLS` edges, and 16 `TESTED_BY` edges.

### 2. Multi-Graph Isolation & Native Copy
- **Module**: `backend/app/falkor_client.py` & `backend/app/coordinator.py`
- **Logic**: Baseline repository graphs (`repo:<name>`) remain immutable.
- For each execution, ChronoFork clones the graph into `coord:<run_id>` using FalkorDB's native C-level `GRAPH.COPY` in **~55-112 ms** (median 108.32 ms).
- For speculative impact estimation, agents create per-agent forks: `fork:<run_id>:<agent_id>`.

### 3. Claim Registration as Graph Edges (Track 2)
- **Module**: `backend/app/coordinator.py:register_claim`
- **Logic**: Rather than maintaining a separate state table, agents attach directly to code symbols in FalkorDB:
  `(:Agent {id, name})-[:CLAIMS {intent, subtask, timestamp}]->(:Symbol {qualname})`
- Supported intents: `SIGNATURE_CHANGE`, `BODY_EDIT`, `DELETE`, `ADD`.

### 4. Sub-2ms Transitive Collision Detection (Track 1)
- **Module**: `backend/app/coordinator.py:detect_collisions`
- **Logic**: A single openCypher traversal scans for multi-hop call relationships between agents claiming symbols:
  ```cypher
  MATCH (a1:Agent)-[c1:CLAIMS]->(s1:Symbol),
        (a2:Agent)-[c2:CLAIMS]->(s2:Symbol)
  WHERE a1.id <> a2.id
    AND c1.intent IN ['SIGNATURE_CHANGE', 'DELETE']
  MATCH path = (s2)-[:CALLS*1..4]->(s1)
  RETURN a1, a2, s1, s2, path, length(path) AS hops
  ```
- In `repo:taskflow`, this traverses 4 hops (`worker.py` -> `queue.py` -> `auth.py` -> `database.py` -> `config.py`) in **~1-2 ms** (median 1.97 ms).

### 5. Centrality-Driven Architectural Risk Scoring
- **Module**: `backend/app/algorithms.py:compute_risk_rankings`
- **Logic**: Combines structural scarcity (PageRank) with bottleneck prominence (Betweenness):
  $$\\text{Risk}(S) = 0.5 \\times \\frac{PR(S)}{\\max PR} + 0.5 \\times \\frac{BW(S)}{\\max BW}$$
- For `taskflow.config.load_config`, $PR = 0.056058$ (norm 1.0) and $BW = 34.0$ / Max $48.0$ (norm 0.7083), yielding $\\mathbf{0.854}$.
- Because $0.854 \\ge 0.50$ (and $A1$ intent is `SIGNATURE_CHANGE`), the coordinator enforces **`SERIALIZE_CALLEE_FIRST`**.

### 6. Dynamic Handoff Edges & Callee-First Merge
- **Module**: `backend/app/coordinator.py:enforce_coordination_policy`
- **Logic**:
  1. FalkorDB writes an explicit blocking edge: `(:Agent2)-[:BLOCKED_BY]->(:Agent1)`.
  2. Agent 1 creates an isolated git branch (`agent-1-branch`) and writes its patch.
  3. Real verifier runs `pytest`: all tests pass locally.
  4. Coordinator removes `[:BLOCKED_BY]` and creates `(:Agent1)-[:HANDED_OFF_TO]->(:Agent2)`.
  5. Agent 2 checks out Agent 1's branch, applies caller adaptations, and merges.
  6. Final verifier runs `pytest`: **12 passed in 1.09s** (0 failed). In contrast, naive git merge produces **5 failed in 0.44s**.

### 7. Cross-Run Episodic Memory & Dynamic Confidence (Track 2)
- **Module**: `backend/app/memory.py`
- **Logic**: In `mem:<repo>`, ChronoFork persists historical `Episode` and `ProceduralRule` nodes linked to symbols via `[:INVOLVED]`.
- Prior confidence = `0.85`. On success, $+0.10$ (capped at `0.99`); on failure, $-0.20$ (floor `0.10`).
- In Scenario 2 with Memory ON, Agent 1 recalls the rule with 95% confidence and **proactively adapts its intent** from `SIGNATURE_CHANGE` to `BODY_EDIT`. Collision check returns 0 rows, enabling concurrent execution!

### 8. FastMCP over HTTP (JSON-RPC 2.0)
- **Module**: `backend/app/mcp_tools.py` & `backend/app/main.py`
- **Logic**: Exposes 7 tools (`get_impact`, `rank_risk`, `claim_symbols`, `detect_collisions`, `recall_memory`, `fork_graph`, `record_episode`) over standard JSON-RPC 2.0 at `POST /mcp`.

### 9. Real-Time Telemetry & Cytoscape Console
- **Module**: `backend/app/event_stream.py` & `frontend/src/components/GraphCanvas.tsx`
- **Logic**: SSE stream pushes events with millisecond precision and provenance tagging (`REAL` vs `CACHED`).
- Canvas renders compound module clusters, agent boundary rings, elevated intent chips, and auto-docking collision hero cards.

---

## 📂 Complete Source Code Manifest

"""
    sections = [header]
    for rel_path in FILES_TO_INCLUDE:
        content = read_file(rel_path)
        ext = rel_path.split(".")[-1]
        lang = "python" if ext == "py" else ("javascript" if ext in ("js", "cjs") else ("typescript" if ext in ("ts", "tsx") else ("yaml" if ext in ("yml", "yaml") else ext)))
        
        section = f"### File: `{rel_path}`\n\n```{lang}\n{content}\n```\n\n---\n\n"
        sections.append(section)
        
    full_output = "".join(sections)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(full_output)
    
    file_size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    line_count = len(full_output.splitlines())
    print(f"Generated {OUTPUT_FILE}: {line_count} lines ({file_size_kb:.1f} KB)")

if __name__ == "__main__":
    compile_all()
