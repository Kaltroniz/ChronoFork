import json
import time
from falkordb import FalkorDB

db = FalkorDB(host='127.0.0.1', port=6379)
print('Phase 0 Live Experiment Starting on FalkorDB...')

# Clean up any leftover test graphs
for gname in ['verify_toy', 'verify_toy_clone']:
    if gname in db.list_graphs():
        db.select_graph(gname).delete()

g = db.select_graph('verify_toy')

# 1. Create 10-node toy graph
# Graph topology:
# A -> B -> C -> D -> E (chain of 4 CALLS hops)
# A -> F -> C (alternate 2 hops to C)
# G -> H (disconnected component)
# I -> B (another caller to B)
# J -> D (caller to D)
create_query = """
CREATE 
  (a:Symbol:Module {name: 'A', qualname: 'pkg.a', lineno: 1}),
  (b:Symbol:Function {name: 'B', qualname: 'pkg.b', lineno: 10}),
  (c:Symbol:Function {name: 'C', qualname: 'pkg.c', lineno: 20}),
  (d:Symbol:Function {name: 'D', qualname: 'pkg.d', lineno: 30}),
  (e:Symbol:Function {name: 'E', qualname: 'pkg.e', lineno: 40}),
  (f:Symbol:Function {name: 'F', qualname: 'pkg.f', lineno: 50}),
  (g:Symbol:Module {name: 'G', qualname: 'pkg.g', lineno: 60}),
  (h:Symbol:Function {name: 'H', qualname: 'pkg.h', lineno: 70}),
  (i:Symbol:Function {name: 'I', qualname: 'pkg.i', lineno: 80}),
  (j:Symbol:Function {name: 'J', qualname: 'pkg.j', lineno: 90}),
  (a)-[:CALLS]->(b),
  (b)-[:CALLS]->(c),
  (c)-[:CALLS]->(d),
  (d)-[:CALLS]->(e),
  (a)-[:CALLS]->(f),
  (f)-[:CALLS]->(c),
  (g)-[:CALLS]->(h),
  (i)-[:CALLS]->(b),
  (j)-[:CALLS]->(d)
"""
t0 = time.perf_counter()
res = g.query(create_query)
t_create = (time.perf_counter() - t0) * 1000
print(f"10-node toy graph created in {t_create:.2f}ms. Nodes: {res.nodes_created}, Relationships: {res.relationships_created}")

# Test 1: GRAPH.COPY / graph.copy
print("\n--- TEST 1: graph.copy ---")
t0 = time.perf_counter()
clone_g = g.copy("verify_toy_clone")
t_copy = (time.perf_counter() - t0) * 1000
print(f"Cloned graph created in {t_copy:.2f}ms. Graphs list: {db.list_graphs()}")
clone_nodes = clone_g.query("MATCH (n) RETURN count(n) AS c").result_set[0][0]
print(f"Cloned graph node count: {clone_nodes}")

# Test copy when destination already exists:
print("\n--- TEST 1b: copy when dest already exists ---")
try:
    g.copy("verify_toy_clone")
    print("Result: Copy to existing target succeeded without error (overwrote/replaced).")
except Exception as ex:
    print(f"Result: Copy to existing target failed with error: {type(ex).__name__}: {ex}")

# Test 2: algo.pageRank
print("\n--- TEST 2: algo.pageRank ---")
try:
    t0 = time.perf_counter()
    pr_res = g.query("CALL algo.pageRank('Symbol', 'CALLS') YIELD node, score RETURN node.name, score ORDER BY score DESC")
    t_pr = (time.perf_counter() - t0) * 1000
    print(f"PageRank with ('Symbol', 'CALLS') executed in {t_pr:.2f}ms. Results:")
    for row in pr_res.result_set:
        print(f"  Node {row[0]}: PageRank score = {row[1]:.6f}")
except Exception as ex:
    print(f"PageRank ('Symbol', 'CALLS') failed: {type(ex).__name__}: {ex}")

try:
    pr_res2 = g.query("CALL algo.pageRank() YIELD node, score RETURN node.name, score ORDER BY score DESC")
    print("PageRank with no args: SUCCESS, top score:", pr_res2.result_set[0])
except Exception as ex:
    print(f"PageRank with no args failed: {type(ex).__name__}: {ex}")

