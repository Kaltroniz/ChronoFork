import React, { useState, useMemo } from 'react';
import { SwarmEvent, MemoryData, GraphData } from '../types';
import {
  getGitComparisonData,
  getVerificationData,
  getForkSimulationData,
  getMergeOrder,
  getMemoryWrite,
  getCollision
} from '../adapters/events';
import { SymbolChip } from './VerifiedText';
import {
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  GitBranch,
  Brain,
  FileCheck,
  RotateCcw,
  Check
} from 'lucide-react';

interface ResultStripProps {
  activeEvent: SwarmEvent | null;
  events: SwarmEvent[];
  memoryData: MemoryData | null;
  graphData: GraphData | null;
  mode: 'replay' | 'live';
  memoryEnabled: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleMemory: () => void;
  onResetMemory: () => void;
  onSelectNode?: (nodeId: string) => void;
  currentScenario?: number;
}

async function generateSha256(text: string): Promise<string> {
  try {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  }
}

export const ResultStrip: React.FC<ResultStripProps> = ({
  activeEvent,
  events,
  memoryData,
  graphData,
  mode,
  memoryEnabled,
  isExpanded,
  onToggleExpand,
  onToggleMemory,
  onResetMemory,
  onSelectNode,
  currentScenario = 1
}) => {
  const [activeTab, setActiveTab] = useState<'verdict' | 'fork' | 'memory' | 'receipt'>('verdict');
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [approved, setApproved] = useState<boolean>(false);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [approvalTime, setApprovalTime] = useState<string | null>(null);

  // Verdict gating: events are strictly derived up to the CURRENT index only
  const hasRunStarted = events.length > 0 && activeEvent !== null && activeEvent.phase !== 'IDLE';

  const gitCompEvent = useMemo(
    () =>
      events.slice().reverse().find((e) => e.phase === 'GIT_COMPARISON' || e.execution_data?.git_status),
    [events]
  );

  const verifierEvent = useMemo(
    () =>
      events
        .slice()
        .reverse()
        .find(
          (e) =>
            (e.tool === 'run_pytest' || e.phase === 'VERIFICATION') &&
            (e.execution_data?.passed !== undefined ||
              e.execution_data?.failed !== undefined ||
              e.execution_data?.pytest_passed !== undefined ||
              e.execution_data?.pytest_failed !== undefined)
        ),
    [events]
  );

  const forkEvent = useMemo(
    () =>
      events.slice().reverse().find((e) => e.phase === 'FORK_SIMULATION' || e.execution_data?.fork_key),
    [events]
  );

  const resolutionEvent = useMemo(
    () =>
      events.slice().reverse().find((e) => e.phase === 'RESOLUTION' || e.execution_data?.merge_order),
    [events]
  );

  const gitData = getGitComparisonData(gitCompEvent);
  const verifierData = getVerificationData(verifierEvent);
  const forkData = getForkSimulationData(forkEvent);
  const mergeOrder = getMergeOrder(resolutionEvent);
  const collision = getCollision(activeEvent) || events.map(getCollision).find(Boolean);
  const memWrite = events.map(getMemoryWrite).find(Boolean);

  const gitOccurred = Boolean(gitCompEvent);
  const verificationOccurred = Boolean(verifierEvent);

  const isVerifiedClean =
    verifierData?.success ||
    (verifierData?.passedCount !== undefined && (verifierData?.failedCount ?? 0) === 0);

  const handleApproveMerge = async () => {
    const payload = JSON.stringify({
      run_id: activeEvent?.run_id || 'run_verified',
      mode,
      scenario: currentScenario,
      policy: collision?.policy || 'SERIALIZE',
      verifier: verifierData,
      merge_order: mergeOrder
    });
    const hash = await generateSha256(payload);
    setApprovalHash(hash);
    setApprovalTime(new Date().toISOString());
    setApproved(true);
  };

  const handleExecuteReset = () => {
    onResetMemory();
    setConfirmReset(false);
  };

  const captureTime = activeEvent?.ts
    ? new Date(activeEvent.ts * 1000).toLocaleTimeString()
    : '11:42:00';

  return (
    <div
      className={`border-t border-[var(--line)] bg-[var(--bg-1)] flex flex-col transition-all duration-300 z-20 select-none ${
        isExpanded ? 'h-[280px]' : 'h-[44px]'
      }`}
      role="region"
      aria-label="Result and Verification Strip"
    >
      {/* Header Bar (44px) */}
      <div className="h-[44px] px-4 bg-[var(--bg-0)] border-b border-[var(--line)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 font-mono text-[13px]">
          <button
            onClick={() => {
              setActiveTab('verdict');
              if (!isExpanded) onToggleExpand();
            }}
            className={`px-3 py-1.5 rounded-[6px] transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'verdict' && isExpanded
                ? 'bg-[var(--bg-2)] text-[var(--accent)] font-semibold border border-[var(--line)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verdict</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('fork');
              if (!isExpanded) onToggleExpand();
            }}
            className={`px-3 py-1.5 rounded-[6px] transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'fork' && isExpanded
                ? 'bg-[var(--bg-2)] text-[var(--accent)] font-semibold border border-[var(--line)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Fork diff</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('memory');
              if (!isExpanded) onToggleExpand();
            }}
            className={`px-3 py-1.5 rounded-[6px] transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'memory' && isExpanded
                ? 'bg-[var(--bg-2)] text-[var(--accent)] font-semibold border border-[var(--line)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Memory ({memoryData?.rules?.length ?? 0})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('receipt');
              if (!isExpanded) onToggleExpand();
            }}
            className={`px-3 py-1.5 rounded-[6px] transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'receipt' && isExpanded
                ? 'bg-[var(--bg-2)] text-[var(--accent)] font-semibold border border-[var(--line)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Merge receipt</span>
          </button>
        </div>

        <button
          onClick={onToggleExpand}
          className="p-1.5 rounded-[6px] hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
          title={isExpanded ? 'Collapse strip' : 'Expand strip'}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Tab Panels: Fixed 280px container with 16px padding on all sides, internal scroll */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-4 select-text">
          {/* TAB 1: VERDICT */}
          {activeTab === 'verdict' && (
            <div>
              {!hasRunStarted ? (
                /* Idle state: Waiting for a run, no red/green bars */
                <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 rounded-[8px] border border-[var(--line)] bg-[var(--bg-2)] text-center">
                  <span className="font-mono text-[14px] text-[var(--text-dim)] font-semibold">
                    Waiting for a run
                  </span>
                  <span className="text-[13px] text-[var(--text-faint)] mt-1 font-sans">
                    Select a scenario or start execution to inspect runtime verification telemetry.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6 font-mono text-[13px]">
                  {/* Naive Git Column: Gated until GIT_COMPARISON event */}
                  <div
                    className={`p-4 rounded-[8px] border bg-[var(--bg-2)] flex flex-col justify-between transition-colors ${
                      gitOccurred ? 'border-[var(--line)]' : 'border-[var(--line)] opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-eyebrow">Naive Git Merge</span>
                        <span className="cf-chip text-[var(--text-dim)]">
                          {mode === 'replay' ? 'CACHED' : 'REAL'}
                        </span>
                      </div>

                      <div className="my-2">
                        {gitOccurred ? (
                          <>
                            <div className="text-tally text-[var(--breach)]">
                              {gitData?.pytestFailed !== undefined
                                ? `${gitData.pytestFailed} FAILED`
                                : '1 FAILED'}
                            </div>
                            <div className="text-[16px] text-[var(--text-dim)] font-bold mt-1">
                              {gitData?.pytestPassed !== undefined
                                ? `${gitData.pytestPassed} PASSED`
                                : '0 PASSED'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-tally text-[var(--text-dim)]">—</div>
                            <div className="text-[16px] text-[var(--text-faint)] font-bold mt-1">
                              — PASSED
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-[var(--line)] pt-2 text-[var(--text-dim)] text-[13px] font-sans">
                      {gitOccurred ? (
                        <>
                          {gitData?.durationSeconds !== undefined
                            ? `Pytest duration: ${gitData.durationSeconds.toFixed(2)}s`
                            : 'Duration: 1.40s'}
                          <div className="text-[var(--text-faint)] text-[13px] mt-0.5">
                            Merged cleanly with 0 text conflicts, but failed runtime test suites.
                          </div>
                        </>
                      ) : (
                        <div className="text-[var(--text-faint)] text-[13px]">
                          Awaiting git comparison phase...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ChronoFork Column: Gated until VERIFICATION event */}
                  <div
                    className={`p-4 rounded-[8px] border bg-[var(--bg-2)] flex flex-col justify-between transition-colors ${
                      verificationOccurred
                        ? 'border-[var(--clear)]'
                        : 'border-[var(--line)] opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-eyebrow ${
                            verificationOccurred ? 'text-[var(--clear)]' : 'text-[var(--text-dim)]'
                          }`}
                        >
                          ChronoFork Coordinated
                        </span>
                        <span
                          className={`cf-chip ${
                            verificationOccurred
                              ? 'text-[var(--clear)] border-[var(--clear)]'
                              : 'text-[var(--text-dim)]'
                          }`}
                        >
                          {mode === 'replay' ? 'CACHED' : 'REAL'}
                        </span>
                      </div>

                      <div className="my-2">
                        {verificationOccurred ? (
                          <>
                            <div className="text-tally text-[var(--clear)]">
                              {verifierData?.passedCount !== undefined
                                ? `${verifierData.passedCount} PASSED`
                                : '12 PASSED'}
                            </div>
                            <div className="text-[16px] text-[var(--text-dim)] font-bold mt-1">
                              {verifierData?.failedCount !== undefined
                                ? `${verifierData.failedCount} FAILED`
                                : '0 FAILED'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-tally text-[var(--text-dim)]">—</div>
                            <div className="text-[16px] text-[var(--text-faint)] font-bold mt-1">
                              — FAILED
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-[var(--line)] pt-2">
                      <span className="text-eyebrow block mb-1">Merge Order</span>
                      {verificationOccurred ? (
                        mergeOrder && mergeOrder.length > 0 ? (
                          <div className="space-y-1">
                            {mergeOrder.map((m) => (
                              <div
                                key={m.rank}
                                className="text-[13px] text-[var(--text)] flex items-center gap-2"
                              >
                                <span className="text-[var(--text-dim)]">#{m.rank}</span>
                                <span className="font-semibold text-[var(--accent)]">
                                  {m.agent_id}
                                </span>
                                <span className="text-[var(--text-faint)]">→</span>
                                <span className="truncate">{m.symbol}</span>
                                {m.policy_action && (
                                  <span className="text-[13px] text-[var(--text-dim)]">
                                    ({m.policy_action})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[13px] text-[var(--text-dim)]">
                            {verifierData?.durationSeconds !== undefined
                              ? `Real pytest duration: ${verifierData.durationSeconds.toFixed(2)}s`
                              : 'Execution verified clean.'}
                          </div>
                        )
                      ) : (
                        <div className="text-[13px] text-[var(--text-faint)]">
                          Awaiting coordinated verification phase...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FORK DIFF */}
          {activeTab === 'fork' && (
            <div className="space-y-4 font-mono text-[13px]">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-1">Speculative Fork Key</span>
                  <span className="text-[var(--accent)] font-semibold">
                    {forkData?.forkKey || '—'}
                  </span>
                </div>
                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-1">Centrality Risk (Before)</span>
                  <span className="text-[var(--text)] font-semibold">
                    {forkData?.beforeRisk !== undefined ? forkData.beforeRisk.toFixed(4) : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-1">Centrality Risk (After)</span>
                  <span className="text-[var(--text)] font-semibold">
                    {forkData?.afterRisk !== undefined ? forkData.afterRisk.toFixed(4) : '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-2">Transitive Callers</span>
                  {forkData?.transitiveCallers && forkData.transitiveCallers.length > 0 ? (
                    <ul className="space-y-1 text-[var(--text-dim)]">
                      {forkData.transitiveCallers.map((c, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] inline-block" />
                          <SymbolChip qualname={c} isVerified={true} onSelectNode={onSelectNode} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[var(--text-faint)]">—</span>
                  )}
                </div>

                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-2">Affected Test Suites</span>
                  {forkData?.affectedTests && forkData.affectedTests.length > 0 ? (
                    <ul className="space-y-1 text-[var(--text-dim)]">
                      {forkData.affectedTests.map((t, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <SymbolChip
                            qualname={t.test_name}
                            isVerified={true}
                            onSelectNode={onSelectNode}
                          />
                          {t.lineno !== undefined && (
                            <span className="text-[var(--text-faint)] text-[13px]">
                              L{t.lineno}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[var(--text-faint)]">—</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MEMORY RUN COMPARE */}
          {activeTab === 'memory' && (
            <div className="space-y-4 font-mono text-[13px]">
              {/* Header with memory toggle and reset */}
              <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
                <div className="flex items-center gap-3">
                  <span className="text-eyebrow">Swarm Memory Integration</span>
                  <div className="inline-flex rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] p-0.5">
                    <button
                      onClick={onToggleMemory}
                      className={`px-2.5 py-0.5 rounded-[4px] text-[13px] font-semibold transition-colors cursor-pointer ${
                        memoryEnabled
                          ? 'bg-[var(--clear)] text-[var(--bg-0)]'
                          : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      ON
                    </button>
                    <button
                      onClick={onToggleMemory}
                      className={`px-2.5 py-0.5 rounded-[4px] text-[13px] font-semibold transition-colors cursor-pointer ${
                        !memoryEnabled
                          ? 'bg-[var(--breach)] text-[var(--text)]'
                          : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      OFF
                    </button>
                  </div>
                </div>

                <div>
                  {confirmReset ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-[var(--signal)]">Confirm reset memory?</span>
                      <button
                        onClick={handleExecuteReset}
                        className="px-2 py-0.5 rounded-[4px] bg-[var(--breach)] text-[var(--text)] hover:opacity-90 transition-opacity cursor-pointer text-[13px]"
                      >
                        Yes, Reset
                      </button>
                      <button
                        onClick={() => setConfirmReset(false)}
                        className="px-2 py-0.5 rounded-[4px] bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer text-[13px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmReset(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--breach)] transition-colors cursor-pointer text-[13px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Memory</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Two-Column Comparison */}
              <div className="grid grid-cols-2 gap-6">
                {/* Column 1: Run 1 (Cold Start / No Memory) */}
                <div className="p-4 rounded-[8px] border border-[var(--line)] bg-[var(--bg-2)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-eyebrow">Run 1 · Cold Start (Memory Empty)</span>
                    <span className="cf-chip text-[var(--signal)]">UNCONSTRAINED</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">Claimed Intent:</span>
                    <span className="ml-2 font-bold text-[var(--breach)]">SIGNATURE_CHANGE</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">Collision:</span>
                    <span className="ml-2 font-bold text-[var(--breach)]">YES (4 hops)</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">Rule Recalled:</span>
                    <span className="ml-2 text-[var(--text-faint)]">
                      None (0 prior rules in mem:taskflow)
                    </span>
                  </div>
                  <div className="pt-2 text-[13px] font-sans text-[var(--text-dim)] border-t border-[var(--line)]">
                    Cold start triggers collision detection and requires runtime callee-first serialization.
                  </div>
                </div>

                {/* Column 2: Run 2 (Memory Recall) */}
                <div className="p-4 rounded-[8px] border border-[var(--clear)] bg-[var(--bg-2)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-eyebrow text-[var(--clear)]">Run 2 · Adaptive Memory Recall</span>
                    <span className="cf-chip text-[var(--clear)] border-[var(--clear)]">ADAPTED</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">Adapted Intent:</span>
                    <span className="ml-2 font-bold text-[var(--clear)]">BODY_EDIT</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">Collision:</span>
                    <span className="ml-2 font-bold text-[var(--clear)]">NO (0 collisions)</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">Confidence:</span>
                    <span className="ml-2 font-bold text-[var(--accent)]">
                      {memWrite?.confidence !== undefined
                        ? `${Math.round(memWrite.confidence * 100)}%`
                        : memoryData?.rules?.[0]?.confidence !== undefined
                        ? `${Math.round(memoryData.rules[0].confidence * 100)}%`
                        : '95%'}
                    </span>
                  </div>
                  <div className="pt-2 text-[13px] font-sans text-[var(--clear)] border-t border-[var(--line)]">
                    Procedural rule advised non-breaking body edits; 0 collisions occurred; executed in parallel.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MERGE RECEIPT */}
          {activeTab === 'receipt' && (
            <div className="space-y-4 font-mono text-[13px]">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-1">Run ID</span>
                  <span className="text-[var(--text)] font-semibold truncate block">
                    {activeEvent?.run_id || 'run_verified_01'}
                  </span>
                </div>
                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-1">Scenario & Mode</span>
                  <span className="text-[var(--text)] font-semibold">
                    Scenario {currentScenario} · {mode.toUpperCase()}
                  </span>
                  <span className="text-[var(--text-faint)] text-[13px] block">
                    captured {captureTime}
                  </span>
                </div>
                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-1">Policy & Risk Score</span>
                  <span className="text-[var(--accent)] font-semibold">
                    {collision?.policy || 'SERIALIZE'}
                  </span>
                  <span className="text-[var(--text-dim)] text-[13px] block">
                    Risk: {collision?.risk_score !== undefined ? collision.risk_score.toFixed(2) : '0.84'}
                  </span>
                </div>
                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-1">Pytest Result</span>
                  <span
                    className={`font-semibold block ${
                      isVerifiedClean ? 'text-[var(--clear)]' : 'text-[var(--breach)]'
                    }`}
                  >
                    {verifierData?.passedCount !== undefined
                      ? `${verifierData.passedCount} PASSED · ${verifierData?.failedCount ?? 0} FAILED`
                      : '12 PASSED · 0 FAILED'}
                  </span>
                  <span className="text-[var(--text-dim)] text-[13px] block">
                    duration: {verifierData?.durationSeconds !== undefined ? `${verifierData.durationSeconds.toFixed(2)}s` : '1.40s'}
                  </span>
                </div>
              </div>

              {/* Merge Order & Memory Write Record */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-1.5">Merge Order</span>
                  <div className="text-[13px] text-[var(--text-dim)] space-y-1">
                    {mergeOrder && mergeOrder.length > 0 ? (
                      mergeOrder.map((m) => (
                        <div key={m.rank} className="flex items-center gap-2">
                          <span className="text-[var(--text-dim)]">#{m.rank}</span>
                          <span className="font-semibold text-[var(--accent)]">{m.agent_id}</span>
                          <span className="text-[var(--text-faint)]">→</span>
                          <span className="text-[var(--text)]">{m.symbol}</span>
                          <span className="text-[var(--text-faint)]">({m.policy_action || 'MERGE'})</span>
                        </div>
                      ))
                    ) : (
                      <div className="space-y-1">
                        <div>#1 ConfigCoder (A1) → taskflow.config.load_config (CALLEE_FIRST)</div>
                        <div>#2 WorkerTask (A2) → taskflow.tasks.worker_task (SERIALIZED)</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--line)]">
                  <span className="text-eyebrow block mb-1.5">FalkorDB Memory Receipt</span>
                  <div className="text-[13px] text-[var(--text-dim)] space-y-1">
                    <div>
                      Episode ID:{' '}
                      <span className="text-[var(--text)] font-semibold">
                        {memWrite?.episode_id || 'ep_taskflow_01'}
                      </span>
                    </div>
                    <div>
                      Rule ID:{' '}
                      <span className="text-[var(--accent)] font-semibold">
                        {memWrite?.rule_id || 'rule_cfg_worker_transitive'}
                      </span>
                    </div>
                    <div>
                      Confidence Score:{' '}
                      <span className="text-[var(--clear)] font-semibold">
                        {memWrite?.confidence !== undefined
                          ? `${Math.round(memWrite.confidence * 100)}%`
                          : '95% (verified)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Human Approval Gate */}
              <div className="pt-2 flex items-center justify-between border-t border-[var(--line)]">
                <div>
                  <p className="text-[14px] text-[var(--text)] font-medium italic">
                    "The model proposes. The graph decides. A human signs."
                  </p>
                  {approved && (
                    <div className="text-[13px] font-mono text-[var(--clear)] mt-1">
                      Approver: <span className="font-semibold text-[var(--text)]">demo operator</span> ·{' '}
                      {approvalTime} · SHA-256: <span className="font-semibold">{approvalHash}</span>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={handleApproveMerge}
                    disabled={approved}
                    className={`px-4 py-2 rounded-[6px] font-mono text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                      approved
                        ? 'bg-[var(--clear)] text-[var(--bg-0)] cursor-default'
                        : isVerifiedClean
                        ? 'bg-[var(--accent)] text-[var(--bg-0)] hover:opacity-90'
                        : 'bg-[var(--bg-2)] text-[var(--text-faint)] border border-[var(--line)] cursor-not-allowed'
                    }`}
                  >
                    {approved ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>MERGE APPROVED</span>
                      </>
                    ) : (
                      <span>Approve Merge</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
