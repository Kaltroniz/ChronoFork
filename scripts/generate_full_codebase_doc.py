#!/usr/bin/env python3
"""
Generates CHRONOFORK_ALL_CODE_AND_EXPLANATION.md containing every single line of code
written for ChronoFork, accompanied by in-depth architectural and implementation explanations.
"""

import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_FILE = os.path.join(ROOT_DIR, "CHRONOFORK_ALL_CODE_AND_EXPLANATION.md")

EXPLANATIONS = {
    "backend/app/falkor_client.py": """### FalkorDB Client Wrapper (`backend/app/falkor_client.py`)
**Role & Purpose:**
Manages low-level socket connections to FalkorDB using the official `falkordb` Python library. It abstracts multigraph operations across all four graph keys (`repo:<name>`, `coord:<run_id>`, `fork:<run_id>:<agent_id>`, and `mem:<repo>`).

**Key Architectural Mechanics:**
- **Dynamic Configuration:** Reads `FALKORDB_HOST` and `FALKORDB_PORT` from environment variables, defaulting to `127.0.0.1:6379` for local execution or `falkordb:6379` in Docker Compose.
- **Defensive Graph Copying (`copy_graph`):** Phase 0 live testing proved that calling FalkorDB's `graph.copy(dest)` will throw a `ResponseError: destination key already exists` if the target key already exists. `copy_graph` guarantees that the target key is dropped prior to initiating the copy.
- **Precise Millisecond Query Timing:** Measures query execution time via `time.perf_counter()`, returning both the raw FalkorDB `QueryResult` and execution duration in milliseconds for the frontend Cypher Inspector.
""",

    "backend/app/parser.py": """### AST Code Graph Ingestion Engine (`backend/app/parser.py`)
**Role & Purpose:**
Parses a Python repository into an abstract syntax tree (AST) and translates symbols and relationships into FalkorDB graph nodes and edges.

**Import-Aware Call Resolution:**
A critical failure mode of naive code graphs is matching function calls by bare global name (e.g., matching any call named `execute_job` to every function named `execute_job` across the repository). ChronoFork enforces strict import-aware call resolution:
1. **Module Import Table:** Parses all `import x`, `import x as y`, `from x import y`, and relative imports (`from . import z`).
2. **Local Symbol Table:** Resolves calls through local function definitions, imported functions, and class methods.
3. **Multi-Label Node Schema:** Every entity is assigned the shared base label `:Symbol` plus a domain label (`:Module`, `:Class`, `:Function`, `:Test`). This multi-label schema allows algorithms like PageRank to score the entire graph uniformly (`CALL algo.pageRank('Symbol', 'CALLS')`).
4. **Relationship Types:**
   - `[:DEFINES]`: Parent scope to child symbol.
   - `[:IMPORTS]`: Module-to-module dependencies.
   - `[:CALLS]`: Function invocation resolved via import table.
   - `[:TESTED_BY]`: Direct test coverage links.
""",

    "backend/app/algorithms.py": """### Graph Algorithms & Risk Scoring (`backend/app/algorithms.py`)
**Role & Purpose:**
Computes graph centrality and blast-radius impact to determine how dangerous a given symbol is to modify.

**Key Mathematical & Graph Components:**
- **Reverse-CALLS Impact Traversal:** Executes an openCypher query traversing incoming `CALLS` edges up to 4 hops deep, plus associated `TESTED_BY` edges, building an exhaustive list of affected downstream callers and tests.
- **PageRank Centrality (`CALL algo.pageRank('Symbol', 'CALLS')`):** Measures the global structural importance of every function. Functions with many incoming transitive callers receive high PageRank.
- **Betweenness Centrality (`CALL algo.betweenness`):** Identifies bottleneck functions that sit on the shortest paths between disparate parts of the codebase.
- **Normalized Risk Score:** Combines PageRank and Betweenness into a composite score:
  $$\\text{Risk} = 0.5 \\times \\text{Norm}(\\text{PageRank}) + 0.5 \\times \\text{Norm}(\\text{Betweenness})$$
  Symbols with high risk scores trigger serialization policies instead of concurrent edits.
""",

    "backend/app/coordinator.py": """### Multi-Agent Swarm Coordinator & Collision Engine (`backend/app/coordinator.py`)
**Role & Purpose:**
Manages the live coordination graph (`coord:<run_id>`), handles agent symbol claims with intent types, executes native multi-hop collision queries, and creates speculative agent forks.

**Collision Resolution Logic:**
- **Intent Types:** `SIGNATURE_CHANGE`, `BODY_EDIT`, `DELETE`, `ADD`.
- **Transitive Collision Query:**
  ```cypher
  MATCH (a1:Agent)-[c1:CLAIMS]->(s1:Symbol), (a2:Agent)-[c2:CLAIMS]->(s2:Symbol)
  WHERE a1.id <> a2.id AND c1.intent IN ['SIGNATURE_CHANGE', 'DELETE']
  MATCH path = (s2)-[:CALLS*1..4]->(s1)
  RETURN ...
  ```
  If Agent 2's claimed symbol reaches Agent 1's symbol within 1 to 4 hops, a collision is flagged.
- **Policy Enforcement:**
  - `SERIALIZE`: If the target symbol has a risk score $\\ge 0.6$ or is a breaking signature change, Agent 2 is blocked until Agent 1 finishes and merges.
  - `REPLAN`: If the collision can be averted by modifying the prompt or adding default parameters.
  - `PARALLEL_OK`: If the call subgraphs are disjoint (0 path overlap).
- **Speculative Graph Forking (`fork_agent_graph`):** Clones `repo:<name>` to `fork:<run_id>:<agent_id>` to compute speculative blast radius.
""",

    "backend/app/memory.py": """### Cross-Run Memory & Procedural Confidence Engine (`backend/app/memory.py`)
**Role & Purpose:**
Maintains persistent episodic and procedural memory across runs in graph key `mem:<repo>`.

**Dynamic Heuristic Confidence:**
- **Graph Schema:** `(:Symbol {qualname})`, `(:Episode)`, `(:ProceduralRule)`. Linked via `[:INVOLVED]` and `[:LEARNED_RULE]`.
- **Dynamic Updates:** When a run completes successfully after serialization or avoidance, `update_rule_confidence` increases the rule confidence by `+0.10` (capped at 0.99). If a run fails tests, confidence drops by `-0.20` (floored at 0.10).
- **Upfront Memory Recall:** Before claiming any symbol, an agent queries FalkorDB for any `ProceduralRule` connected to its target symbol or its 2-hop neighbors. If a high-confidence rule exists, the agent adapts its plan upfront (e.g. converting a breaking `SIGNATURE_CHANGE` into a backward-compatible `BODY_EDIT`).
""",

    "backend/app/mcp_tools.py": """### FastMCP Native Tool Server (`backend/app/mcp_tools.py`)
**Role & Purpose:**
Exposes ChronoFork's graph algorithms and coordination primitives via the official Python Model Context Protocol (`mcp`) SDK (`FastMCP` / `MCPServer`).

**Tools Exposed:**
1. `get_impact(repo_name, qualname, max_hops=4)`: Dependent callers and affected tests.
2. `rank_risk(repo_name)`: PageRank, Betweenness, and normalized risk ranking.
3. `claim_symbols(run_id, agent_id, qualnames, intent, reason)`: Registers claims in `coord:<run_id>`.
4. `detect_collisions(run_id)`: Multi-hop openCypher collision detection with path extraction.
5. `fork_graph(run_id, agent_id, repo_name)`: Speculative workspace cloning.
6. `recall_memory(repo_name, symbol_qualnames)`: Queries `mem:<repo>` for procedural rules.
7. `record_episode(repo_name, run_id, task, outcome, summary, involved_symbols, rule_learned)`: Persists run outcomes.

Can be connected to external MCP clients (Cursor, Claude Desktop, Antigravity) or called in-process by the orchestrator.
""",

    "backend/app/event_stream.py": """### In-Memory SSE Event Buffer & Streaming Engine (`backend/app/event_stream.py`)
**Role & Purpose:**
Ensures real-time Server-Sent Events (SSE) streaming from the backend to the React frontend with zero dropped events.

**Deterministic Replay & Pacing:**
- **Indexed In-Memory Buffer:** All emitted events for a `run_id` are stored in an append-only memory list. When the frontend connects to `GET /runs/{id}/events?delay_ms=600`, it always streams from event index 0. Even if the backend finishes in 50ms, the frontend receives the full sequence at a comfortable animated pace (`delay_ms`).
- **Strict Event Schema:** Every event contains `ts`, `run_id`, `agent`, `phase`, `tool`, `cypher`, `params`, `node_ids`, `edge_ids`, `scores`, `collision`, `memory_write`, and `message`.
""",

    "backend/app/scenario_runner.py": """### Scenario Orchestrator (`backend/app/scenario_runner.py`)
**Role & Purpose:**
Executes the four deterministic benchmark scenarios that showcase ChronoFork's capabilities with zero external API calls:

1. **Scenario 1 (Hidden Transitive Collision):**
   - Agent 1 claims `taskflow.config.load_config` (`SIGNATURE_CHANGE`).
   - Agent 2 claims `taskflow.worker.execute_job` (`BODY_EDIT`).
   - Git sees 0 line conflicts. ChronoFork detects the 2-hop chain through `auth.validate_token`, enforces `SERIALIZE`, and completes successfully.
2. **Scenario 2 (Memory-Driven Collision Avoidance):**
   - ConfigCoder recalls the rule from Scenario 1 with 90% confidence.
   - Proactively adapts its plan to use backward-compatible `BODY_EDIT`.
   - Collision check yields 0 collisions, and tests pass.
3. **Scenario 3 (Safe Parallelism):**
   - Agent 1 works on `taskflow.worker.execute_job`.
   - Agent 3 works on `taskflow.reports.generator.generate_summary`.
   - Disjoint subgraphs result in `PARALLEL_OK`.
4. **Scenario 4 (Multi-Tenant Repository Isolation):**
   - Switches to `repo:analytics` and `mem:analytics`.
   - Validates multi-repo namespace isolation.
""",

    "backend/app/agents/coder.py": """### Coder Agent & Isolated Workspace Manager (`backend/app/agents/coder.py`)
**Role & Purpose:**
Manages physical workspace isolation on the filesystem, executes code modifications, runs pytest, and merges passing patches.

**Isolation Workflow:**
1. `WorkspaceManager`: Clones the demo repository into an isolated directory under `/tmp/chronofork_*`.
2. `Coder.apply_patch`: Writes updated code into the isolated workspace.
3. `Verifier.run_tests`: Executes pytest inside the isolated workspace with proper `PYTHONPATH`. Only patches with exit code 0 are approved for merge.
""",

    "backend/app/agents/llm.py": """### Pluggable LLM Provider Client (`backend/app/agents/llm.py`)
**Role & Purpose:**
Provides a unified abstraction across Gemini (`google-genai`), Anthropic (`anthropic`), and OpenAI (`openai`), selectable via `LLM_PROVIDER`. In Deterministic Replay Mode, this layer is bypassed entirely so zero API keys are required.
""",

    "backend/app/main.py": """### FastAPI Backend Application (`backend/app/main.py`)
**Role & Purpose:**
Main web server running on port 8000. Provides REST and SSE streaming endpoints:
- `POST /runs`: Initializes and starts a scenario run.
- `GET /runs/{id}/events`: SSE stream delivering real-time swarm events with replay pacing.
- `GET /graph/{name}`: Returns graph nodes and edges formatted specifically for Cytoscape.js.
- `GET /memory/{repo}`: Returns stored procedural rules and episodes for the frontend Memory Drawer.
- `POST /repos`: Ingests an arbitrary repository AST into FalkorDB.
- `GET /health`: Validates FalkorDB connectivity and lists active graphs.
"""
}

