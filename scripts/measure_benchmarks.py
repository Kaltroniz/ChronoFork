import sys
import time
import statistics
import redis

client = redis.Redis(host='localhost', port=6379, decode_responses=True)

print("="*60)
print("FalkorDB Queries and Latencies on repo:taskflow (20 runs each)")
print("="*60)

# Check graph size
size_res = client.execute_command(
    "GRAPH.QUERY", "repo:taskflow",
    "MATCH (s:Symbol) RETURN count(s) AS symbols"
)
symbols_cnt = size_res[1][0][0]

calls_res = client.execute_command(
    "GRAPH.QUERY", "repo:taskflow",
    "MATCH ()-[r:CALLS]->() RETURN count(r) AS calls"
)
calls_cnt = calls_res[1][0][0]

tests_res = client.execute_command(
    "GRAPH.QUERY", "repo:taskflow",
    "MATCH ()-[r:TESTED_BY]->() RETURN count(r) AS tests"
)
tests_cnt = tests_res[1][0][0]

print(f"Graph repo:taskflow size: {symbols_cnt} symbols, {calls_cnt} CALLS, {tests_cnt} TESTED_BY\n")

# 1. graph.copy latency (20 runs)
copy_latencies = []
for i in range(20):
    dest = f"bench:copy:{i}"
    try:
        client.execute_command("GRAPH.DELETE", dest)
    except Exception:
        pass
    t0 = time.perf_counter()
    client.execute_command("GRAPH.COPY", "repo:taskflow", dest)
    t1 = time.perf_counter()
    copy_latencies.append((t1 - t0) * 1000)
    try:
        client.execute_command("GRAPH.DELETE", dest)
    except Exception:
        pass

print(f"graph.copy (20 runs): min={min(copy_latencies):.3f}ms, median={statistics.median(copy_latencies):.3f}ms, max={max(copy_latencies):.3f}ms")

# 2. pageRank latency (20 runs)
pr_latencies = []
for _ in range(20):
    t0 = time.perf_counter()
    client.execute_command("GRAPH.QUERY", "repo:taskflow", "CALL algo.pageRank('Symbol', 'CALLS') YIELD node, score RETURN node.qualname, score")
    t1 = time.perf_counter()
    pr_latencies.append((t1 - t0) * 1000)

print(f"pageRank (20 runs): min={min(pr_latencies):.3f}ms, median={statistics.median(pr_latencies):.3f}ms, max={max(pr_latencies):.3f}ms")

# 3. betweenness latency (20 runs)
bw_latencies = []
bw_q = """
CALL algo.betweenness({
  nodeLabels: ['Symbol'],
  relationshipTypes: ['CALLS'],
  samplingSize: 32,
  samplingSeed: 42
}) YIELD node, score
RETURN node.qualname AS qualname, score
"""
for _ in range(20):
    t0 = time.perf_counter()
    client.execute_command("GRAPH.QUERY", "repo:taskflow", bw_q)
    t1 = time.perf_counter()
    bw_latencies.append((t1 - t0) * 1000)

print(f"betweenness (20 runs): min={min(bw_latencies):.3f}ms, median={statistics.median(bw_latencies):.3f}ms, max={max(bw_latencies):.3f}ms")

# 4. collision query latency (20 runs)
col_q = """
MATCH (s2:Symbol {qualname: 'taskflow.worker.execute_job'})
MATCH (s1:Symbol {qualname: 'taskflow.config.load_config'})
MATCH path = (s2)-[:CALLS*1..4]->(s1)
RETURN [n in nodes(path) | n.qualname] AS path_nodes, length(path) AS hops
"""
col_latencies = []
for _ in range(20):
    t0 = time.perf_counter()
    client.execute_command("GRAPH.QUERY", "repo:taskflow", col_q)
    t1 = time.perf_counter()
    col_latencies.append((t1 - t0) * 1000)

