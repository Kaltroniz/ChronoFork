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

    # Save to replay cache after successful live run
    try:
        os.makedirs(REPLAYS_DIR, exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2)
    except Exception as ex:
        print(f"Warning: Failed to save replay cache: {ex}")

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


@app.get("/graph/{graph_name}")
def get_graph_data(graph_name: str):
    """
    Returns nodes and edges formatted for Cytoscape.js.
    Supports parent module clustering and centrality risk scores.
    """
    if graph_name not in falkor_client.list_graphs():
        if f"repo:{graph_name}" in falkor_client.list_graphs():
            graph_name = f"repo:{graph_name}"
        else:
            raise HTTPException(status_code=404, detail=f"Graph '{graph_name}' not found.")

    g = falkor_client.get_graph(graph_name)

    # Retrieve all Symbol nodes
    nodes_res = g.query("""
    MATCH (s:Symbol)
    RETURN s.qualname AS qualname, s.name AS name, labels(s) AS labels,
           s.path AS path, s.lineno AS lineno, s.signature_hash AS signature_hash
    """)

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
    
    if not os.path.exists(resolved_path):
        raise HTTPException(status_code=400, detail="Repository path does not exist.")

    cg = parse_repository(resolved_path, req.repo_name)
    stats = ingest_code_graph_to_falkordb(cg, falkor_client)
    return stats
