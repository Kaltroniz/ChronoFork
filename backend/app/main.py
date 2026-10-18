"""FastAPI Backend Application for ChronoFork.

Port: 8000
Endpoints:
  - POST /runs: Starts scenario execution with real git/pytest verification & memory toggle
  - GET /runs/{id}/events: SSE stream with in-memory buffering & delay_ms pacing
  - GET /graph/{name}: Returns nodes and edges formatted for Cytoscape.js with module clustering
  - POST /repos: Ingests repository AST into FalkorDB
  - GET /memory/{repo}: Returns rules and episodes for Memory Drawer
  - POST /memory/{repo}/reset: Resets memory graph for demo reproducibility
  - GET /health: Health status and FalkorDB connectivity
"""

import os
import time
import json
import asyncio
from typing import Dict, Any, Optional
from fastapi import FastAPI, Query, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.app.falkor_client import falkor_client
from backend.app.event_stream import event_bus
from backend.app.parser import parse_repository, ingest_code_graph_to_falkordb
from backend.app.algorithms import compute_risk_rankings
from backend.app.memory import reset_memory
from backend.app.scenario_runner import (
    execute_scenario_1,
    execute_scenario_2,
    execute_scenario_3,
    execute_scenario_4,
    ensure_demo_repos_ingested
)

REPLAYS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "replays"))


def get_replay_path(scenario: int, memory_enabled: bool) -> str:
    if scenario == 2:
        fname = "scenario_2_mem.json" if memory_enabled else "scenario_2.json"
    else:
        fname = f"scenario_{scenario}.json"
    return os.path.join(REPLAYS_DIR, fname)

app = FastAPI(title="ChronoFork Graph-Coordinated Coding Swarm API", version="1.0.0")