print(f"collision query (20 runs): min={min(col_latencies):.3f}ms, median={statistics.median(col_latencies):.3f}ms, max={max(col_latencies):.3f}ms\n")

print("-" * 60)
print("PATH EXISTENCE QUERIES (NO INTENT FILTER) ON CONTROLS:")
print("-" * 60)

# S1 Pair: execute_job -> load_config
s1_res = client.execute_command(
    "GRAPH.QUERY", "repo:taskflow",
    """
    MATCH (s2:Symbol {qualname: 'taskflow.worker.execute_job'}), (s1:Symbol {qualname: 'taskflow.config.load_config'})
    MATCH path = (s2)-[:CALLS*1..4]->(s1)
    RETURN [n in nodes(path) | n.qualname] AS path_nodes, length(path) AS hops
    """
)
s1_rows = len(s1_res[1])
print(f"S1 Pair (worker.execute_job -> config.load_config): {s1_rows} rows found (expected >= 1)")
if s1_rows > 0:
    print(f"  Path: {s1_res[1][0][0]}, Hops: {s1_res[1][0][1]}")

# S2 Pair: execute_job -> load_config (same path, but in S2 A1 intent is BODY_EDIT)
s2_res = client.execute_command(
    "GRAPH.QUERY", "repo:taskflow",
    """
    MATCH (s2:Symbol {qualname: 'taskflow.worker.execute_job'}), (s1:Symbol {qualname: 'taskflow.config.load_config'})
    MATCH path = (s2)-[:CALLS*1..4]->(s1)
    RETURN [n in nodes(path) | n.qualname] AS path_nodes, length(path) AS hops
    """
)
s2_rows = len(s2_res[1])
print(f"S2 Pair (worker.execute_job -> config.load_config path existence): {s2_rows} rows found (expected >= 1; path exists but intent is BODY_EDIT -> 0 breaking collisions)")

# S3 Pair: execute_job <-> reports.generator.generate_summary
s3_res = client.execute_command(
    "GRAPH.QUERY", "repo:taskflow",
    """
    MATCH (s2:Symbol {qualname: 'taskflow.worker.execute_job'}), (s1:Symbol {qualname: 'taskflow.reports.generator.generate_summary'})
    MATCH path = (s2)-[:CALLS*1..4]-(s1)
    RETURN [n in nodes(path) | n.qualname] AS path_nodes, length(path) AS hops
    """
)
s3_rows = len(s3_res[1])
print(f"S3 Pair (worker.execute_job <-> reports.generate_summary): {s3_rows} rows found (expected 0: disjoint subgraphs)")

print("-" * 60)
print("S3 DETECT EVENT: 4-hop undirected neighborhoods & intersection:")
print("-" * 60)
q_a2 = """
MATCH (start:Symbol {qualname: 'taskflow.worker.execute_job'})
MATCH (start)-[:CALLS*1..4]-(other:Symbol)
RETURN DISTINCT other.qualname AS qname
"""
neigh_a2 = [r[0] for r in client.execute_command("GRAPH.QUERY", "repo:taskflow", q_a2)[1]]

q_a3 = """
MATCH (start:Symbol {qualname: 'taskflow.reports.generator.generate_summary'})
MATCH (start)-[:CALLS*1..4]-(other:Symbol)
RETURN DISTINCT other.qualname AS qname
"""
neigh_a3 = [r[0] for r in client.execute_command("GRAPH.QUERY", "repo:taskflow", q_a3)[1]]

inter = set(neigh_a2).intersection(set(neigh_a3))
print(f"Neighborhood A2 (worker.execute_job): {len(neigh_a2)} symbols")
print(f"Neighborhood A3 (reports.generate_summary): {len(neigh_a3)} symbols")
print(f"Intersection: {list(inter)} (count: {len(inter)})")
assert len(inter) == 0, "Intersection between A2 and A3 neighborhoods must be empty!"
print("Assertion Passed: Neighborhood intersection is EMPTY (0 symbols)!\n")
