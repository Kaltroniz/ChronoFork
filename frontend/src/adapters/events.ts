import { SwarmEvent, CollisionInfo, MemoryWrite, CypherTrace } from '../types';

export type ProvenanceState = 'REAL' | 'CACHED' | 'SIMULATED' | 'UNAVAILABLE' | 'UNLABELLED';

export interface NormalizedGitData {
  status?: string;
  conflictsCount?: number;
  output?: string;
  pytestSuccess?: boolean;
  pytestExitCode?: number;
  pytestPassed?: number;
  pytestFailed?: number;
  durationSeconds?: number;
  pytestOutput?: string;
}

export interface NormalizedVerifierData {
  success?: boolean;
  exitCode?: number;
  passedCount?: number;
  failedCount?: number;
  durationSeconds?: number;
  output?: string;
  errors?: string;
}

export interface NormalizedForkData {
  forkKey?: string;
  beforeRisk?: number;
  afterRisk?: number;
  directCallers?: string[];
  transitiveCallers?: string[];
  affectedTests?: Array<{
    test_name: string;
    test_path?: string;
    lineno?: number;
  }>;
}

export interface NormalizedImpactData {
  target?: string;
  dependentCallersCount?: number;
  dependentCallers?: Array<{
    qualname: string;
    file_path?: string;
    depth?: number;
    chain?: string[];
  }>;
  affectedTestsCount?: number;
  affectedTests?: Array<{
    test_name: string;
    test_path?: string;
    lineno?: number;
  }>;
  queryTimeMs?: number;
}

export interface MergeOrderItem {
  rank: number;
  agent_id: string;
  symbol: string;
  outgoing_dependencies?: number;
  depends_on?: string[];
  policy_action?: string;
}

/**
 * Normalizes any raw event payload into a standard SwarmEvent structure
 */
export function normalizeEvent(raw: any): SwarmEvent {
  if (!raw || typeof raw !== 'object') {
    return {
      index: 0,
      ts: Date.now() / 1000,
      run_id: 'unknown',
      agent: 'System',
      phase: 'IDLE',
      tool: 'none',
      node_ids: [],
      edge_ids: [],
      message: ''
    };
  }

  return {
    index: typeof raw.index === 'number' ? raw.index : 0,
    ts: typeof raw.ts === 'number' ? raw.ts : Date.now() / 1000,
    run_id: String(raw.run_id || ''),
    agent: String(raw.agent || 'Coordinator'),
    phase: String(raw.phase || 'IDLE'),
    tool: String(raw.tool || ''),
    cypher: raw.cypher || undefined,
    params: raw.params || undefined,
    trace: raw.trace || undefined,
    execution_data: raw.execution_data || undefined,
    node_ids: Array.isArray(raw.node_ids) ? raw.node_ids : [],
    edge_ids: Array.isArray(raw.edge_ids) ? raw.edge_ids : [],
    scores: raw.scores || undefined,
    collision: raw.collision || undefined,
    memory_write: raw.memory_write || undefined,
    provenance: raw.provenance || undefined,
    message: String(raw.message || '')
  };
}

export function getEventIndex(e?: SwarmEvent | null): number {
  return e?.index ?? 0;
}

export function getEventTimestamp(e?: SwarmEvent | null): number | undefined {
  return e?.ts;
}

export function getEventAgent(e?: SwarmEvent | null): string {
  return e?.agent ?? '—';
}

export function getEventPhase(e?: SwarmEvent | null): string {
  return e?.phase ?? '—';
}

export function getEventTool(e?: SwarmEvent | null): string {
  return e?.tool || '—';
}

export function getEventMessage(e?: SwarmEvent | null): string {
  return e?.message ?? '—';
}

/**
 * Returns trimmed first sentence for Story mode captions
 */
export function getEventFirstSentence(e?: SwarmEvent | null): string {
  if (!e?.message) return '—';
  const clean = e.message.trim();
  const match = clean.match(/^.*?[.!?](?:\s|$)/);
  return match ? match[0].trim() : clean;
}

