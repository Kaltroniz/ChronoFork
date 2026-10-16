import React from 'react';
import { SwarmEvent } from '../types';
import { getCollision, getTrace } from '../adapters/events';
import { ShieldCheck, X } from 'lucide-react';

interface ZeroPathProofProps {
  activeEvent: SwarmEvent | null;
  onDismiss?: () => void;
  dismissed?: boolean;
}

export const ZeroPathProof: React.FC<ZeroPathProofProps> = ({
  activeEvent,
  onDismiss,
  dismissed
}) => {
  if (!activeEvent || dismissed) return null;

  // Check if active event is a collision check with PARALLEL_OK or 0 paths
  const collision = getCollision(activeEvent);
  const isParallelOk = collision?.policy === 'PARALLEL_OK';
  const isZeroCollisionPhase =
    activeEvent.phase === 'COLLISION_DETECTION' &&
    (!collision || collision.hops === 0 || isParallelOk);

  const messageIndicatesSafe =
    activeEvent.message &&
    (activeEvent.message.toLowerCase().includes('0 collisions') ||
      activeEvent.message.toLowerCase().includes('disjoint') ||
      activeEvent.message.toLowerCase().includes('parallel_ok') ||
      activeEvent.message.toLowerCase().includes('safe parallel'));

  if (!isParallelOk && !isZeroCollisionPhase && !messageIndicatesSafe) {
    return null;
  }

  const trace = getTrace(activeEvent);
  const durationMs = trace?.duration_ms;
  const rowCount = trace?.row_count;

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[620px] max-w-[92%] cf-floating-card border border-[var(--clear)] p-5 transition-opacity duration-200"
      role="status"
      aria-label="Zero Path Proof"
    >
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 rounded hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
          title="Dismiss"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-[8px] bg-[var(--bg-2)] border border-[var(--clear)] text-[var(--clear)] shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div className="space-y-1.5 flex-1">
          <div className="text-eyebrow text-[var(--clear)] font-semibold">Graph Verification Proof</div>
          <div className="text-[28px] font-mono font-bold text-[var(--clear)] leading-none">
            SAFE · 0 PATHS
          </div>
          <p className="text-[14px] text-[var(--text)] font-medium">
            No call path within 4 hops between the claimed symbols.
          </p>

          {durationMs !== undefined ? (
            <p className="text-[13px] font-mono text-[var(--text-dim)] pt-1">
              Checked {rowCount !== undefined ? `${rowCount} paths` : 'subgraph'} in {durationMs.toFixed(2)} ms via FalkorDB traversal.
            </p>
          ) : (
            <p className="text-[13px] font-mono text-[var(--text-dim)] pt-1">
              Speculative fork analysis verified disjoint symbol clusters.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
