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

function formatProvenanceTimestamp(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  let tz = '';
  try {
    const tzPart = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName');
    if (tzPart) tz = tzPart.value;
  } catch {}

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${tz ? ' ' + tz : ''}`;
}

export const ProvenanceStrip: React.FC<ProvenanceStripProps> = ({ activeEvent, mode }) => {
  const timestampStr = activeEvent?.ts
    ? formatProvenanceTimestamp(new Date(activeEvent.ts * 1000))
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
          ? formatProvenanceTimestamp(capturedIso)
          : (activeEvent?.ts ? formatProvenanceTimestamp(new Date(activeEvent.ts * 1000)) : '');

        const badgeText = mode === 'replay' ? 'CACHED' : 'REAL';
        const tooltipText = mode === 'replay'
          ? `REPLAY · captured ${capturedDate || capturedIso || timestampStr} from a real execution`
          : `Live Execution · ${capturedDate || timestampStr}`;

        return (
          <div
            key={pill.key}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-[var(--line)] bg-[var(--bg-1)] font-mono text-[13px] transition-colors cursor-help shrink-0 whitespace-nowrap leading-tight"
            title={`${pill.label} [${state}]: ${tooltipText}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: config.dotColor }}
            />
            <span className="text-[var(--text-dim)] font-semibold whitespace-nowrap">{pill.label}</span>
            <span className="whitespace-nowrap font-medium" style={{ color: config.textColor }}>{badgeText}</span>
          </div>
        );
      })}
    </div>
  );
};