export function getEventNodeIds(e?: SwarmEvent | null): string[] {
  return e?.node_ids ?? [];
}

export function getEventEdgeIds(e?: SwarmEvent | null): string[] {
  return e?.edge_ids ?? [];
}

/**
 * Normalizes git comparison execution data handling all key variants
 */
export function getGitComparisonData(e?: SwarmEvent | null): NormalizedGitData | undefined {
  if (!e?.execution_data) return undefined;
  const d = e.execution_data;
  
  const hasGit = d.git_status !== undefined || d.naive_pytest_passed !== undefined || d.pytest_passed !== undefined;
  if (!hasGit) return undefined;

  const passed = typeof d.naive_pytest_passed === 'number'
    ? d.naive_pytest_passed
    : typeof d.pytest_passed === 'number'
    ? d.pytest_passed
    : undefined;

  const failed = typeof d.naive_pytest_failed === 'number'
    ? d.naive_pytest_failed
    : typeof d.pytest_failed === 'number'
    ? d.pytest_failed
    : undefined;

  const duration = typeof d.duration_seconds === 'number'
    ? d.duration_seconds
    : typeof d.pytest_duration === 'number'
    ? d.pytest_duration
    : undefined;

  return {
    status: d.git_status ? String(d.git_status) : undefined,
    conflictsCount: typeof d.git_conflicts_count === 'number' ? d.git_conflicts_count : undefined,
    output: d.git_output ? String(d.git_output) : undefined,
    pytestSuccess: typeof d.pytest_success === 'boolean' ? d.pytest_success : undefined,
    pytestExitCode: typeof d.pytest_exit_code === 'number' ? d.pytest_exit_code : undefined,
    pytestPassed: passed,
    pytestFailed: failed,
    durationSeconds: duration,
    pytestOutput: d.pytest_output ? String(d.pytest_output) : undefined
  };
}

/**
 * Normalizes verifier test results
 */
export function getVerificationData(e?: SwarmEvent | null): NormalizedVerifierData | undefined {
  if (!e?.execution_data) return undefined;
  if (e.phase === 'GIT_COMPARISON' || e.tool === 'git_merge') return undefined;
  const d = e.execution_data;

  const passed = typeof d.passed_count === 'number'
    ? d.passed_count
    : typeof d.pytest_passed === 'number'
    ? d.pytest_passed
    : typeof d.passed === 'number'
    ? d.passed
    : undefined;

  const failed = typeof d.failed_count === 'number'
    ? d.failed_count
    : typeof d.pytest_failed === 'number'
    ? d.pytest_failed
    : typeof d.failed === 'number'
    ? d.failed
    : undefined;

  const duration = typeof d.duration_seconds === 'number'
    ? d.duration_seconds
    : typeof d.duration === 'number'
    ? d.duration
    : typeof d.duration_ms === 'number'
    ? d.duration_ms / 1000
    : typeof d.pytest_duration === 'number'
    ? d.pytest_duration
    : undefined;

  const hasVerification = passed !== undefined || failed !== undefined || d.success !== undefined || d.exit_code !== undefined;
  if (!hasVerification) return undefined;

  return {
    success: typeof d.success === 'boolean' ? d.success : typeof d.pytest_success === 'boolean' ? d.pytest_success : undefined,
    exitCode: typeof d.exit_code === 'number' ? d.exit_code : typeof d.pytest_exit_code === 'number' ? d.pytest_exit_code : undefined,
    passedCount: passed,
    failedCount: failed,
    durationSeconds: duration,
    output: d.output ? String(d.output) : d.pytest_output ? String(d.pytest_output) : undefined,
    errors: d.errors ? String(d.errors) : undefined
  };
}

/**
 * Normalizes fork simulation execution data
 */
