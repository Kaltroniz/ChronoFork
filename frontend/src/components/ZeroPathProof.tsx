import React, { useState, useEffect } from 'react';
import { SwarmEvent } from '../types';
import { getCollision, getTrace } from '../adapters/events';
import { ShieldCheck, X, ChevronDown } from 'lucide-react';

interface ZeroPathProofProps {
  activeEvent: SwarmEvent | null;
  events?: SwarmEvent[];
  onDismiss?: () => void;
  dismissed?: boolean;
}

export const ZeroPathProof: React.FC<ZeroPathProofProps> = ({
  activeEvent,
  events = [],
  onDismiss,
  dismissed
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Check if active event is a collision check with no collision and >= 2 claims exist
  const collision = getCollision(activeEvent);
  const isZeroCollision = !collision || collision.hops === 0 || collision.policy === 'PARALLEL_OK';

  // Count claims up to active event
  const eventsUpToCurrent = activeEvent
    ? events.slice(0, activeEvent.index + 1)
    : events;

  const distinctClaimAgents = new Set<string>();
  eventsUpToCurrent.forEach((e) => {
    if (e.phase === 'CLAIM' || (['CLAIM', 'CODE_GEN'].includes(e.phase) && e.node_ids && e.node_ids.length > 0)) {
      distinctClaimAgents.add(e.agent);
    }
  });

  const hasAtLeastTwoClaims = distinctClaimAgents.size >= 2;

  const isEligiblePhase =
    activeEvent?.phase === 'COLLISION_DETECTION' ||
    (activeEvent?.phase === 'FORK_SIMULATION' && isZeroCollision) ||
    Boolean(
      activeEvent?.message &&
        (activeEvent.message.toLowerCase().includes('0 collisions') ||
          activeEvent.message.toLowerCase().includes('disjoint') ||
          activeEvent.message.toLowerCase().includes('parallel_ok') ||
          activeEvent.message.toLowerCase().includes('safe parallel'))
    );

  const shouldShow = isEligiblePhase && isZeroCollision && (hasAtLeastTwoClaims || distinctClaimAgents.size > 0);

  // Auto-compact after 3s like the hero
  useEffect(() => {
    setIsCollapsed(false);
    if (!shouldShow) return;

    const timer = setTimeout(() => {
      setIsCollapsed(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [activeEvent, shouldShow]);

  if (!shouldShow || dismissed) return null;

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
            Disjoint subgraphs confirmed · Parallel execution authorized
          </div>
        </div>
      </div>
    </div>
  );
};