# Restrict CORS for secure production and local environments
cors_origins_env = os.getenv(
    "CORS_ORIGINS", 
    "http://localhost:5173,http://localhost:3000,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:3000,http://127.0.0.1:8000"
)
allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Auto-ingest demo repositories on startup."""
    try:
        ensure_demo_repos_ingested()
    except Exception as ex:
        print(f"Warning during startup repo ingestion: {ex}")


@app.get("/health")
def health_check():
    graphs = falkor_client.list_graphs()
    return {
        "status": "healthy",
        "falkordb_connected": True,
        "active_graphs": graphs
    }


class RunRequest(BaseModel):
    task: str = "Migrate load_config to return a ConfigObject and add retry logic to worker jobs"
    repo: str = "taskflow"
    scenario: Optional[int] = 1
    mode: str = "replay"  # "replay" or "live"
    memory_enabled: bool = True
    run_id: Optional[str] = None


@app.post("/runs")
async def start_run(req: RunRequest):
    """Initiates a coordination run or scenario replay."""
    run_id = req.run_id or f"run_{int(time.time() * 1000)}"
    demo_mode = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")

    # In DEMO_MODE, force replay mode
    req_mode = "replay" if demo_mode else req.mode
    cache_file = get_replay_path(req.scenario or 1, req.memory_enabled)

    # 1. Mode = Replay: Serve from cache instantly
    if req_mode == "replay" and os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached_events = json.load(f)

            event_bus.init_run(run_id)
            for evt in cached_events:
                evt_copy = dict(evt)
                evt_copy["run_id"] = run_id
                event_bus._buffers[run_id].append(evt_copy)
            event_bus.mark_completed(run_id)

            return {
                "run_id": run_id,
                "status": "REPLAY_CACHED",
                "scenario": req.scenario,
                "mode": "replay",
                "cached": True,
                "events_count": len(cached_events)
            }
        except Exception as ex:
            print(f"Warning: Failed to load replay cache {cache_file}: {ex}")

    # 2. Mode = Live (or cache missing): Execute live
    try:
        if req.scenario == 1:
            events = execute_scenario_1(run_id, mode=req_mode)
        elif req.scenario == 2:
            events = execute_scenario_2(run_id, memory_enabled=req.memory_enabled)
        elif req.scenario == 3:
            events = execute_scenario_3(run_id)
        elif req.scenario == 4:
            events = execute_scenario_4(run_id)
        else:
            events = execute_scenario_1(run_id, mode=req_mode)
    except Exception as ex:
        raise HTTPException(
            status_code=503,
            detail=f"Live run execution failed (FalkorDB connection refused or offline): {ex}"
        )

    # Save to live run record (canonical scenario_N.json are written only by scripts/regenerate_replays.py)
    try:
        os.makedirs(REPLAYS_DIR, exist_ok=True)
        live_run_file = os.path.join(REPLAYS_DIR, f"live_{run_id}.json")
        with open(live_run_file, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2)
    except Exception as ex:
        print(f"Warning: Failed to save live run log {live_run_file}: {ex}")

    return {
        "run_id": run_id,
        "status": "LIVE_EXECUTED",
        "scenario": req.scenario,
        "mode": "live",
        "cached": False,
        "events_count": len(events)
    }


@app.get("/runs/{run_id}/events")
async def get_run_events(run_id: str, delay_ms: int = Query(default=500)):
    """
    SSE stream endpoint. Replays buffered events from index 0 with requested delay_ms pacing.
    Guarantees no events are dropped due to connection timing.
    """
    return StreamingResponse(
        event_bus.stream_events(run_id, delay_ms=delay_ms),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/collisions/{run_id}")
def get_collisions(run_id: str):
    """Detect multi-hop collisions for a run coordination graph."""
    try:
        from backend.app.coordinator import detect_collisions
        return {"run_id": run_id, "collisions": detect_collisions(run_id)}
    except Exception as ex:
        raise HTTPException(
            status_code=503,
            detail=f"FalkorDB connection refused or offline: {ex}"
        )


@app.get("/graph/{graph_name}")
def get_graph_data(graph_name: str):
    """
    Returns nodes and edges formatted for Cytoscape.js.
    Supports parent module clustering and centrality risk scores.
    """
    try:
        graphs = falkor_client.list_graphs()
    except Exception as ex:
        raise HTTPException(
            status_code=503,
            detail=f"FalkorDB connection refused or offline: {ex}"
        )

    if graph_name not in graphs:
        if f"repo:{graph_name}" in graphs:
            graph_name = f"repo:{graph_name}"
        else:
            raise HTTPException(status_code=404, detail=f"Graph '{graph_name}' not found.")

    try:
        g = falkor_client.get_graph(graph_name)

        # Retrieve all Symbol nodes
        nodes_res = g.query("""
        MATCH (s:Symbol)
        RETURN s.qualname AS qualname, s.name AS name, labels(s) AS labels,
               s.path AS path, s.lineno AS lineno, s.signature_hash AS signature_hash
        """)
    except Exception as ex:
        raise HTTPException(
            status_code=503,
            detail=f"FalkorDB connection refused or offline: {ex}"
        )

    # Compute risk scores
    try:
        rankings = compute_risk_rankings(graph_name)
    except Exception:
        rankings = {}

    # Identify all module IDs for compound node clustering
    module_ids = set()
    for row in nodes_res.result_set:
        if "Module" in row[2]:
            module_ids.add(row[0])

    nodes = []
    for row in nodes_res.result_set:
        qid = row[0]
        labels = row[2]
        sublabel = "Function"
        if "Module" in labels:
            sublabel = "Module"
        elif "Class" in labels:
            sublabel = "Class"
        elif "Test" in labels:
            sublabel = "Test"

        node_rank = rankings.get(qid, {"pagerank": 0.0, "betweenness": 0.0, "risk_score": 0.0})

        node_data = {
            "id": qid,
            "name": row[1],
            "label": sublabel,
            "path": row[3],
            "lineno": row[4],
            "signature_hash": row[5],
            "pagerank": node_rank.get("pagerank", 0.0),
            "betweenness": node_rank.get("betweenness", 0.0),
            "risk_score": node_rank.get("risk_score", 0.0)
        }

        # Compound clustering: attach parent module
        if sublabel != "Module" and "." in qid:
            parent_mod = ".".join(qid.split(".")[:-1])
            if parent_mod in module_ids:
                node_data["parent"] = parent_mod

        nodes.append({"data": node_data})

    # Retrieve edges
    edges_res = g.query("""
    MATCH (src:Symbol)-[r]->(tgt:Symbol)
    RETURN src.qualname AS src, tgt.qualname AS tgt, type(r) AS rel_type
    """)

    edges = []
    for idx, row in enumerate(edges_res.result_set):
        edges.append({
            "data": {
                "id": f"e_{idx}_{row[0]}_{row[1]}",
                "source": row[0],
                "target": row[1],
                "label": row[2]
            }
        })

    return {
        "graph_name": graph_name,
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges)
    }


@app.get("/memory/{repo_name}")
def get_memory_data(repo_name: str):
    """Returns procedural rules and episodes stored in mem:<repo_name>."""
    mem_key = f"mem:{repo_name}"
    if mem_key not in falkor_client.list_graphs():
        return {"repo": repo_name, "rules": [], "episodes": []}

    g = falkor_client.get_graph(mem_key)

    rules_res = g.query("""
    MATCH (r:ProceduralRule)
    OPTIONAL MATCH (r)-[:INVOLVED]->(s:Symbol)
    RETURN r.id, r.rule, r.advice, r.confidence, r.samples, collect(DISTINCT s.qualname) AS symbols
    ORDER BY r.confidence DESC
    """)

    rules = []
    for row in rules_res.result_set:
        rules.append({
            "id": row[0],
            "rule": row[1],
            "advice": row[2],
            "confidence": round(float(row[3]), 2),
            "samples": row[4],
            "involved_symbols": row[5]
        })

    episodes_res = g.query("""
    MATCH (ep:Episode)
    RETURN ep.id, ep.run_id, ep.task, ep.outcome, ep.summary, ep.timestamp
    ORDER BY ep.timestamp DESC
    LIMIT 10
    """)

    episodes = []
    for row in episodes_res.result_set:
        episodes.append({
            "id": row[0],
            "run_id": row[1],
            "task": row[2],
            "outcome": row[3],
            "summary": row[4],
            "timestamp": row[5]
        })

    return {
        "repo": repo_name,
        "rules": rules,
        "episodes": episodes
    }


@app.post("/memory/{repo_name}/reset")
def reset_repo_memory(repo_name: str):
    """Resets memory graph for the repository to enable clean demo runs."""
    reset_memory(repo_name)
    return {"status": "SUCCESS", "message": f"Memory graph mem:{repo_name} has been reset."}


class IngestRequest(BaseModel):
    repo_name: str
    repo_path: str


@app.post("/repos")
def ingest_repo(req: IngestRequest):
    """Parses and ingests a repository into FalkorDB with path sanitization."""
    # Disable /repos endpoint completely when DEMO_MODE is active
    demo_mode = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")
    if demo_mode:
        raise HTTPException(status_code=403, detail="Repository upload and ingestion is disabled in Demo Mode.")

    # Sanitize path to prevent arbitrary directory traversal
    resolved_path = os.path.abspath(req.repo_path)
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    if not resolved_path.startswith(base_dir):
        raise HTTPException(status_code=403, detail="Repository path must reside within the project workspace.")
    if not os.path.exists(resolved_path):
        raise HTTPException(status_code=400, detail="Repository path does not exist.")

    cg = parse_repository(resolved_path, req.repo_name)
    stats = ingest_code_graph_to_falkordb(cg, falkor_client)
    return stats


# ---------------------------------------------------------------------------
# Live Gemini Mode Status & Diagnostic
# ---------------------------------------------------------------------------
from backend.app.agents.llm import llm_provider


@app.get("/api/llm/status")
def get_llm_status():
    """Returns the operational status and supported models for Live Gemini mode."""
    return llm_provider.get_status()


# ---------------------------------------------------------------------------
# MCP over HTTP (JSON-RPC 2.0 Endpoint for External Agents)
# ---------------------------------------------------------------------------
from backend.app.mcp_tools import (
    get_impact as mcp_get_impact,
    rank_risk as mcp_rank_risk,
    claim_symbols as mcp_claim_symbols,
    detect_collisions as mcp_detect_collisions,
    recall_memory as mcp_recall_memory,
    fork_graph as mcp_fork_graph,
    record_episode as mcp_record_episode,
)

MCP_TOOLS_MANIFEST = [
    {
        "name": "get_impact",
        "description": "Computes multi-hop impact traversal over reverse CALLS edges plus affected tests.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Repository name (e.g. 'taskflow')"},
                "symbol_qualname": {"type": "string", "description": "Qualified symbol name"},
                "max_depth": {"type": "integer", "default": 4, "description": "Max call hops to traverse"}
            },
            "required": ["repo", "symbol_qualname"]
        }
    },
    {
        "name": "rank_risk",
        "description": "Runs PageRank and Betweenness on FalkorDB to calculate symbol risk rankings.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Repository name"}
            },
            "required": ["repo"]
        }
    },
    {
        "name": "claim_symbols",
        "description": "Registers an agent's claim with intent (SIGNATURE_CHANGE, BODY_EDIT, DELETE, ADD).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "run_id": {"type": "string"},
                "agent_id": {"type": "string"},
                "symbol_qualname": {"type": "string"},
                "intent": {"type": "string", "enum": ["SIGNATURE_CHANGE", "BODY_EDIT", "DELETE", "ADD"]},
                "subtask": {"type": "string"}
            },
            "required": ["run_id", "agent_id", "symbol_qualname", "intent"]
        }
    },
    {
        "name": "detect_collisions",
        "description": "Executes native Cypher query across all claims to detect transitive collisions.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "run_id": {"type": "string"}
            },
            "required": ["run_id"]
        }
    },
    {
        "name": "recall_memory",
        "description": "Recalls procedural rules and past episodes linked to symbols.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string"},
                "candidate_symbols": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["repo", "candidate_symbols"]
        }
    },
    {
        "name": "fork_graph",
        "description": "Creates a speculative per-agent graph fork.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "run_id": {"type": "string"},
                "agent_id": {"type": "string"},
                "repo": {"type": "string"}
            },
            "required": ["run_id", "agent_id", "repo"]
        }
    },
    {
        "name": "record_episode",
        "description": "Records an execution episode and updates procedural rules with confidence.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string"},
                "run_id": {"type": "string"},
                "task": {"type": "string"},
                "outcome": {"type": "string"},
                "summary": {"type": "string"},
                "involved_symbols": {"type": "array", "items": {"type": "string"}},
                "rule_learned": {"type": "object"}
            },
            "required": ["repo", "run_id", "task", "outcome", "summary", "involved_symbols"]
        }
    }
]


@app.get("/mcp")
def mcp_info():
    """Information endpoint for the Model Context Protocol over HTTP interface."""
    return {
        "status": "online",
        "protocol": "mcp-http",
        "protocolVersion": "2024-11-05",
        "serverInfo": {"name": "chronofork-coordination-server", "version": "1.0.0"},
        "tools_count": len(MCP_TOOLS_MANIFEST),
        "endpoint": "/mcp"
    }


@app.post("/mcp")
async def mcp_rpc_handler(request_data: Dict[str, Any]):
    """Standard Model Context Protocol (MCP) JSON-RPC 2.0 handler over HTTP."""
    msg_id = request_data.get("id")
    method = request_data.get("method")
    params = request_data.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "chronofork-coordination-server", "version": "1.0.0"}
            }
        }

    if method in ("notifications/initialized", "ping"):
        return {"jsonrpc": "2.0", "id": msg_id, "result": {}}

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"tools": MCP_TOOLS_MANIFEST}
        }

    if method == "tools/call":
        tool_name = params.get("name")
        tool_args = params.get("arguments", {})

        try:
            if tool_name == "get_impact":
                res = mcp_get_impact(
                    repo=tool_args.get("repo", "taskflow"),
                    symbol_qualname=tool_args.get("symbol_qualname", ""),
                    max_depth=int(tool_args.get("max_depth", 4))
                )
            elif tool_name == "rank_risk":
                res = mcp_rank_risk(repo=tool_args.get("repo", "taskflow"))
            elif tool_name == "claim_symbols":
                res = mcp_claim_symbols(
                    run_id=tool_args.get("run_id", ""),
                    agent_id=tool_args.get("agent_id", ""),
                    symbol_qualname=tool_args.get("symbol_qualname", ""),
                    intent=tool_args.get("intent", "BODY_EDIT"),
                    subtask=tool_args.get("subtask", "")
                )
            elif tool_name == "detect_collisions":
                res = mcp_detect_collisions(run_id=tool_args.get("run_id", ""))
            elif tool_name == "recall_memory":
                res = mcp_recall_memory(
                    repo=tool_args.get("repo", "taskflow"),
                    candidate_symbols=tool_args.get("candidate_symbols", [])
                )
            elif tool_name == "fork_graph":
                res = mcp_fork_graph(
                    run_id=tool_args.get("run_id", ""),
                    agent_id=tool_args.get("agent_id", ""),
                    repo=tool_args.get("repo", "taskflow")
                )
            elif tool_name == "record_episode":
                res = mcp_record_episode(
                    repo=tool_args.get("repo", "taskflow"),
                    run_id=tool_args.get("run_id", ""),
                    task=tool_args.get("task", ""),
                    outcome=tool_args.get("outcome", "SUCCESS"),
                    summary=tool_args.get("summary", ""),
                    involved_symbols=tool_args.get("involved_symbols", []),
                    rule_learned=tool_args.get("rule_learned")
                )
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {"code": -32601, "message": f"Method or tool '{tool_name}' not found"}
                }

            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [{"type": "text", "text": json.dumps(res, indent=2)}]
                }
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {"code": -32603, "message": f"Tool execution failed: {e}"}
            }

    return {
        "jsonrpc": "2.0",
        "id": msg_id,
        "error": {"code": -32601, "message": f"Unrecognized JSON-RPC method: {method}"}
    }


# ---------------------------------------------------------------------------
# Public Hosting & Static SPA Frontend Mounting
# ---------------------------------------------------------------------------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if os.path.isdir(DIST_DIR):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str):
        """Serves compiled frontend assets and falls back to index.html for SPA routes."""
        # Never intercept API or MCP endpoints
        if (
            full_path.startswith("api/")
            or full_path.startswith("runs")
            or full_path.startswith("graph/")
            or full_path.startswith("memory/")
            or full_path.startswith("collisions/")
            or full_path.startswith("health")
            or full_path.startswith("mcp")
            or full_path.startswith("repos")
        ):
            raise HTTPException(status_code=404, detail="API route not found")

        file_path = os.path.join(DIST_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)

        index_path = os.path.join(DIST_DIR, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)

        raise HTTPException(status_code=404, detail="Frontend index.html not found")

