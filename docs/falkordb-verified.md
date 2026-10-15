# FalkorDB Live Syntax & Verification Results

> **Environment**: FalkorDB v4.22.1 running on Redis v8.10.2 via official `falkordb/falkordb:latest` Docker image. Python SDK `falkordb` v1.8.0.
> **Date Verified**: October 15, 2026.
> **Verification Script**: `scripts/verify_phase0.py` executed against live instance.

---

## 1. Graph Copy (`GRAPH.COPY` / `graph.copy`)

### Working Syntax
- **Cypher / Redis Command**: `GRAPH.COPY <src> <dest>`
- **Python SDK**: `cloned_graph = graph.copy(clone_name)`

### Behavior when Target Already Exists
- When the destination graph key already exists in FalkorDB, `graph.copy` **raises an exception**:
  ```text
  ResponseError: destination key already exists
  ```
- **Required Production Pattern**: Always verify existence and delete any stale target graph before copying:
  ```python
  if target_graph_name in db.list_graphs():
      db.select_graph(target_graph_name).delete()
  cloned_graph = base_graph.copy(target_graph_name)
  ```

### Live Benchmark
- 10-node, 9-edge graph copied in **36.50ms – 84.81ms**.
- Node and edge counts in cloned graph match source 1:1.

---

## 2. PageRank Algorithm (`algo.pageRank`)

### Working Syntax
```cypher
CALL algo.pageRank(nodeLabel, relationshipType) YIELD node, score
```
*Example:*
```cypher
CALL algo.pageRank('Symbol', 'CALLS') 
YIELD node, score 
RETURN node.name, score 
ORDER BY score DESC
```

### Signature Requirements & Caveats
- Requires **exactly 2 positional string arguments**: `nodeLabel` (String) and `relationshipType` (String).
- Calling without arguments (`CALL algo.pageRank()`) fails with:
  ```text
  ResponseError: Procedure `algo.pageRank` requires 2 arguments, got 0
```
- Yields `node` (Node object) and `score` (Float).
- Centrality values sum to `1.0` across all matching nodes in the component.

### Live Benchmark
- Execution time: **19.30ms – 21.73ms** on 10-node graph.
- Highest ranked sink node: `Node E` (score = 0.225993), followed by `Node D` (0.218103) and `Node C` (0.168242).

---

## 3. Betweenness Centrality (`algo.betweenness`)

### Working Syntax (Map Form)
```cypher
CALL algo.betweenness({
  nodeLabels: ['Symbol'], 
  relationshipTypes: ['CALLS'], 
  samplingSize: 32, 
  samplingSeed: 42
}) 
YIELD node, score 
RETURN node.name, score 
ORDER BY score DESC
```

### Verified Keys & Types
- `nodeLabels`: List of strings (`['Symbol']`)
- `relationshipTypes`: List of strings (`['CALLS']`)
- `samplingSize`: Integer (`32`)
- `samplingSeed`: Integer (`42`)
- Yields: `node` (Node object) and `score` (Float)

### Live Benchmark
- Execution time: **7.67ms – 13.62ms** on 10-node graph.
- Successfully identified graph bottleneck: `Node C` scored **16.000000** (critical bridge node), `B` and `D` scored **9.000000**, while leaf nodes scored **0.000000**.

---

## 4. Path Queries: `shortestPath`, `algo.SPpaths`, and Variable-Length Paths

### 4.1 Cypher `shortestPath`
- **Important Syntax Restriction Discovered in Live Verification**:
  ```cypher
  -- FAILS: MATCH (a), (b), p = shortestPath(...)
  ResponseError: FalkorDB currently only supports shortestPaths in WITH or RETURN clauses
  ```
- **Working Syntax 1 (WITH clause)**:
  ```cypher
  MATCH (src:Symbol {name: 'A'}), (tgt:Symbol {name: 'E'})
  WITH shortestPath((src)-[:CALLS*1..5]->(tgt)) AS p
  RETURN [n in nodes(p) | n.name] AS path_names, length(p) AS hops
  ```
  *Measured time: **25.20ms** (Returns: `['A', 'B', 'C', 'D', 'E']`, hops: 4)*
- **Working Syntax 2 (RETURN clause)**:
  ```cypher
  MATCH (src:Symbol {name: 'A'}), (tgt:Symbol {name: 'E'})
  RETURN shortestPath((src)-[:CALLS*1..5]->(tgt)) AS p
  ```
  *Measured time: **13.02ms** (Returns native Path object with 5 nodes, 4 edges)*

### 4.2 Algorithm `algo.SPpaths`
- High-performance algorithm procedure:
  ```cypher
  MATCH (src:Symbol {name: 'A'}), (tgt:Symbol {name: 'E'})
  CALL algo.SPpaths({
    sourceNode: src, 
    targetNode: tgt, 
    relTypes: ['CALLS']
  }) 
  YIELD path 
  RETURN [n in nodes(path) | n.name] AS p, length(path) AS l
  ```
  *Measured time: **2.02ms – 4.30ms** (Ultra-fast Dijkstra / BFS)*

### 4.3 Variable-Length Cypher Path Pattern (1..4 hops)
- Finding all multi-hop call chains:
  ```cypher
  MATCH p = (src:Symbol {name: 'A'})-[:CALLS*1..4]->(tgt:Symbol)
  RETURN src.name, tgt.name, [n in nodes(p) | n.name] AS chain, length(p) AS hops
  ORDER BY hops, tgt.name
  ```
  *Measured time: **4.12ms – 4.31ms** (Retrieved all 8 transitive paths)*

---

## 5. Listing and Deleting Graphs

### Working Syntax
- **List Graphs**:
  ```python
  graph_names = db.list_graphs()  # Returns: ['verify_toy', 'verify_toy_clone']
  ```
- **Delete Graph**:
  ```python
  g = db.select_graph('verify_toy')
  g.delete()  # Completely removes the graph key
  ```
- **Cypher / Redis Equivalent**: `GRAPH.DELETE <name>`
- After deletion, graph name is cleanly removed from `db.list_graphs()`.

---

## Summary of Critical Verification Rules for ChronoFork Implementation
1. **Always clean target before copy**: Call `target_graph.delete()` if target exists prior to `GRAPH.COPY`.
2. **PageRank requires 2 string args**: Use `'Symbol'` and `'CALLS'`. Every node in repo graph must carry the `:Symbol` label so PageRank and Betweenness compute uniform relative importance across Modules, Functions, and Classes.
3. **ShortestPath constraint**: Do not assign `p = shortestPath(...)` directly in `MATCH`; use `WITH shortestPath(...) AS p` or `CALL algo.SPpaths`.
4. **Sub-5ms Path Queries**: `algo.SPpaths` and native variable-length Cypher patterns execute in under 5ms, ideal for real-time coordinator collision queries during agent execution.