export function getForkSimulationData(e?: SwarmEvent | null): NormalizedForkData | undefined {
  if (!e?.execution_data) return undefined;
  const d = e.execution_data;
  if (d.fork_key === undefined && d.before_risk === undefined && d.transitive_callers === undefined) {
    return undefined;
  }

  return {
    forkKey: d.fork_key ? String(d.fork_key) : undefined,
    beforeRisk: typeof d.before_risk === 'number' ? d.before_risk : undefined,
    afterRisk: typeof d.after_risk === 'number' ? d.after_risk : undefined,
    directCallers: Array.isArray(d.direct_callers) ? d.direct_callers : undefined,
    transitiveCallers: Array.isArray(d.transitive_callers) ? d.transitive_callers : undefined,
    affectedTests: Array.isArray(d.affected_tests) ? d.affected_tests : undefined
  };
}

/**
 * Normalizes impact analysis execution data
 */
export function getImpactData(e?: SwarmEvent | null): NormalizedImpactData | undefined {
  if (!e?.execution_data) return undefined;
  const d = e.execution_data;
  if (d.target === undefined && d.dependent_callers === undefined) return undefined;

  return {
    target: d.target ? String(d.target) : undefined,
    dependentCallersCount: typeof d.dependent_callers_count === 'number' ? d.dependent_callers_count : undefined,
    dependentCallers: Array.isArray(d.dependent_callers) ? d.dependent_callers : undefined,
    affectedTestsCount: typeof d.affected_tests_count === 'number' ? d.affected_tests_count : undefined,
    affectedTests: Array.isArray(d.affected_tests) ? d.affected_tests : undefined,
    queryTimeMs: typeof d.query_time_ms === 'number' ? d.query_time_ms : undefined
  };
}

/**
 * Normalizes merge order list from RESOLUTION / apply_policy
 */
export function getMergeOrder(e?: SwarmEvent | null): MergeOrderItem[] | undefined {
  if (!e?.execution_data?.merge_order) return undefined;
  if (!Array.isArray(e.execution_data.merge_order)) return undefined;

  return e.execution_data.merge_order.map((item: any, idx: number) => ({
    rank: typeof item.rank === 'number' ? item.rank : idx + 1,
    agent_id: String(item.agent_id || ''),
    symbol: String(item.symbol || ''),
    outgoing_dependencies: typeof item.outgoing_dependencies === 'number' ? item.outgoing_dependencies : undefined,
    depends_on: Array.isArray(item.depends_on) ? item.depends_on : undefined,
    policy_action: item.policy_action ? String(item.policy_action) : undefined
  }));
}

export function getCollision(e?: SwarmEvent | null): CollisionInfo | undefined {
  return e?.collision || undefined;
}

export function getMemoryWrite(e?: SwarmEvent | null): MemoryWrite | undefined {
  return e?.memory_write || undefined;
}

export function getTrace(e?: SwarmEvent | null): CypherTrace | undefined {
  if (!e?.trace) return undefined;
  // If the trace does not belong to this event's tool or is empty, return undefined
  if (e.tool && e.trace.tool && e.trace.tool !== e.tool) {
    return undefined;
  }
  return e.trace;
}

export interface AgentIdentity {
  id: 'A1' | 'A2' | 'A3' | 'A4' | 'CO' | 'VE' | 'PL' | string;
  name: string;
}

/**
 * Returns canonical agent identity (id: A1..A4/CO/VE/PL, name).
 * Derives from the claim's agent name when present, else agent_id; never mixes.
 */
