import React from 'react';
import { Play, Pause, SkipForward, RotateCcw, Sparkles } from 'lucide-react';

interface LeftRailProps {
  currentScenario: number;
  onSelectScenario: (scId: number) => void;
  isRunning: boolean;
  isPaused: boolean;
  isStoryActive: boolean;
  onPlayStory: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onReset: () => void;
  speedMs: number;
  onChangeSpeed: (ms: number) => void;
  memoryEnabled: boolean;
  onToggleMemory: () => void;
  isDevFixture?: boolean;
  hasMemoryItems?: boolean;
}

const SCENARIOS = [
  {
    id: 1,
    title: '1. Hidden Collision',
    subtitle: '4-hop transitive chain · Git blindspot',
    badge: 'Flagship'
  },
  {
    id: 2,
    title: '2. Memory Recall',
    subtitle: 'Rule adapts claim · 0 collisions',
    badge: 'Adaptive'
  },
  {
    id: 3,
    title: '3. Safe Parallel',
    subtitle: 'Disjoint symbols · concurrent pass',
    badge: 'Disjoint'
  },
  {
    id: 4,
    title: '4. Multi-Tenant',
    subtitle: 'Analytics repo isolation',
    badge: 'Isolated'
  }
];

const SPEEDS = [
  { label: 'Fast', ms: 250 },
  { label: 'Normal', ms: 500 },
  { label: 'Slow', ms: 1000 }
];

export const LeftRail: React.FC<LeftRailProps> = ({
  currentScenario,
  onSelectScenario,
  isRunning,
  isPaused,
  isStoryActive,
  onPlayStory,
  onTogglePlay,
  onStepForward,
  onReset,
  speedMs,
  onChangeSpeed,
  memoryEnabled,
  onToggleMemory,
  isDevFixture = false,
  hasMemoryItems = false
}) => {
  return (
    <aside className="w-[280px] h-full bg-[var(--bg-1)] border-r border-[var(--line)] flex flex-col justify-between p-4 select-none shrink-0 z-20">
      <div className="space-y-5 overflow-y-auto pr-1">
        {/* Primary Story Mode Button */}
        <div>
          <button
            onClick={onPlayStory}
            className={`w-full py-2.5 px-3 rounded-[6px] font-mono text-[13px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isStoryActive
                ? 'bg-[var(--accent)] text-[var(--bg-0)]'
                : 'bg-[var(--bg-2)] border border-[var(--line)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
            title="Runs director's cut through Scenarios 1, 2, and 3 with narrative captions"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isStoryActive ? 'Playing Story...' : 'Play the Story'}</span>
          </button>
        </div>

        {/* Scenarios List */}
        <div className="space-y-2">
          <div className="text-eyebrow">Scenarios</div>
          <div className="space-y-1.5">
            {SCENARIOS.map((sc) => {
              const isSelected = currentScenario === sc.id && !isStoryActive;
              return (
                <button
                  key={sc.id}
                  data-testid={`scenario-button-${sc.id}`}
                  onClick={() => onSelectScenario(sc.id)}
                  className={`w-full p-2.5 rounded-[8px] border text-left transition-colors cursor-pointer flex flex-col gap-0.5 ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--bg-2)]'
                      : 'border-[var(--line)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-[13px] font-bold ${
                        isSelected ? 'text-[var(--accent)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {sc.title}
                    </span>
                    <span className="text-[13px] font-mono text-[var(--text-faint)]">
                      {sc.badge}
                    </span>
                  </div>
                  <span className="text-[13px] text-[var(--text-dim)] font-sans leading-tight">
                    {sc.subtitle}
                  </span>
                  {sc.id === 2 && hasMemoryItems && (
                    <span data-testid="memory-state-indicator" className="text-[13px] font-mono text-[var(--signal)] mt-1 block">
                      Memory state: carried over from previous runs
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Memory Toggle */}
        <div className="space-y-2 pt-2 border-t border-[var(--line)]">
          <div className="flex items-center justify-between text-[13px] font-mono">
            <span className="text-eyebrow">Procedural Memory</span>
            <div className="inline-flex rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] p-0.5">
              <button
                onClick={onToggleMemory}
                className={`px-2 py-0.5 rounded-[4px] font-semibold transition-colors cursor-pointer ${
                  memoryEnabled
                    ? 'bg-[var(--clear)] text-[var(--bg-0)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                ON
              </button>
              <button
                onClick={onToggleMemory}
                className={`px-2 py-0.5 rounded-[4px] font-semibold transition-colors cursor-pointer ${
                  !memoryEnabled
                    ? 'bg-[var(--breach)] text-[var(--text)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                OFF
              </button>
            </div>
          </div>
        </div>

        {/* Step Speed Controls */}
        <div className="space-y-2 pt-2 border-t border-[var(--line)]">
          <div className="flex items-center justify-between text-[13px] font-mono">
            <span className="text-eyebrow">Step Speed</span>
            <span className="text-[13px] text-[var(--text-dim)]">{speedMs} ms</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s.ms}
                onClick={() => onChangeSpeed(s.ms)}
                className={`py-1 rounded-[6px] font-mono text-[13px] border transition-colors cursor-pointer ${
                  speedMs === s.ms
                    ? 'bg-[var(--bg-2)] border-[var(--accent)] text-[var(--accent)] font-semibold'
                    : 'bg-[var(--bg-1)] border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transport Controls */}
        <div className="space-y-2 pt-2 border-t border-[var(--line)]">
          <div className="text-eyebrow">Transport</div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onTogglePlay}
              className="py-2 px-2 rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-1 font-mono text-[13px] font-semibold cursor-pointer"
              title="Play / Pause execution (Space)"
            >
              {isRunning && !isPaused ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              onClick={onStepForward}
              disabled={isRunning && !isPaused}
              className={`py-2 px-2 rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-1 font-mono text-[13px] font-semibold cursor-pointer ${
                isRunning && !isPaused ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Step forward to next event (→)"
            >
              <SkipForward className="w-4 h-4" />
              <span>Step</span>
            </button>

            <button
              data-testid="reset-button"
              onClick={onReset}
              className="py-2 px-2 rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] text-[var(--text-dim)] hover:border-[var(--breach)] hover:text-[var(--breach)] transition-colors flex items-center justify-center gap-1 font-mono text-[13px] font-semibold cursor-pointer"
              title="Reset current run (R)"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer & Keyboard Shortcuts */}
      <div className="pt-3 border-t border-[var(--line)] text-[13px] font-mono text-[var(--text-faint)] space-y-1">
        <div className="flex items-center justify-between">
          <span>Shortcuts:</span>
          <span>Space · → · R · Esc</span>
        </div>
        {isDevFixture && (
          <div className="pt-1 flex items-center justify-between">
            <span className="px-1.5 py-0.5 rounded-[4px] border border-[var(--signal)] bg-[var(--bg-2)] text-[var(--signal)] text-[13px] font-bold">
              DEV FIXTURE
            </span>
            <span className="text-[13px] text-[var(--text-faint)]">Offline Mock</span>
          </div>
        )}
      </div>
    </aside>
  );
};
