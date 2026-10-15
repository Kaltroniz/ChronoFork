import React from 'react';
import { SwarmEvent } from '../types';
import { Bot, CheckCircle, ShieldAlert, GitBranch, Terminal, Sparkles, Clock } from 'lucide-react';

interface AgentTimelineProps {
  events: SwarmEvent[];
  selectedIndex: number;
  onSelectEvent: (index: number) => void;
}

export const AgentTimeline: React.FC<AgentTimelineProps> = ({
  events,
  selectedIndex,
  onSelectEvent,
}) => {
  const getAgentColor = (agentName: string) => {
    if (agentName.includes('Config') || agentName === 'agent_1') return 'text-blue-400 bg-blue-950/40 border-blue-500/40';
    if (agentName.includes('Worker') || agentName === 'agent_2') return 'text-amber-400 bg-amber-950/40 border-amber-500/40';
    if (agentName.includes('Reports') || agentName === 'agent_3') return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/40';
    if (agentName.includes('Telemetry') || agentName === 'agent_4') return 'text-purple-400 bg-purple-950/40 border-purple-500/40';
    if (agentName === 'Coordinator') return 'text-rose-400 bg-rose-950/40 border-rose-500/40';
    if (agentName === 'Verifier') return 'text-cyan-400 bg-cyan-950/40 border-cyan-500/40';
    return 'text-slate-300 bg-slate-800 border-slate-700';
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'COLLISION_DETECTION':
        return <ShieldAlert className="w-3.5 h-3.5 text-red-400" />;
      case 'FORK_SIMULATION':
        return <GitBranch className="w-3.5 h-3.5 text-indigo-400" />;
      case 'RECALL':
      case 'MEMORY_UPDATE':
        return <Sparkles className="w-3.5 h-3.5 text-cyan-400" />;
      case 'VERIFICATION':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Bot className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="h-1/2 flex flex-col border-b border-[#1f293d] overflow-hidden bg-[#111827]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f293d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold text-slate-200 tracking-wider uppercase font-mono">
            Agent Timeline & Handoffs
          </h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          {events.length} steps
        </span>
      </div>

      {/* Timeline Scroll List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
            <span>Ready. Click "Run Scenario" to begin.</span>
          </div>
        ) : (
          events.map((evt, idx) => {
            const isSelected = selectedIndex === idx;
            const isCollision = evt.phase === 'COLLISION_DETECTION' && evt.collision;

            return (
              <div
                key={idx}
                onClick={() => onSelectEvent(idx)}
                className={`p-2.5 rounded-lg border cursor-pointer transition text-xs font-mono flex flex-col gap-1.5 ${
                  isSelected
                    ? 'border-cyan-500/70 bg-[#151e32] shadow-sm'
                    : isCollision
                    ? 'border-red-500/60 bg-red-950/20 hover:bg-red-950/30'
                    : 'border-[#1f293d] bg-[#111827] hover:bg-[#151e32]/60 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getAgentColor(evt.agent)}`}>
                      {evt.agent}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    {getPhaseIcon(evt.phase)}
                    <span>{evt.phase}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 font-sans leading-tight">
                  {evt.message}
                </p>

                {evt.collision && (
                  <div className="mt-1 px-2 py-1 rounded bg-red-900/30 border border-red-500/40 text-[10px] text-red-300 flex items-center justify-between">
                    <span>Transitive Collision ({evt.collision.hops} hops)</span>
                    <span className="font-bold">POLICY: {evt.collision.policy}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
