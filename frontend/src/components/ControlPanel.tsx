import React from 'react';
import { Play, Pause, SkipForward, RotateCcw, Database, Layers, Sparkles, ShieldAlert, Cpu, Brain, Trash2 } from 'lucide-react';

interface ControlPanelProps {
  currentScenario: number;
  onSelectScenario: (scenario: number) => void;
  selectedRepo: string;
  onSelectRepo: (repo: string) => void;
  isRunning: boolean;
  isPaused: boolean;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onReset: () => void;
  speedMs: number;
  onChangeSpeed: (ms: number) => void;
  mode: 'replay' | 'live';
  onToggleMode: (mode: 'replay' | 'live') => void;
  memoryEnabled: boolean;
  onToggleMemory: () => void;
  onResetMemory: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentScenario,
  onSelectScenario,
  selectedRepo,
  onSelectRepo,
  isRunning,
  isPaused,
  onTogglePlay,
  onStepForward,
  onReset,
  speedMs,
  onChangeSpeed,
  mode,
  onToggleMode,
  memoryEnabled,
  onToggleMemory,
  onResetMemory
}) => {
  const scenarios = [
    {
      id: 1,
      title: "1. Hidden Collision",
      subtitle: "4-hop chain | Git blindspot vs Swarm serialization",
      icon: ShieldAlert,
      badge: "Flagship",
      color: "border-red-500/50 text-red-400 bg-red-950/20"
    },
    {
      id: 2,
      title: "2. Memory Recall",
      subtitle: "Recalls rule upfront | Adapts claim to avoid collision",
      icon: Sparkles,
      badge: "Adaptive",
      color: "border-cyan-500/50 text-cyan-400 bg-cyan-950/20"
    },
    {
      id: 3,
      title: "3. Safe Parallel",
      subtitle: "Core worker + reports run concurrently",
      icon: Cpu,
      badge: "Disjoint",
      color: "border-emerald-500/50 text-emerald-400 bg-emerald-950/20"
    },
    {
      id: 4,
      title: "4. Multi-Tenant Isolation",
      subtitle: "Switch to separate analytics repo & memory",
      icon: Layers,
      badge: "Isolated",
      color: "border-purple-500/50 text-purple-400 bg-purple-950/20"
    }
  ];

  return (
    <div className="w-80 h-full bg-[#111827] border-r border-[#1f293d] flex flex-col p-4 z-10 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#1f293d]">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
            ChronoFork
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
              v1.0
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 font-medium">Graph-Coordinated Coding Swarm</p>
        </div>
      </div>

      {/* Repo Switcher & Mode Toggle */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" /> ACTIVE REPO:
          </span>
          <select
            value={selectedRepo}
            onChange={(e) => onSelectRepo(e.target.value)}
            disabled={isRunning}
            className="bg-[#151e32] border border-[#1f293d] rounded px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="taskflow">taskflow (15 modules)</option>
            <option value="analytics">analytics (isolated repo)</option>
          </select>
        </div>

        {/* Replay vs Live Toggle */}
        <div className="grid grid-cols-2 p-1 rounded-lg bg-[#0b0f19] border border-[#1f293d] text-xs font-mono">
          <button
            onClick={() => onToggleMode('replay')}
            className={`py-1 rounded text-center transition font-semibold ${
              mode === 'replay' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            REPLAY (0 API)
          </button>
          <button
            onClick={() => onToggleMode('live')}
            className={`py-1 rounded text-center transition font-semibold ${
              mode === 'live' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            LIVE LLM
          </button>
        </div>

        {/* Memory Coordination Toggle & Reset */}
        <div className="p-2.5 rounded-lg bg-[#0b0f19] border border-[#1f293d] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-300">Memory Graph:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMemory}
              disabled={isRunning}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition border ${
                memoryEnabled
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50'
                  : 'bg-red-950/60 text-red-400 border-red-500/50'
              }`}
              title="Toggle whether agents recall past procedural rules"
            >
              {memoryEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={onResetMemory}
              disabled={isRunning}
              className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition"
              title="Reset memory graph for demo reset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scenario Selection */}
      <div className="mt-4 flex-1 overflow-y-auto">
        <div className="text-[11px] font-mono text-slate-400 tracking-wider uppercase mb-2">
          Demonstration Scenarios
        </div>
        <div className="space-y-2">
          {scenarios.map((sc) => {
            const Icon = sc.icon;
            const isSelected = currentScenario === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => onSelectScenario(sc.id)}
                disabled={isRunning}
                className={`w-full text-left p-2.5 rounded-lg border transition flex flex-col gap-1 ${
                  isSelected
                    ? `${sc.color} ring-1 ring-cyan-500/40 shadow-md`
                    : 'bg-[#151e32]/60 border-[#1f293d] hover:bg-[#151e32] text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold">{sc.title}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {sc.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono pl-6 leading-tight">
                  {sc.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Run Controls */}
      <div className="mt-auto pt-3 border-t border-[#1f293d] space-y-2.5">
        {/* Speed Slider */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>STEP DELAY:</span>
          <span className="text-cyan-400 font-bold">{speedMs}ms</span>
        </div>
        <input
          type="range"
          min="100"
          max="1200"
          step="100"
          value={speedMs}
          onChange={(e) => onChangeSpeed(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition shadow-md ${
              isRunning && !isPaused
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30'
            }`}
          >
            {isRunning && !isPaused ? (
              <>
                <Pause className="w-4 h-4" /> Pause Swarm
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> {isRunning ? 'Resume' : 'Run Scenario'}
              </>
            )}
          </button>

          <button
            onClick={onStepForward}
            disabled={!isRunning || !isPaused}
            className="p-2.5 rounded-lg bg-[#151e32] border border-[#1f293d] text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-40"
            title="Step One Event"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={onReset}
            className="p-2.5 rounded-lg bg-[#151e32] border border-[#1f293d] text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Reset Graph & Run"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
