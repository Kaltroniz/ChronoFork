import React, { useState, useEffect } from 'react';
import { SwarmEvent } from '../types';
import { getCollision, getTrace } from '../adapters/events';
import { ShieldCheck, X, ChevronDown } from 'lucide-react';

interface ZeroPathProofProps {
  activeEvent: SwarmEvent | null;
  events?: SwarmEvent[];
  currentScenario?: number;
  onDismiss?: () => void;
  dismissed?: boolean;
}

export const ZeroPathProof: React.FC<ZeroPathProofProps> = ({
  activeEvent,
  events = [],
  currentScenario,
  onDismiss,
  dismissed
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Count claims up to active event
  const eventsUpToCurrent = activeEvent
    ? events.slice(0, activeEvent.index + 1)
    : events;

  // Find COLLISION_DETECTION event up to current index
  const collisionEvent = activeEvent?.phase === 'COLLISION_DETECTION'
    ? activeEvent
    : eventsUpToCurrent.slice().reverse().find((e) => e.phase === 'COLLISION_DETECTION');

  const collision = collisionEvent ? getCollision(collisionEvent) : null;
  const isZeroCollision = collisionEvent ? (!collision || collision === null) : false;

  const distinctClaimAgents = new Set<string>();
  eventsUpToCurrent.forEach((e) => {
    if (e.phase === 'CLAIM') {
      distinctClaimAgents.add(e.agent);
    }
  });

  const hasAtLeastTwoClaims = distinctClaimAgents.size >= 2 || eventsUpToCurrent.some(e => e.phase === 'MEMORY_ADAPTATION');

  // Trigger ONLY when COLLISION_DETECTION event has occurred, with collision == null and >= 2 distinct claims
  const shouldShow = Boolean(collisionEvent) && isZeroCollision && hasAtLeastTwoClaims;

  // Derive A1 claim intent directly from CLAIM events
  const a1ClaimEvent = eventsUpToCurrent.find(
    (e) => e.phase === 'CLAIM' && (e.params?.agent_id === 'agent_1' || e.agent?.toLowerCase().includes('config') || e.agent === 'A1')
  );
  const a1Intent = a1ClaimEvent?.params?.intent || a1ClaimEvent?.execution_data?.intent || 'BODY_EDIT';

  // Memory adaptation detected from events (never scenario-number branching)
  const isMemoryAdapted = eventsUpToCurrent.some(
    (e) => e.phase === 'MEMORY_ADAPTATION' || (e.phase === 'COLLISION_DETECTION' && (e.execution_data?.path_rows_count ?? 0) > 0)
  );

  // Auto-compact after 3s like the hero (only for disjoint subgraphs proof)
  useEffect(() => {
    setIsCollapsed(false);
    if (!shouldShow || isMemoryAdapted) return;

    const timer = setTimeout(() => {
      setIsCollapsed(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [activeEvent, shouldShow, isMemoryAdapted]);

  if (!shouldShow || dismissed) return null;

  // Memory-guided non-breaking claim proof
  if (isMemoryAdapted) {
    return (
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-[6px] border border-[var(--clear)] bg-[var(--bg-1)] font-mono text-[13px] text-[var(--clear)] shadow-2xl flex items-center gap-3 select-none"
        role="status"
        aria-label="Zero Collisions Memory Guided"
      >
        <ShieldCheck className="w-4 h-4 text-[var(--clear)] shrink-0" />
        <span className="font-bold">ZERO COLLISIONS · memory-guided</span>
        <span className="text-[var(--text-dim)] font-sans text-[13px]">
          {`memory changed A1's claim to ${a1Intent}; the breaking-intent query returned 0 rows`}
        </span>
      </div>
    );
  }

  const trace = getTrace(activeEvent);
  const durationMs = trace?.duration_ms;
  const rowCount = trace?.row_count;

  // Collapsed One-Line Bar Docked Top-Center
  if (isCollapsed) {
    return (
      <div
        onClick={() => setIsCollapsed(false)}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-[6px] border border-[var(--clear)] bg-[var(--bg-1)] font-mono text-[13px] font-semibold text-[var(--clear)] shadow-xl cursor-pointer hover:border-[var(--accent)] flex items-center gap-3 select-none transition-all duration-200"
        role="status"
        aria-label="Zero Path Proof Docked Bar"
        title="Click to expand verification details"
      >
        <ShieldCheck className="w-4 h-4 text-[var(--clear)] shrink-0" />
        <span>SAFE · 0 PATHS · No call path within 4 hops between claimed symbols</span>
        <span className="flex items-center gap-0.5 text-[13px] text-[var(--accent)] hover:underline ml-1">
          <span>Expand</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </div>
    );
  }

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[640px] max-w-[94%] cf-floating-card border border-[var(--clear)] p-5 transition-opacity duration-200 shadow-2xl select-none"
      role="status"
      aria-label="Zero Path Proof"
    >
      {/* Dismiss / Dock Buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer text-[13px] font-mono px-2"
          title="Dock to top-center bar"
        >
          Dock
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
            title="Dismiss card"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-start gap-4">
        <div className="p-3 rounded-[8px] bg-[var(--bg-2)] border border-[var(--clear)] text-[var(--clear)] shrink-0">
          <ShieldCheck className="w-7 h-7" />
        </div>

        <div className="space-y-1.5 flex-1 pr-6">
          <div className="text-eyebrow text-[var(--clear)] font-semibold">Graph Verification Proof</div>
          <div className="text-[28px] font-mono font-bold text-[var(--clear)] leading-none">
            SAFE · 0 PATHS
          </div>
          <p className="text-[14px] text-[var(--text)] font-medium">
            No call path within 4 hops between claimed symbols
          </p>

          {durationMs !== undefined && (
            <p className="text-[13px] font-mono text-[var(--text-dim)] pt-1">
              FalkorDB query:{' '}
              <span className="text-[var(--text)] font-semibold">{durationMs.toFixed(1)} ms</span>
              {rowCount !== undefined && (
                <>
                  {' '}· rows:{' '}
                  <span className="text-[var(--text)] font-semibold">{rowCount}</span>
                </>
              )}
            </p>
          )}

          <div className="pt-2 text-[13px] font-mono text-[var(--clear)]">
            no breaking-intent claim reaches another claim · Parallel execution authorized
          </div>
        </div>
      </div>
    </div>
  );
};
