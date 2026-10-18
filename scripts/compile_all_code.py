"""Compiles 100% of the project code, schemas, and architectural logic into ALL_CODE_AND_PROJECT_EXPLANATION.md."""
import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_FILES = [
    os.path.join(ROOT_DIR, "ALL_CODE_AND_PROJECT_EXPLANATION.md"),
    os.path.abspath(r"c:\Users\Acer\OneDrive\Documents\hackathons\name\ALL_CODE_AND_PROJECT_EXPLANATION.md")
]

FILES_TO_INCLUDE = [
    # ----------------------------------------------------
    # 1. Backend Core & FalkorDB Coordination Engine
    # ----------------------------------------------------
    "backend/app/main.py",
    "backend/app/coordinator.py",
    "backend/app/algorithms.py",
    "backend/app/memory.py",
    "backend/app/falkor_client.py",
    "backend/app/parser.py",
    "backend/app/event_stream.py",
    "backend/app/scenario_runner.py",
    "backend/app/mcp_tools.py",
    
    # ----------------------------------------------------
    # 2. Autonomous Multi-Agent Swarm Logic
    # ----------------------------------------------------
    "backend/app/agents/coder.py",
    "backend/app/agents/llm.py",
    "backend/app/agents/reviewer.py",
    "backend/app/agents/verifier.py",
    "backend/app/agents/scripted.py",
    
    # ----------------------------------------------------
    # 3. Frontend React 19 UI & Cytoscape Visualization
    # ----------------------------------------------------
    "frontend/src/App.tsx",
    "frontend/src/components/GraphCanvas.tsx",
    "frontend/src/components/TopBar.tsx",
    "frontend/src/components/LeftRail.tsx",
    "frontend/src/components/HeroSplit.tsx",
    "frontend/src/components/QueryInspector.tsx",
    "frontend/src/components/ResultStrip.tsx",
    "frontend/src/components/ProvenanceStrip.tsx",
    "frontend/src/components/ZeroPathProof.tsx",
    "frontend/src/components/StoryCaptionBar.tsx",
    "frontend/src/components/RightSplitter.tsx",
    "frontend/src/components/VerifiedText.tsx",
    "frontend/src/adapters/events.ts",
    "frontend/src/types.ts",
    "frontend/src/index.css",
    "frontend/src/styles/tokens.css",
    "frontend/vite.config.ts",
    "frontend/package.json",
    "frontend/nginx.conf",
    "frontend/Dockerfile",
    
    # ----------------------------------------------------
    # 4. Target Repository Under Coordination (taskflow)
    # ----------------------------------------------------
    "demo_repo/taskflow/taskflow/config.py",
    "demo_repo/taskflow/taskflow/database.py",
    "demo_repo/taskflow/taskflow/auth.py",
    "demo_repo/taskflow/taskflow/queue.py",
    "demo_repo/taskflow/taskflow/worker.py",
    "demo_repo/taskflow/tests/test_config.py",
    "demo_repo/taskflow/tests/test_auth.py",
    "demo_repo/taskflow/tests/test_worker.py",
    
    # ----------------------------------------------------
    # 5. Verification, Benchmark & Pipeline Scripts
    # ----------------------------------------------------
    "scripts/benchmark_detection.py",
    "scripts/make_numbers.py",
    "scripts/regenerate_replays.py",
    "scripts/run_phase9_ui_suite.cjs",
    "scripts/run_final_regression.py",
    "scripts/verify_aws_deep_check.py",
    "scripts/verify_new_features.py",
    
    # ----------------------------------------------------
    # 6. Single Source of Truth Metrics & Key Documentation
    # ----------------------------------------------------
    "docs/NUMBERS.md",
    "docs/ARCHITECTURE.md",
    "docs/QA_PREP.md",
    "docs/blog-post.md",
    "docs/falkordb-verified.md",
    "docs/benchmark.md",
    
    # ----------------------------------------------------
    # 7. Deployment, Docker & Cloud Infrastructure
    # ----------------------------------------------------
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "render.yaml",
    "backend/Dockerfile",
    "backend/requirements.txt"
]