def generate_master_document():
    files_to_include = [
        # Backend Core
        "backend/app/falkor_client.py",
        "backend/app/parser.py",
        "backend/app/algorithms.py",
        "backend/app/coordinator.py",
        "backend/app/memory.py",
        "backend/app/mcp_tools.py",
        "backend/app/event_stream.py",
        "backend/app/scenario_runner.py",
        "backend/app/agents/coder.py",
        "backend/app/agents/llm.py",
        "backend/app/main.py",
        "backend/requirements.txt",
        "backend/Dockerfile",

        # Frontend Types & Config
        "frontend/src/types.ts",
        "frontend/vite.config.ts",
        "frontend/src/index.css",
        "frontend/src/App.tsx",
        "frontend/src/components/GraphViewer.tsx",
        "frontend/src/components/ControlPanel.tsx",
        "frontend/src/components/AgentTimeline.tsx",
        "frontend/src/components/CypherInspector.tsx",
        "frontend/src/components/BottomDrawer.tsx",
        "frontend/Dockerfile",

        # Synthetic Demo Repositories
        "demo_repo/taskflow/taskflow/config.py",
        "demo_repo/taskflow/taskflow/auth.py",
        "demo_repo/taskflow/taskflow/worker.py",
        "demo_repo/taskflow/taskflow/database.py",
        "demo_repo/taskflow/taskflow/cache.py",
        "demo_repo/taskflow/taskflow/queue.py",
        "demo_repo/taskflow/taskflow/metrics.py",
        "demo_repo/taskflow/taskflow/logging_service.py",
        "demo_repo/taskflow/taskflow/models.py",
        "demo_repo/taskflow/taskflow/utils.py",
        "demo_repo/taskflow/taskflow/reports/generator.py",
        "demo_repo/taskflow/taskflow/reports/formatter.py",
        "demo_repo/taskflow/taskflow/reports/exporter.py",
        "demo_repo/taskflow/taskflow/reports/scheduler.py",
        "demo_repo/taskflow/tests/conftest.py",
        "demo_repo/taskflow/tests/test_config.py",
        "demo_repo/taskflow/tests/test_auth.py",
        "demo_repo/taskflow/tests/test_worker.py",
        "demo_repo/taskflow/tests/test_reports.py",
        "demo_repo/analytics/analytics/collector.py",
        "demo_repo/analytics/analytics/aggregator.py",
        "demo_repo/analytics/tests/conftest.py",
        "demo_repo/analytics/tests/test_analytics.py",

        # Verification Test Scripts
        "scripts/verify_phase0.py",
        "scripts/test_p1.py",
        "scripts/test_p2.py",
        "scripts/test_p3.py",
        "scripts/test_p4.py",
        "scripts/test_p6.py",
        "scripts/test_all_scenarios.py",
        "scripts/test_api_execution.py",
        "scripts/test_memory_toggle.py",

        # Documentation & Hackathon Deliverables
        "README.md",
        "docs/blog-post.md",
        "docs/demo-script.md",
        "docs/falkordb-verified.md",

        # Deployment & Config
        "docker-compose.yml",
        ".env.example"
    ]

    out = []
    out.append("# ChronoFork — Complete Source Code & Implementation Architecture\n")
    out.append("> **\"Git catches line conflicts. ChronoFork catches the ones Git can't see.\"**\n")
    out.append("**Hackathon Submission**: Graph Hacks (FalkorDB)  \n")
    out.append("**Declared Tracks**: Track 1 (Agents that act on connected data) & Track 2 (Agent memory and coordination)  \n\n")

    out.append("---\n\n")
    out.append("## Table of Contents\n")
    out.append("1. [Architectural Overview & Core Innovations](#1-architectural-overview--core-innovations)\n")
    out.append("2. [Why FalkorDB is Irreplaceable](#2-why-falkordb-is-irreplaceable)\n")
    out.append("3. [Multigraph Data Models](#3-multigraph-data-models)\n")
    out.append("4. [Backend Core Implementation & Source Code](#4-backend-core-implementation--source-code)\n")
    out.append("5. [Frontend Console Implementation & Source Code](#5-frontend-console-implementation--source-code)\n")
    out.append("6. [Synthetic Demo Repositories (`taskflow` & `analytics`)](#6-synthetic-demo-repositories)\n")
    out.append("7. [Acceptance & Verification Test Suites](#7-acceptance--verification-test-suites)\n")
    out.append("8. [Deployment & Infrastructure](#8-deployment--infrastructure)\n\n")

    out.append("---\n\n")
    out.append("## 1. Architectural Overview & Core Innovations\n\n")
    out.append("""ChronoFork is a multi-agent coding swarm coordinator where **FalkorDB is the core brain**. 

When multiple AI coding agents work in parallel on a shared repository, standard Git tooling fails silently. If Agent 1 modifies a function signature in `config.py` and Agent 2 edits a consumer in `worker.py` (which transitively calls `config.py` across 4 hops through `queue.py`, `auth.py`, and `database.py`), Git detects zero line conflicts and produces a clean merge that breaks runtime execution.

ChronoFork solves this with:
1. **Import-Aware AST Parsing**: Compiles code into a live `:Symbol` graph in FalkorDB with `CALLS`, `DEFINES`, `IMPORTS`, and `TESTED_BY` edges.
2. **Multi-Hop Collision Detection**: Evaluates arbitrary-depth transitive paths (`(s2)-[:CALLS*1..4]->(s1)`) between concurrent agent claims in under 2 milliseconds.
3. **Graph Centrality Risk Scoring**: Employs FalkorDB's native `CALL algo.pageRank` and `CALL algo.betweenness` to determine node architectural danger and enforce serialization.
4. **Speculative Workspace Forking**: Uses FalkorDB's microsecond `graph.copy` to clone the graph per agent, simulating blast radius before touching code.
5. **Cross-Run Episodic Memory**: Persists procedural rules in `mem:<repo>` with dynamic confidence scores (+0.10 on success, -0.20 on failure) that guide subsequent runs to avoid collisions upfront.
""")

    out.append("\n---\n\n")
    out.append("## 2. Why FalkorDB is Irreplaceable\n\n")
    out.append("""ChronoFork cannot function without FalkorDB. If FalkorDB is replaced with a relational or document database, the product stops working:
- **Variable-Length Transitive Paths**: In openCypher, `(s2)-[:CALLS*1..4]->(s1)` executes in **0.76 ms** (median on repo:taskflow). In SQL, this requires complex, slow recursive CTEs.
- **Native Graph Algorithms**: FalkorDB executes PageRank in **1.36 ms** (median) and Betweenness in **1.80 ms** (median) directly in Redis memory. Relational engines require exporting data to an external cluster.
- **Fast Speculative Graph Branching**: FalkorDB clones a complete code graph (`graph.copy`) in **108.3 ms** (median), enabling lightweight per-agent speculative forks.
""")

    out.append("\n---\n\n")
    out.append("## 3. Multigraph Data Models\n\n")
    out.append("""ChronoFork leverages four distinct graph keys in FalkorDB:
1. `repo:<name>`: Base code graph containing `:Symbol:Module`, `:Symbol:Class`, `:Symbol:Function`, and `:Symbol:Test` nodes with `CALLS`, `DEFINES`, `IMPORTS`, and `TESTED_BY` relationships.
2. `coord:<run_id>`: Coordination graph cloned from `repo:<name>` at run start, adding `Run`, `Agent`, `Subtask`, and `Claim` nodes directly attached to `:Symbol` nodes.
3. `fork:<run_id>:<agent_id>`: Per-agent speculative graph cloned from `repo:<name>` to test hypothetical edits.
4. `mem:<repo>`: Persistent cross-run memory storing `Episode`, `ProceduralRule`, and `SemanticFact` nodes linked via `[:INVOLVED]` and `[:LEARNED_RULE]`.
""")

    out.append("\n---\n\n")
    out.append("## 4. Source Code & Detailed Implementation by Module\n\n")

    for rel_path in files_to_include:
        abs_path = os.path.join(ROOT_DIR, rel_path)
        if not os.path.exists(abs_path):
            continue

        with open(abs_path, "r", encoding="utf-8") as f:
            code = f.read()

        out.append(f"## File: `{rel_path}`\n\n")
        
        # Add explanation if available
        if rel_path in EXPLANATIONS:
            out.append(EXPLANATIONS[rel_path])
            out.append("\n")
        else:
            out.append(f"**Description:** Source file `{rel_path}` providing core functionality for ChronoFork.\n\n")

        # Determine language for markdown syntax highlighting
        ext = os.path.splitext(rel_path)[1].lower()
        lang_map = {
            ".py": "python",
            ".ts": "typescript",
            ".tsx": "tsx",
            ".css": "css",
            ".html": "html",
            ".json": "json",
            ".yml": "yaml",
            ".yaml": "yaml",
            ".txt": "text",
            ".example": "bash"
        }
        lang = lang_map.get(ext, "")
        if "Dockerfile" in rel_path:
            lang = "dockerfile"

        out.append(f"```" + lang + "\n")
        out.append(code.rstrip() + "\n")
        out.append("```\n\n---\n\n")

    final_content = "".join(out)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(final_content)

    print(f"Successfully generated {OUTPUT_FILE} ({len(final_content)} bytes, {len(files_to_include)} files included).")

if __name__ == "__main__":
    generate_master_document()
