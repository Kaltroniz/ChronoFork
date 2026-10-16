import React from 'react';
import { SwarmEvent, GraphData } from '../types';
import { getCollision, getGitComparisonData } from '../adapters/events';
import { SymbolChip } from './VerifiedText';
import { X } from 'lucide-react';

interface HeroSplitProps {
  activeEvent: SwarmEvent | null;
  events: SwarmEvent[];
  graphData: GraphData | null;
  onSelectNode?: (nodeId: string) => void;
  onDismiss?: () => void;
  dismissed?: boolean;
}

export const HeroSplit: React.FC<HeroSplitProps> = ({
  activeEvent,
  events,
  graphData,
  onSelectNode,
  onDismiss,
  dismissed
}) => {
  const collision = getCollision(activeEvent);
  if (!collision || dismissed) return null;

  // Find git comparison event in history (if already executed or available)
  const gitEvent = activeEvent?.phase === 'GIT_COMPARISON'
    ? activeEvent
    : events.find(e => e.phase === 'GIT_COMPARISON' || e.execution_data?.git_status);

  const gitData = getGitComparisonData(gitEvent);

  const hops = typeof collision.hops === 'number' ? collision.hops : undefined;
  const risk = typeof collision.risk_score === 'number' ? collision.risk_score.toFixed(2) : undefined;
  const pathNodes = Array.isArray(collision.path_nodes) ? collision.path_nodes : [];

  const knownNodes = new Set<string>();
  if (graphData?.nodes) {
    for (const n of graphData.nodes) {
      if (n.data.id) knownNodes.add(n.data.id);
      if (n.data.name) knownNodes.add(n.data.name);
    }
  }

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[760px] max-w-[94%] cf-floating-card p-5 transition-opacity duration-200"
      role="alert"
      aria-label="Collision Detection Split View"
    >
      {/* Dismiss Button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 rounded hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
          title="Dismiss card"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className={`grid ${gitData ? 'grid-cols-2 divide-x divide-[var(--line)]' : 'grid-cols-1'} gap-6`}>
        {/* LEFT COLUMN: Git merge */}
        {gitData && (
          <div className="flex flex-col justify-between pr-4 space-y-3">
            <div>
              <div className="text-eyebrow mb-1">Git Merge</div>
              <div className="flex items-center gap-2 text-[14px] text-[var(--text)] font-medium">
                <span className="w-2 h-2 rounded-full bg-[var(--clear)] inline-block" />
                <span>
                  {gitData.conflictsCount !== undefined
                    ? `merged cleanly · ${gitData.conflictsCount} conflicts`
                    : 'merged cleanly · 0 conflicts'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[var(--bg-2)] border border-[var(--line)]">
              <span className="text-eyebrow block mb-1">Runtime Test Result</span>
              <div className="text-[18px] font-mono font-bold text-[var(--breach)]">
                {gitData.pytestFailed !== undefined && gitData.pytestPassed !== undefined
                  ? `${gitData.pytestFailed} FAILED · ${gitData.pytestPassed} PASSED`
                  : 'Tests Failed at Runtime'}
              </div>
              <div className="text-[13px] text-[var(--text-dim)] mt-1 font-mono">
                {gitData.durationSeconds !== undefined ? `duration: ${gitData.durationSeconds}s` : 'exit code: 1'}
              </div>
            </div>

            <div className="text-[13px] text-[var(--text-dim)] italic">
              Git merged clean branches with no text conflicts; runtime crashed on missing contract.
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: ChronoFork */}
        <div className="flex flex-col justify-between pl-2 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-eyebrow text-[var(--breach)] font-semibold">ChronoFork Swarm</div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-[6px] font-mono text-[13px] font-bold bg-[var(--bg-2)] text-[var(--breach)] border border-[var(--breach)]">
                  POLICY: {collision.policy || 'SERIALIZE'}
                </span>
                {risk !== undefined && (
                  <span className="px-2 py-0.5 rounded-[6px] font-mono text-[13px] bg-[var(--bg-2)] text-[var(--text-dim)] border border-[var(--line)]">
                    RISK {risk}
                  </span>
                )}
              </div>
            </div>
            <div className="text-[13px] text-[var(--text-dim)] mt-0.5">1 transitive collision detected</div>
          </div>

          <div className="my-1">
            <div className="text-hero text-[var(--breach)]">
              {hops !== undefined ? `${hops} HOPS` : 'COLLISION'}
            </div>
          </div>

          <div>
            <div className="text-eyebrow mb-1.5">Dependency Call Chain</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {pathNodes.map((nodeName, idx) => {
                const isVerified = knownNodes.has(nodeName);
                return (
                  <React.Fragment key={idx}>
                    <SymbolChip
                      qualname={nodeName}
                      isVerified={isVerified}
                      onSelectNode={onSelectNode}
                    />
                    {idx < pathNodes.length - 1 && (
                      <span className="text-[var(--text-faint)] font-mono text-[13px]">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
