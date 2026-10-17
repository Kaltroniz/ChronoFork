"""ChronoFork Memory Graph (mem:<repo>): Episodes, Procedural Rules, and Confidence Tracking.

Stores long-term agent memories across runs:
  - Episode: Past execution outcomes and lessons.
  - ProceduralRule: Reusable guidelines with dynamic confidence scores (rising on success, falling on failure).
  - Dynamic heuristic confidence strictly clamped [0.10, 0.99] with single-path updates.
  - Reset and inspection capabilities for recording demonstrations.
"""

import time
import uuid
from typing import List, Dict, Any, Optional
from backend.app.falkor_client import falkor_client


def get_memory_graph_name(repo_name: str) -> str:
    return f"mem:{repo_name}"


def init_memory_graph(repo_name: str) -> str:
    """Ensures memory graph exists and has indexes."""
    mem_key = get_memory_graph_name(repo_name)
    g = falkor_client.get_graph(mem_key)
    try:
        g.query("CREATE INDEX FOR (s:Symbol) ON (s.qualname)")
        g.query("CREATE INDEX FOR (r:ProceduralRule) ON (r.id)")
    except Exception:
        pass
    return mem_key


def reset_memory(repo_name: str) -> None:
    """Wipes mem:<repo> completely for a clean state."""
    mem_key = get_memory_graph_name(repo_name)
    falkor_client.delete_graph(mem_key)
    init_memory_graph(repo_name)


