import React, { useState } from 'react';
import { SwarmEvent } from '../types';
import { ProvenanceStrip } from './ProvenanceStrip';
import { RotateCcw } from 'lucide-react';

interface TopBarProps {
  activeEvent: SwarmEvent | null;
  mode: 'replay' | 'live';
  onToggleMode: (newMode: 'replay' | 'live') => void;
  onResetDemo: () => Promise<void>;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeEvent,
  mode,
  onToggleMode,
  onResetDemo
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      await onResetDemo();
    } finally {
      setResetting(false);
      setShowConfirm(false);
    }
  };

  return (
    <header className="h-[52px] px-5 bg-[var(--bg-0)] border-b border-[var(--line)] flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Wordmark & Tagline */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-[16px] text-[var(--text)] tracking-tight font-mono whitespace-nowrap">
            ChronoFork
          </span>
          <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--bg-2)] border border-[var(--line)] text-[13px] font-mono font-semibold text-[var(--accent)] whitespace-nowrap">
            v1.0
          </span>
        </div>
        <div className="hidden lg:block text-[13px] text-[var(--text-dim)] border-l border-[var(--line)] pl-4 truncate whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px] xl:max-w-[420px]">
          Git catches line conflicts. ChronoFork catches the ones Git can't see.
        </div>
      </div>

      {/* Center: ProvenanceStrip */}
      <div className="hidden md:flex items-center justify-center shrink-0">
        <ProvenanceStrip activeEvent={activeEvent} mode={mode} />
      </div>

      {/* Right: Mode Switch & Reset Demo */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Replay / Live Segmented Switch */}
        <div className="inline-flex rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)] p-0.5 font-mono text-[13px] shrink-0">
          <button
            onClick={() => onToggleMode('replay')}
            className={`px-3 py-1 rounded-[4px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'replay'
                ? 'bg-[var(--bg-2)] text-[var(--accent)] border border-[var(--line)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <span className="whitespace-nowrap leading-tight inline-block">Replay</span>
          </button>
          <button
            onClick={() => onToggleMode('live')}
            className={`px-3 py-1 rounded-[4px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'live'
                ? 'bg-[var(--bg-2)] text-[var(--signal)] border border-[var(--line)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <span className="whitespace-nowrap leading-tight inline-block">Live</span>
          </button>
        </div>

        {/* Reset Demo Button */}
        {showConfirm ? (
          <div className="flex items-center gap-2 bg-[var(--bg-1)] px-2.5 py-1 rounded-[6px] border border-[var(--breach)] text-[13px] font-mono shrink-0 whitespace-nowrap">
            <span className="text-[var(--signal)] whitespace-nowrap">Reset memory & state?</span>
            <button
              onClick={handleConfirmReset}
              disabled={resetting}
              className="px-2 py-0.5 rounded-[4px] bg-[var(--breach)] text-[var(--text)] hover:opacity-90 transition-opacity cursor-pointer text-[13px] whitespace-nowrap"
            >
              {resetting ? 'Resetting...' : 'Yes'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-2 py-0.5 rounded-[4px] bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer text-[13px] whitespace-nowrap"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            data-testid="reset-demo-button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--text-faint)] transition-colors font-mono text-[13px] cursor-pointer shrink-0 whitespace-nowrap"
            title="Reset memory and client state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Reset Demo</span>
          </button>
        )}
      </div>
    </header>
  );
};
