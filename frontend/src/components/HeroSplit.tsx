import React, { useState, useEffect } from 'react';
import { SwarmEvent, GraphData } from '../types';
import { getCollision, getGitComparisonData } from '../adapters/events';
import { SymbolChip } from './VerifiedText';
import { X, ChevronDown } from 'lucide-react';

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
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  const collision = getCollision(activeEvent);

  // Requirement 4: Expanded at first render of collision event, auto-docks after 1.5s
  useEffect(() => {
    if (activeEvent?.phase === 'COLLISION_DETECTION' && collision) {
      setIsCollapsed(false);
      const timer = setTimeout(() => {
        setIsCollapsed(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeEvent?.phase, activeEvent?.index, Boolean(collision)]);

  if (!collision || dismissed) return null;

  // Find git comparison event in history (if already executed or available)
  const gitEvent =
    activeEvent?.phase === 'GIT_COMPARISON'
      ? activeEvent
      : events.find((e) => e.phase === 'GIT_COMPARISON' || e.execution_data?.git_status);

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

  // Collapsed One-Line Bar Docked Top-Left (min 440px, no truncation)
  if (isCollapsed) {
    return (
      <div
        onClick={() => setIsCollapsed(false)}
        className="absolute top-4 left-6 z-30 min-w-[440px] w-auto max-w-[90%] px-4 py-2 rounded-[6px] border border-[var(--breach)] bg-[var(--bg-1)] font-mono text-[13px] font-semibold text-[var(--text)] shadow-xl cursor-pointer hover:border-[var(--accent)] flex items-center justify-between select-none transition-all duration-200"
        role="alert"
        aria-label="Collision Detection Docked Bar"
        title="Click to expand collision details"
      >
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-[var(--breach)] shrink-0 animate-pulse" />
          <span className="whitespace-nowrap">
            ChronoFork: {hops !== undefined ? `${hops}-hop` : 'transitive'} collision · {collision.policy || 'SERIALIZE'}
          </span>
        </div>
        <span className="flex items-center gap-0.5 text-[13px] text-[var(--accent)] hover:underline ml-3 shrink-0">
          <span>Expand</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </div>
    );
  }

  return (
    <div
      className="absolute top-4 left-6 z-30 w-[780px] max-w-[94%] max-h-[230px] overflow-hidden cf-floating-card p-3.5 transition-opacity duration-200 shadow-2xl select-none"
      role="alert"
      aria-label="Collision Detection Split View"
    >
      {/* Top Header Row with zero-overlap grid: Title on left, Policy + Risk + Controls on right */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--breach)] animate-pulse inline-block" />
          <span className="text-eyebrow text-[var(--breach)] font-semibold">
            ChronoFork Collision Detected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-[6px] font-mono text-[13px] font-bold bg-[var(--bg-2)] text-[var(--breach)] border border-[var(--breach)]">
            POLICY: {collision.policy || 'SERIALIZE'}
          </span>
          {risk !== undefined && (
            <span className="px-2 py-0.5 rounded-[6px] font-mono text-[13px] bg-[var(--bg-2)] text-[var(--text-dim)] border border-[var(--line)]">
              RISK {risk}
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer text-[13px] font-mono px-2 border border-[var(--line)]"
            title="Dock to top-left bar"
          >
            Dock
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer border border-[var(--line)]"
              title="Dismiss card"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div
        className={`grid ${
          gitData ? 'grid-cols-2 divide-x divide-[var(--line)]' : 'grid-cols-1'
        } gap-6`}
      >
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
                {gitData.durationSeconds !== undefined
                  ? `duration: ${gitData.durationSeconds.toFixed(2)}s`
                  : 'exit code: 1'}
              </div>
            </div>

            <div className="text-[13px] text-[var(--text-dim)] italic font-sans">
              Git merged clean branches with no text conflicts; runtime crashed on missing contract.
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: ChronoFork */}
        <div className="flex flex-col justify-between pl-2 space-y-3">
          <div>
            <div className="text-eyebrow text-[var(--breach)] font-semibold">ChronoFork Detection</div>
            <div className="text-[13px] text-[var(--text-dim)] mt-0.5">1 transitive collision detected across call path</div>
          </div>

          <div className="my-1">
            <div className="text-hero text-[var(--breach)]">
              {hops !== undefined ? `${hops} HOPS` : 'COLLISION'}
            </div>
          </div>

          <div>
            <div className="text-eyebrow mb-1.5">Dependency Call Chain</div>
            {/* Horizontal chip path with -> connectors, wrapping to two rows if needed */}
            <div className="flex flex-wrap items-center gap-1.5 max-w-full">
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
                      <span className="text-[var(--text-faint)] font-mono text-[13px] select-none">
                        →
                      </span>
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