export function agentLabel(eventOrAgent?: SwarmEvent | string | AgentIdentity | null): AgentIdentity {
  if (!eventOrAgent) return { id: '—', name: '—' };
  if (typeof eventOrAgent === 'object' && 'id' in eventOrAgent && 'name' in eventOrAgent) {
    return eventOrAgent as AgentIdentity;
  }

  let target = '';
  let claimAgentName = '';

  if (typeof eventOrAgent === 'string') {
    target = eventOrAgent.trim();
  } else {
    // SwarmEvent
    // Priority: claim's agent name when present and not a generic coordinator/system
    if (eventOrAgent.agent && eventOrAgent.agent !== 'Coordinator' && eventOrAgent.agent !== 'System') {
      claimAgentName = eventOrAgent.agent;
      target = eventOrAgent.agent;
    } else if (eventOrAgent.params?.agent_name) {
      target = String(eventOrAgent.params.agent_name);
    } else if (eventOrAgent.params?.agent) {
      target = String(eventOrAgent.params.agent);
    } else if (eventOrAgent.params?.agent_id) {
      target = String(eventOrAgent.params.agent_id);
    } else {
      target = eventOrAgent.agent || 'Coordinator';
    }
  }

  const norm = target.toLowerCase();
  let id = 'A1';
  let name = target;

  if (norm.includes('config') || norm === 'agent_1' || norm === 'a1') {
    id = 'A1';
    name = claimAgentName || 'ConfigCoder';
  } else if (norm.includes('worker') || norm === 'agent_2' || norm === 'a2') {
    id = 'A2';
    name = claimAgentName || 'WorkerCoder';
  } else if (norm.includes('report') || norm.includes('auth') || norm === 'agent_3' || norm === 'a3') {
    id = 'A3';
    name = claimAgentName || (norm.includes('report') ? 'ReportsCoder' : 'AuthCoder');
  } else if (norm.includes('telemetry') || norm === 'agent_4' || norm === 'a4') {
    id = 'A4';
    name = claimAgentName || 'TelemetryCoder';
  } else if (norm.includes('coordinator')) {
    id = 'CO';
    name = 'Coordinator';
  } else if (norm.includes('verifier')) {
    id = 'VE';
    name = 'Verifier';
  } else if (norm.includes('planner')) {
    id = 'PL';
    name = 'Planner';
  } else {
    id = target.slice(0, 2).toUpperCase();
    name = target;
  }

  return { id, name };
}

/**
 * Returns canonical agent chip & halo color
 */
export function getAgentColor(agentOrId: string | AgentIdentity): string {
  const norm = (typeof agentOrId === 'string' ? agentOrId : agentOrId.id || agentOrId.name).toLowerCase();
  if (norm === 'a1' || norm.includes('config') || norm === 'agent_1') {
    return '#5B8DEF'; // A1
  }
  if (norm === 'a2' || norm.includes('worker') || norm === 'agent_2') {
    return '#E0A458'; // A2
  }
  if (norm === 'a3' || norm.includes('auth') || norm.includes('report') || norm === 'agent_3') {
    return '#4FB286'; // A3
  }
  if (norm === 'a4' || norm.includes('telemetry') || norm === 'agent_4') {
    return '#A58BE0'; // A4
  }
  if (norm === 'co' || norm.includes('coordinator')) {
    return '#6EA8FE'; // Accent
  }
  if (norm === 've' || norm.includes('verifier')) {
    return '#3FA796'; // Clear
  }
  if (norm === 'pl' || norm.includes('planner')) {
    return '#9AA4B2'; // Text dim
  }
  return '#9AA4B2';
}

/**
 * Returns canonical agent initials (e.g. A1, A2, CO, PL, VE)
 */
export function getAgentInitials(agentOrId: string | AgentIdentity): string {
  return agentLabel(agentOrId).id;
}

/**
 * Returns provenance state for a given category strictly from event.provenance.
 * If absent, returns UNLABELLED.
 */
export function getProvenance(
  category: 'GRAPH' | 'GIT' | 'PYTEST' | 'LLM',
  e?: SwarmEvent | null,
  _runMode: 'replay' | 'live' = 'replay'
): ProvenanceState {
  if (!e?.provenance) {
    return 'UNLABELLED';
  }

  const key = category.toLowerCase() as 'graph' | 'git' | 'pytest' | 'llm';
  const raw = e.provenance[key];
  if (!raw) {
    return 'UNAVAILABLE';
  }

  if (_runMode === 'replay') {
    return 'CACHED';
  }
  return 'REAL';
}