# Test 3: algo.betweenness
print("\n--- TEST 3: algo.betweenness ---")
try:
    t0 = time.perf_counter()
    bw_query = "CALL algo.betweenness({nodeLabels: ['Symbol'], relationshipTypes: ['CALLS'], samplingSize: 32, samplingSeed: 42}) YIELD node, score RETURN node.name, score ORDER BY score DESC"
    bw_res = g.query(bw_query)
    t_bw = (time.perf_counter() - t0) * 1000
    print(f"Betweenness with map syntax executed in {t_bw:.2f}ms. Results:")
    for row in bw_res.result_set:
        print(f"  Node {row[0]}: Betweenness score = {row[1]:.6f}")
except Exception as ex:
    print(f"Betweenness failed: {type(ex).__name__}: {ex}")

# Test 4: Cypher shortestPath and variable-length path
print("\n--- TEST 4: Cypher shortestPath ---")
try:
    t0 = time.perf_counter()
    sp_query = "MATCH (src:Symbol {name: 'A'}), (tgt:Symbol {name: 'E'}) WITH shortestPath((src)-[:CALLS*1..5]->(tgt)) AS p RETURN [n in nodes(p) | n.name] AS path_names, length(p) AS hops"
    sp_res = g.query(sp_query)
    t_sp = (time.perf_counter() - t0) * 1000
    print(f"shortestPath in WITH clause executed in {t_sp:.2f}ms:")
    for row in sp_res.result_set:
        print(f"  Path: {row[0]}, Hops: {row[1]}")
except Exception as ex:
    print(f"shortestPath in WITH clause failed: {type(ex).__name__}: {ex}")

try:
    t0 = time.perf_counter()
    sp_ret_query = "MATCH (src:Symbol {name: 'A'}), (tgt:Symbol {name: 'E'}) RETURN shortestPath((src)-[:CALLS*1..5]->(tgt)) AS p"
    sp_ret_res = g.query(sp_ret_query)
    t_sp_ret = (time.perf_counter() - t0) * 1000
    print(f"shortestPath in RETURN clause executed in {t_sp_ret:.2f}ms:")
    p = sp_ret_res.result_set[0][0]
    print(f"  Path object: {p}, nodes count: {len(p.nodes())}")
except Exception as ex:
    print(f"shortestPath in RETURN clause failed: {type(ex).__name__}: {ex}")

print("\n--- TEST 4b: Variable-length path (1..4 hops) ---")
try:
    t0 = time.perf_counter()
    var_query = "MATCH p = (src:Symbol {name: 'A'})-[:CALLS*1..4]->(tgt:Symbol) RETURN src.name, tgt.name, [n in nodes(p) | n.name] AS chain, length(p) AS hops ORDER BY hops, tgt.name"
    var_res = g.query(var_query)
    t_var = (time.perf_counter() - t0) * 1000
    print(f"Variable length path (1..4) executed in {t_var:.2f}ms. Total paths found: {len(var_res.result_set)}:")
    for row in var_res.result_set:
        print(f"  {row[0]} -> {row[1]} via {row[2]} (hops: {row[3]})")
except Exception as ex:
    print(f"Variable-length path failed: {type(ex).__name__}: {ex}")

print("\n--- TEST 4c: algo.SPpaths ---")
try:
    t0 = time.perf_counter()
    spp_query = "MATCH (src:Symbol {name: 'A'}), (tgt:Symbol {name: 'E'}) CALL algo.SPpaths({sourceNode: src, targetNode: tgt, relTypes: ['CALLS']}) YIELD path RETURN [n in nodes(path) | n.name] AS p, length(path) AS l"
    spp_res = g.query(spp_query)
    t_spp = (time.perf_counter() - t0) * 1000
    print(f"algo.SPpaths executed in {t_spp:.2f}ms:")
    for row in spp_res.result_set:
        print(f"  Path: {row[0]}, Length: {row[1]}")
except Exception as ex:
    print(f"algo.SPpaths failed: {type(ex).__name__}: {ex}")

# Test 5: Listing and deleting graphs
print("\n--- TEST 5: Listing and Deleting Graphs ---")
graphs_before = db.list_graphs()
print(f"Graphs before delete: {graphs_before}")
clone_g.delete()
graphs_after_clone = db.list_graphs()
print(f"Graphs after clone_g.delete(): {graphs_after_clone}")
g.delete()
graphs_after_all = db.list_graphs()
print(f"Graphs after g.delete(): {graphs_after_all}")
print("\nPhase 0 verification tests completed.")
