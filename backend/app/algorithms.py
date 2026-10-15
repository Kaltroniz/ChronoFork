"""Graph Algorithms and Impact Analysis Queries on FalkorDB."""

from typing import List, Dict, Any, Optional
from backend.app.falkor_client import falkor_client


def run_pagerank(graph_name: str) -> Dict[str, float]:
    """Runs PageRank over (:Symbol, 'CALLS') on specified graph."""
    query = """
    CALL algo.pageRank('Symbol', 'CALLS') YIELD node, score
    RETURN node.qualname AS qualname, score
    ORDER BY score DESC
    """
    res, _ = falkor_client.query(graph_name, query)
    scores = {}
    for row in res.result_set:
        scores[row[0]] = float(row[1])
    return scores


def run_betweenness(graph_name: str, sampling_size: int = 32) -> Dict[str, float]:
    """Runs Betweenness Centrality over (:Symbol, 'CALLS')."""
    query = f"""
    CALL algo.betweenness({{
      nodeLabels: ['Symbol'],
      relationshipTypes: ['CALLS'],
      samplingSize: {sampling_size},
      samplingSeed: 42
    }}) YIELD node, score
    RETURN node.qualname AS qualname, score
    ORDER BY score DESC
    """
    res, _ = falkor_client.query(graph_name, query)
    scores = {}
    for row in res.result_set:
        scores[row[0]] = float(row[1])
    return scores


def compute_risk_rankings(graph_name: str) -> Dict[str, Dict[str, float]]:
    """
    Computes unified Scarcity/Risk ranking across symbols combining PageRank and Betweenness.
    Returns: {qualname: {'pagerank': float, 'betweenness': float, 'risk_score': float}}
    """
    pr_scores = run_pagerank(graph_name)
    bw_scores = run_betweenness(graph_name)

    all_keys = set(pr_scores.keys()) | set(bw_scores.keys())
    if not all_keys:
        return {}

    max_pr = max(pr_scores.values()) if pr_scores and max(pr_scores.values()) > 0 else 1.0
    max_bw = max(bw_scores.values()) if bw_scores and max(bw_scores.values()) > 0 else 1.0

    rankings = {}
    for k in all_keys:
        pr_norm = (pr_scores.get(k, 0.0) / max_pr)
        bw_norm = (bw_scores.get(k, 0.0) / max_bw)
        risk = 0.5 * pr_norm + 0.5 * bw_norm
        rankings[k] = {
            "pagerank": round(pr_scores.get(k, 0.0), 6),
            "betweenness": round(bw_scores.get(k, 0.0), 4),
            "risk_score": round(risk, 4)
        }
    return rankings


def query_impact(graph_name: str, symbol_qualname: str, max_depth: int = 4) -> Dict[str, Any]:
    """
    Multi-hop impact analysis traversal over reverse CALLS edges plus affected tests.
    """
    if not graph_name.startswith("repo:") and not graph_name.startswith("fork:"):
        graph_name = f"repo:{graph_name}"

    # 1. Reverse callers traversal: symbols that directly or transitively call the target symbol
    callers_query = f"""
    MATCH path = (caller:Symbol)-[:CALLS*1..{max_depth}]->(target:Symbol {{qualname: $target_qname}})
    RETURN caller.qualname AS caller, caller.path AS file_path, length(path) AS depth, [n in nodes(path) | n.qualname] AS chain
    ORDER BY depth, caller
    """
    callers_res, t_callers = falkor_client.query(
        graph_name, callers_query, {"target_qname": symbol_qualname}, tool="get_impact"
    )

    dependent_callers = []
    seen = set()
    for row in callers_res.result_set:
        c_qname = row[0]
        if c_qname not in seen:
            seen.add(c_qname)
            dependent_callers.append({
                "qualname": c_qname,
                "file_path": row[1],
                "depth": int(row[2]),
                "chain": row[3]
            })

    # 2. Affected tests: tests that test target symbol directly or through transitive callers
    tests_query = f"""
    MATCH (target:Symbol {{qualname: $target_qname}})<-[:CALLS*0..{max_depth}]-(sym:Symbol)-[:TESTED_BY]->(tst:Symbol:Test)
    RETURN DISTINCT tst.qualname AS test_name, tst.path AS test_path, tst.lineno AS lineno
    ORDER BY test_name
    """
    tests_res, t_tests = falkor_client.query(
        graph_name, tests_query, {"target_qname": symbol_qualname}, tool="get_impact"
    )

    affected_tests = [
        {"test_name": row[0], "test_path": row[1], "lineno": int(row[2])}
        for row in tests_res.result_set
    ]

    return {
        "target": symbol_qualname,
        "dependent_callers_count": len(dependent_callers),
        "dependent_callers": dependent_callers,
        "affected_tests_count": len(affected_tests),
        "affected_tests": affected_tests,
        "query_time_ms": round(t_callers + t_tests, 2)
    }


def find_shortest_call_path(graph_name: str, src_qualname: str, tgt_qualname: str) -> Optional[Dict[str, Any]]:
    """
    Finds the shortest call path from src to tgt using algo.SPpaths.
    Returns: {'path_nodes': List[str], 'hops': int} or None
    """
    query = """
    MATCH (src:Symbol {qualname: $src_qname}), (tgt:Symbol {qualname: $tgt_qname})
    CALL algo.SPpaths({
      sourceNode: src,
      targetNode: tgt,
      relTypes: ['CALLS']
    }) YIELD path
    RETURN [n in nodes(path) | n.qualname] AS path_nodes, length(path) AS hops
    """
    res, _ = falkor_client.query(graph_name, query, {"src_qname": src_qualname, "tgt_qname": tgt_qualname})
    if res.result_set:
        row = res.result_set[0]
        return {
            "path_nodes": row[0],
            "hops": int(row[1])
        }
    return None