def record_episode(
    repo_name: str,
    run_id: str,
    task: str,
    outcome: str,
    summary: str,
    involved_symbols: List[str],
    rule_learned: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Records an execution episode and links it to involved symbols and procedural rules.
    Does NOT update rule confidence here (single-responsibility: update_rule_confidence handles updates).
    """
    mem_key = get_memory_graph_name(repo_name)
    init_memory_graph(repo_name)
    
    ep_id = f"ep_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    now_ts = int(time.time())

    # Create Episode node
    create_ep_query = """
    CREATE (ep:Episode {
      id: $ep_id,
      run_id: $run_id,
      task: $task,
      outcome: $outcome,
      summary: $summary,
      timestamp: $ts
    })
    """
    falkor_client.query(mem_key, create_ep_query, {
        "ep_id": ep_id,
        "run_id": run_id,
        "task": task,
        "outcome": outcome,
        "summary": summary,
        "ts": now_ts
    })

    # Link Episode to involved symbols
    for qname in involved_symbols:
        link_sym_query = """
        MERGE (s:Symbol {qualname: $qname})
        WITH s
        MATCH (ep:Episode {id: $ep_id})
        MERGE (ep)-[:INVOLVED]->(s)
        """
        falkor_client.query(mem_key, link_sym_query, {"ep_id": ep_id, "qname": qname})

    # Record or link ProceduralRule if provided
    # Record or link ProceduralRule if provided
    rule_id = None
    if rule_learned:
        rule_id = rule_learned.get("id") or f"rule_{uuid.uuid4().hex[:6]}"
        rule_text = rule_learned.get("rule", "")
        advice_text = rule_learned.get("advice", "")
        rec_intent = rule_learned.get("recommended_intent", "BODY_EDIT")
        initial_conf = float(rule_learned.get("confidence", 0.85))

        # Upsert rule without double-counting confidence
        rule_query = """
        MERGE (r:ProceduralRule {id: $rule_id})
        ON CREATE SET r.rule = $rule,
                      r.advice = $advice,
                      r.recommended_intent = $rec_intent,
                      r.confidence = $conf,
                      r.samples = 1,
                      r.created_at = $ts
        ON MATCH SET r.recommended_intent = $rec_intent
        WITH r
        MATCH (ep:Episode {id: $ep_id})
        MERGE (ep)-[:LEARNED_RULE]->(r)
        """
        falkor_client.query(mem_key, rule_query, {
            "rule_id": rule_id,
            "rule": rule_text,
            "advice": advice_text,
            "rec_intent": rec_intent,
            "conf": initial_conf,
            "ts": now_ts,
            "ep_id": ep_id
        }, tool="record_episode")

        # Link rule to involved symbols
        for qname in involved_symbols:
            falkor_client.query(mem_key, """
            MATCH (r:ProceduralRule {id: $rule_id}), (s:Symbol {qualname: $qname})
            MERGE (r)-[:INVOLVED]->(s)
            """, {"rule_id": rule_id, "qname": qname}, tool="record_episode")

    return {
        "episode_id": ep_id,
        "rule_id": rule_id,
        "outcome": outcome,
        "involved_symbols": involved_symbols
    }


def recall_memory(repo_name: str, candidate_symbols: List[str]) -> Dict[str, Any]:
    """
    Recalls rules and past episodes related to the given candidate symbols or their call neighbors.
    Step 1: Get 2-hop neighbor symbols from code graph repo:<name>.
    Step 2: Query mem:<name> for rules and episodes linked to any of these symbols.
    """
    code_graph_key = f"repo:{repo_name}"
    mem_key = get_memory_graph_name(repo_name)
    
    if mem_key not in falkor_client.list_graphs():
        return {"rules": [], "episodes": [], "recalled_count": 0}

    # Step 1: Query 2-hop neighborhood in code graph
    expanded_symbols = set(candidate_symbols)
    if code_graph_key in falkor_client.list_graphs():
        cg = falkor_client.get_graph(code_graph_key)
        for sym in candidate_symbols:
            neighbor_query = """
            MATCH (s:Symbol {qualname: $sym})-[:CALLS*0..2]-(neighbor:Symbol)
            RETURN DISTINCT neighbor.qualname
            """
            try:
                res, _ = falkor_client.query(code_graph_key, neighbor_query, {"sym": sym}, tool="recall_memory")
                for row in res.result_set:
                    expanded_symbols.add(row[0])
            except Exception:
                pass

    # Step 2: Query mem:<repo> for ProceduralRules
    rules_query = """
    MATCH (s:Symbol)<-[:INVOLVED]-(r:ProceduralRule)
    WHERE s.qualname IN $qnames
    RETURN DISTINCT r.id AS id, r.rule AS rule, r.advice AS advice, r.confidence AS confidence, r.samples AS samples, s.qualname AS trigger_symbol, r.recommended_intent AS recommended_intent
    ORDER BY r.confidence DESC
    """
    rules_res, _ = falkor_client.query(mem_key, rules_query, {"qnames": list(expanded_symbols)}, tool="recall_memory")
    
    rules = []
    for row in rules_res.result_set:
        conf = float(row[3])
        clamped_conf = round(max(0.10, min(0.99, conf)), 2)
        rules.append({
            "id": row[0],
            "rule": row[1],
            "advice": row[2],
            "confidence": clamped_conf,
            "samples": int(row[4]),
            "trigger_symbol": row[5],
            "recommended_intent": row[6] or "BODY_EDIT"
        })

    # Step 3: Query mem:<repo> for Episodes
    episodes_query = """
    MATCH (s:Symbol)<-[:INVOLVED]-(ep:Episode)
    WHERE s.qualname IN $qnames
    RETURN DISTINCT ep.id, ep.run_id, ep.task, ep.outcome, ep.summary, ep.timestamp, s.qualname
    ORDER BY ep.timestamp DESC
    LIMIT 10
    """
    ep_res, _ = falkor_client.query(mem_key, episodes_query, {"qnames": list(expanded_symbols)})
    
    episodes = []
    for row in ep_res.result_set:
        episodes.append({
            "id": row[0],
            "run_id": row[1],
            "task": row[2],
            "outcome": row[3],
            "summary": row[4],
            "timestamp": row[5],
            "symbol": row[6]
        })

    return {
        "candidate_symbols": candidate_symbols,
        "expanded_symbols_checked": len(expanded_symbols),
        "rules": rules,
        "episodes": episodes,
        "recalled_count": len(rules) + len(episodes)
    }


def update_rule_confidence(repo_name: str, rule_id: str, success: bool) -> float:
    """
    Single source of truth for rule confidence updates.
    Raises confidence by +0.10 on verified success, lowers by -0.20 on failure.
    Strictly clamped between 0.10 and 0.99.
    """
    mem_key = get_memory_graph_name(repo_name)
    delta = 0.10 if success else -0.20
    query = """
    MATCH (r:ProceduralRule {id: $rule_id})
    SET r.confidence = CASE 
      WHEN r.confidence + $delta > 0.99 THEN 0.99 
      WHEN r.confidence + $delta < 0.10 THEN 0.10 
      ELSE r.confidence + $delta END,
      r.samples = r.samples + 1,
      r.updated_at = timestamp()
    RETURN r.confidence
    """
    res, _ = falkor_client.query(mem_key, query, {"rule_id": rule_id, "delta": delta})
    if res.result_set:
        return round(float(res.result_set[0][0]), 2)
    return 0.50
