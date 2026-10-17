import React from 'react';
import { SwarmEvent } from '../types';
import { getProvenance, ProvenanceState } from '../adapters/events';

interface ProvenanceStripProps {
  activeEvent: SwarmEvent | null;
  mode: 'replay' | 'live';
}

interface PillConfig {
  key: 'GRAPH' | 'GIT' | 'PYTEST' | 'LLM';
  label: string;
}

const PILLS: PillConfig[] = [
  { key: 'GRAPH', label: 'GRAPH' },
  { key: 'GIT', label: 'GIT' },
  { key: 'PYTEST', label: 'PYTEST' },
  { key: 'LLM', label: 'LLM' }
];

const STATE_CONFIG: Record<
  ProvenanceState,
  { dotColor: string; textColor: string; tooltip: string }
> = {
  REAL: {
    dotColor: 'var(--clear)',
    textColor: 'var(--clear)',
    tooltip: 'Executed live against real FalkorDB instance, Git repository, or pytest runner.'
  },
  CACHED: {
    dotColor: 'var(--accent)',
    textColor: 'var(--text)',
    tooltip: 'Served from pre-captured event replay logs for deterministic, instant playback.'
  },
  SIMULATED: {
    dotColor: 'var(--signal)',
    textColor: 'var(--signal)',
    tooltip: 'Speculatively evaluated in-memory without persistent repository mutations.'
  },
  UNAVAILABLE: {
    dotColor: 'var(--text-faint)',
    textColor: 'var(--text-faint)',
    tooltip: 'Component telemetry unavailable or not invoked during this execution step.'
  },
  UNLABELLED: {
    dotColor: 'var(--text-faint)',
    textColor: 'var(--text-dim)',
    tooltip: 'No provenance telemetry recorded on this event.'
  }
};

export const ProvenanceStrip: React.FC<ProvenanceStripProps> = ({ activeEvent, mode }) => {
  const timestampStr = activeEvent?.ts
    ? new Date(activeEvent.ts * 1000).toLocaleString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      })
    : '—';

  const visiblePills = PILLS.filter((pill) => {
    const key = pill.key.toLowerCase() as 'graph' | 'git' | 'pytest' | 'llm';
    return Boolean(activeEvent?.provenance?.[key]);
  });

  return (
    <div className="flex items-center gap-2 select-none" role="region" aria-label="System Provenance">
      {visiblePills.map((pill) => {
        const key = pill.key.toLowerCase() as 'graph' | 'git' | 'pytest' | 'llm';
        const raw = activeEvent?.provenance?.[key];
        const state = getProvenance(pill.key, activeEvent, mode);
        const config = STATE_CONFIG[state] || STATE_CONFIG.UNAVAILABLE;

        const capturedIso = typeof raw === 'object' && raw?.captured_at ? raw.captured_at : null;
        const capturedDate = capturedIso
          ? new Date(capturedIso).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })
          : '';

        const badgeText = mode === 'replay' ? `CACHED · ${capturedDate || 'run'}` : 'REAL';
        const tooltipText = mode === 'replay'
          ? `REPLAY · captured ${capturedIso || timestampStr} from a real execution`
          : 'Live Execution';

        return (
          <div
            key={pill.key}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)] font-mono text-[13px] transition-colors cursor-help"
            title={`${pill.label} [${state}]: ${tooltipText}`}
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: config.dotColor }}
            />
            <span className="text-[var(--text-dim)] font-semibold">{pill.label}</span>
            <span style={{ color: config.textColor }}>{badgeText}</span>
          </div>
        );
      })}
    </div>
  );
};
