"""FastMCP Tools Server and In-Process Tool Interface for ChronoFork.

Exposes official FastMCP tools:
  - `get_impact`
  - `rank_risk`
  - `claim_symbols`
  - `detect_collisions`
  - `recall_memory`
  - `fork_graph`
  - `record_episode`
"""

from typing import List, Dict, Any, Optional
try:
    from mcp.server.mcpserver import MCPServer as FastMCP
except Exception:
    try:
        from mcp.server.fastmcp import FastMCP
    except Exception:
        class FastMCP:
            def __init__(self, name: str):
                self.name = name
            def tool(self):
                def decorator(func):
                    return func
                return decorator

from backend.app.algorithms import query_impact, compute_risk_rankings
from backend.app.coordinator import (
    register_claim,
    detect_collisions as coord_detect_collisions,
    fork_agent_graph as coord_fork_graph
)
from backend.app.memory import (
    recall_memory as mem_recall_memory,
    record_episode as mem_record_episode
)

# FastMCP / MCPServer instance
mcp = FastMCP("chronofork-coordination-server")


@mcp.tool()
def get_impact(repo: str, symbol_qualname: str, max_depth: int = 4) -> Dict[str, Any]:
    """Computes multi-hop impact traversal over reverse CALLS edges plus affected tests."""
    graph_name = f"repo:{repo}" if not repo.startswith("repo:") else repo
    return query_impact(graph_name, symbol_qualname, max_depth)


@mcp.tool()
def rank_risk(repo: str) -> Dict[str, Dict[str, float]]:
    """Runs PageRank and Betweenness to rank symbol scarcity and risk scores."""
    graph_name = f"repo:{repo}" if not repo.startswith("repo:") else repo
    return compute_risk_rankings(graph_name)


@mcp.tool()
def claim_symbols(
    run_id: str,
    agent_id: str,
    symbol_qualname: str,
    intent: str,
    subtask: str = ""
) -> Dict[str, Any]:
    """Registers an agent's claim with intent (SIGNATURE_CHANGE, BODY_EDIT, DELETE, ADD)."""
    return register_claim(run_id, agent_id, symbol_qualname, intent, subtask)


@mcp.tool()
def detect_collisions(run_id: str) -> List[Dict[str, Any]]:
    """Executes native Cypher query across all claims to detect transitive collisions."""
    return coord_detect_collisions(run_id)


@mcp.tool()
def recall_memory(repo: str, candidate_symbols: List[str]) -> Dict[str, Any]:
    """Recalls procedural rules and past episodes linked to 2-hop neighbor symbols."""
    clean_repo = repo.replace("repo:", "").replace("mem:", "")
    return mem_recall_memory(clean_repo, candidate_symbols)


@mcp.tool()
def fork_graph(run_id: str, agent_id: str, repo: str) -> str:
    """Creates a speculative per-agent graph fork."""
    clean_repo = repo.replace("repo:", "")
    return coord_fork_graph(run_id, agent_id, clean_repo)


@mcp.tool()
def record_episode(
    repo: str,
    run_id: str,
    task: str,
    outcome: str,
    summary: str,
    involved_symbols: List[str],
    rule_learned: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Records an execution episode and updates procedural rules with confidence."""
    clean_repo = repo.replace("repo:", "").replace("mem:", "")
    return mem_record_episode(clean_repo, run_id, task, outcome, summary, involved_symbols, rule_learned)