def read_file(rel_path):
    full_path = os.path.join(ROOT_DIR, rel_path)
    if not os.path.exists(full_path):
        return f"# [Notice: File {rel_path} not found on local path]\n"
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
> **Live Public Deployment (AWS)**: [http://34.230.70.144/](http://34.230.70.144/)  
> **Live FastMCP Endpoint**: `POST http://34.230.70.144/mcp`  
> **Single Source of Truth**: All metrics and numbers derive strictly from `docs/NUMBERS.md`.

---

## 🏆 Hackathon Winning Architectural Blueprint & Connective Logic

### 1. The Core Innovation: Solving Git's Silent Killer
Traditional version control systems (Git) operate strictly on line diffs within isolated text files.
When autonomous AI agents work concurrently on a repository, this creates a catastrophic vulnerability:

```
  Agent 1 (config.py):               Agent 2 (worker.py):
  load_config() -> returns ConfigObject   execute_job() -> calls queue.dequeue_task()
                                                                 | calls auth.validate_token()
                                                                 | calls database.get_connection()
                                                                 v calls config.load_config()
  ----------------------------------------------------------------------------------------
  Git Merge Result: "0 line conflicts detected — Clean merge!"
  Runtime CI Execution: TypeError: 'ConfigObject' object is not subscriptable -> 5 FAILED tests!
```

ChronoFork eliminates this failure mode by replacing dumb text comparisons with **live Abstract Syntax Tree (AST) graph intelligence in FalkorDB**.

---

### 2. Track 1: Agents That Act on Connected Data
1. **Repository AST Ingestion (`backend/app/parser.py`)**:
   - Parses the code into AST nodes: `(:Symbol:Module)`, `(:Symbol:Class)`, `(:Symbol:Function)`, and `(:Symbol:Test)`.
   - Links dependencies via directed edges: `[:DEFINES]`, `[:IMPORTS]`, `[:CALLS]`, and `[:TESTED_BY]`.
   - For `repo:taskflow`, this generates **69 symbols**, **29 `CALLS` edges**, and **16 `TESTED_BY` edges**.
2. **Sub-2ms Transitive Collision Traversal (`backend/app/coordinator.py`)**:
   - Executes a single native openCypher traversal across variable-length paths:
     ```cypher
     MATCH (a1:Agent)-[c1:CLAIMS]->(s1:Symbol),
           (a2:Agent)-[c2:CLAIMS]->(s2:Symbol)
     WHERE a1.id <> a2.id
       AND c1.intent IN ['SIGNATURE_CHANGE', 'DELETE']
     MATCH path = (s2)-[:CALLS*1..4]->(s1)
     RETURN a1.id, a2.id, [n IN nodes(path) | n.qualname] AS path_nodes, length(path) AS hops
     ```
   - Traverses the 4-hop chain (`worker` $\to$ `queue` $\to$ `auth` $\to$ `database` $\to$ `config`) in **~1-2 ms** (median 1.97 ms) before a single line of code is written.
3. **C-Level Graph Centrality Risk Scoring (`backend/app/algorithms.py`)**:
   - Evaluates structural bottleneck prominence using native FalkorDB algorithms:
     $$\\text{Risk}(S) = 0.5 \\times \\frac{\\text{PageRank}(S)}{\\max \\text{PageRank}} + 0.5 \\times \\frac{\\text{Betweenness}(S)}{\\max \\text{Betweenness}}$$
   - For `taskflow.config.load_config`: PageRank = `0.056058` (norm 1.0), Betweenness = `34.0` / max `48.0` (norm 0.7083), yielding $\\mathbf{0.854}$.
   - Because $0.854 \\ge 0.50$, the coordinator elevates the coordination policy to **`SERIALIZE_CALLEE_FIRST`**.
4. **Speculative Fork Simulation (`backend/app/coordinator.py`)**:
   - Creates an isolated graph copy (`graph.copy` in **~55-112 ms**) under `fork:<run_id>:<agent_id>`.
   - Evaluates blast radius and dependent callers in complete isolation without mutating baseline repository data (`risk before == after`, 0.854).

---

### 3. Track 2: Agent Memory and Coordination
1. **Property Graph Coordination (`coord:<run_id>`)**:
   - Clones the repository into an isolated coordination space.
   - Agent claims are stored directly as graph edges:
     `(:Agent)-[:CLAIMS {intent, subtask, timestamp}]->(:Symbol)`
2. **Graph-Driven Handoffs & Merge Order**:
   - Dynamically writes blocking edges: `(:WorkerCoder)-[:BLOCKED_BY]->(:ConfigCoder)`.
   - Callee (ConfigCoder) creates an isolated branch, applies its patch, and verifies with real `pytest` (all pass).
   - Upon completion, the blocking edge is removed and replaced by an explicit handoff edge:
     `(:ConfigCoder)-[:HANDED_OFF_TO {reason: 'Contract verified with pytest'}]->(:WorkerCoder)`
   - WorkerCoder pulls ConfigCoder's verified contract, applies caller adaptations, and merges cleanly.
   - Verifier confirms: **12 PASSED, 0 FAILED** in 1.09s (pytest-internal; ~1.7s wall time).
3. **Cross-Run Episodic Memory & Dynamic Confidence (`backend/app/memory.py`)**:
   - Persistent graph `mem:<repo>` stores historical episodes and procedural rules linked to symbols:
     `(:Episode)-[:INVOLVED]->(:Symbol)`
     `(:ProceduralRule)-[:INVOLVED]->(:Symbol)`
   - Initial confidence prior = `0.85`. On success: $+0.10$ (capped at `0.99`); on failure: $-0.20$ (floor `0.10`).
   - In Scenario 2, ConfigCoder recalls rule `rule_cfg_worker_transitive` with 95% confidence and **proactively adapts its claim** from `SIGNATURE_CHANGE` to `BODY_EDIT`. Collision check reports 0 collisions, allowing concurrent parallel execution!

---

### 4. FastMCP over HTTP (JSON-RPC 2.0)
External AI agents running in Cursor, Claude Desktop, or custom orchestrators connect directly to `http://34.230.70.144/mcp` and invoke 7 standardized tools:
1. `get_impact`: Reverse impact analysis of any symbol across the call graph.
2. `rank_risk`: In-memory PageRank & Betweenness risk calculation.
3. `claim_symbols`: Register symbol claims with specific intents.
4. `detect_collisions`: Run multi-hop collision detection.
5. `recall_memory`: Query past episodes and procedural rules.
6. `fork_graph`: Create speculative graph forks.
7. `record_episode`: Persist execution outcomes and update rule confidence scores.

---

### 5. Live Gemini Mode (`gemini-3.5-flash-lite`, `gemini-flash-latest`)
- Connects directly to Google Gemini via `httpx`.
- Dynamically decomposes user tasks into agent subtasks with assigned roles, claims, and intents.
- Generates caller migration patches automatically when a callee's interface evolves.

---

## 📂 Complete Source Code Manifest

"""
    sections = [header]
    for rel_path in FILES_TO_INCLUDE:
        content = read_file(rel_path)
        ext = rel_path.split(".")[-1]
        lang = (
            "python" if ext == "py"
            else ("javascript" if ext in ("js", "cjs")
            else ("typescript" if ext in ("ts", "tsx")
            else ("yaml" if ext in ("yml", "yaml")
            else ("json" if ext == "json"
            else ("css" if ext == "css"
            else ("dockerfile" if "Dockerfile" in rel_path
            else ("nginx" if ext == "conf"
            else ext)))))))
        )
        
        section = f"### File: `{rel_path}`\n\n```{lang}\n{content.strip()}\n```\n\n---\n\n"
        sections.append(section)
        
    full_output = "".join(sections)
    
    for out_path in OUTPUT_FILES:
        try:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(full_output)
            file_size_kb = os.path.getsize(out_path) / 1024
            line_count = len(full_output.splitlines())
            print(f"Successfully generated {out_path}: {line_count} lines ({file_size_kb:.1f} KB)")
        except Exception as e:
            print(f"Warning: Could not write to {out_path}: {e}")

if __name__ == "__main__":
    compile_all()
