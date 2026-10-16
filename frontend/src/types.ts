export interface CollisionInfo {
  type: string;
  agent_a: string;
  agent_b: string;
  symbol_a: string;
  symbol_b: string;
  intent_a: string;
  intent_b: string;
  hops: number;
  path_nodes: string[];
  risk_score?: number;
  policy: "SERIALIZE" | "REPLAN" | "PARALLEL_OK";
  reason: string;
}

export interface MemoryWrite {
  episode_id?: string;
  rule_id?: string;
  confidence?: number;
  rule_text?: string;
  summary?: string;
}

export interface CypherTrace {
  graph: string;
  cypher: string;
  params: Record<string, any>;
  duration_ms: number;
  row_count: number;
  rows: any[][];
  header: string[];
  tool?: string;
}

export interface SwarmEvent {
  index: number;
  ts: number;
  run_id: string;
  agent: string;
  phase: string;
  tool: string;
  cypher?: string;
  params?: Record<string, any>;
  trace?: CypherTrace;
  execution_data?: Record<string, any>;
  node_ids: string[];
  edge_ids: string[];
  scores?: Record<string, any>;
  collision?: CollisionInfo | null;
  memory_write?: MemoryWrite | null;
  message: string;
}

export interface GraphNodeData {
  id: string;
  name: string;
  label: "Module" | "Function" | "Class" | "Test";
  path: string;
  lineno: number;
  signature_hash: string;
  parent?: string;
  pagerank?: number;
  betweenness?: number;
  risk_score?: number;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export interface GraphData {
  graph_name: string;
  nodes: { data: GraphNodeData }[];
  edges: { data: GraphEdgeData }[];
  node_count: number;
  edge_count: number;
}

export interface ProceduralRule {
  id: string;
  rule: string;
  advice: string;
  confidence: number;
  samples: number;
  involved_symbols: string[];
}

export interface Episode {
  id: string;
  run_id: string;
  task: string;
  outcome: string;
  summary: string;
  timestamp: number;
}

export interface MemoryData {
  repo: string;
  rules: ProceduralRule[];
  episodes: Episode[];
}
