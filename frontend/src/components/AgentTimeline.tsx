import React, { useRef, useEffect, useState } from 'react';
import { SwarmEvent, GraphData } from '../types';
import { getAgentColor, getAgentInitials, getCollision } from '../adapters/events';
import { VerifiedText } from './VerifiedText';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AgentTimelineProps {
  events: SwarmEvent[];
  selectedIndex: number;
  graphData: GraphData | null;
  onSelectEvent: (index: number) => void;
  onSelectNode?: (nodeId: string) => void;
}

const PHASE_EYEBROWS: Record<string, string> = {
  PLANNING: 'Plan',
  RECALL: 'Recall',
  CLAIM: 'Claim',
  FORK_SIMULATION: 'Fork',
  COLLISION_DETECTION: 'Detect',
  GIT_COMPARISON: 'Verify',
  RESOLUTION: 'Resolve',
  IMPACT_ANALYSIS: 'Resolve',
  CODE_GEN: 'Patch',
  HANDOFF: 'Resolve',
  VERIFICATION: 'Verify',
  MEMORY_UPDATE: 'Memory'
};

export const AgentTimeline: React.FC<AgentTimelineProps> = ({
  events,
  selectedIndex,
  graphData,
  onSelectEvent,
  onSelectNode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  // Auto-scroll selected step into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex]);

  const toggleExpand = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col overflow-y-auto bg-[var(--bg-1)] select-none"
      role="feed"
      aria-label="Agent Swarm Timeline"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-2.5 bg-[var(--bg-0)] border-b border-[var(--line)] flex items-center justify-between">
        <span className="text-eyebrow">Agent Timeline</span>
        <span className="text-[13px] font-mono text-[var(--text-dim)]">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {/* Events List */}
      <div className="p-3 space-y-2">
        {events.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-faint)] font-mono text-[13px]">
            Ready. Start a run or select a scenario to observe swarm execution.
          </div>
        ) : (
          events.map((evt, idx) => {
            const isSelected = selectedIndex === idx;
            const collision = getCollision(evt);
            const isCollision = !!collision;
            const isHandoff = evt.phase === 'HANDOFF' || evt.tool === 'record_handoff';
            const eyebrow = PHASE_EYEBROWS[evt.phase] || evt.phase;
            const agentColor = getAgentColor(evt.agent);
            const initials = getAgentInitials(evt.agent);
            const isExpanded = !!expandedIndices[idx];

            return (
              <div
                key={idx}
                ref={isSelected ? activeItemRef : null}
                onClick={() => onSelectEvent(idx)}
                className={`p-3 rounded-[8px] border transition-colors cursor-pointer text-[13px] ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--bg-2)]'
                    : 'border-[var(--line)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)]'
                }`}
                style={{
                  borderLeft: isCollision
                    ? '3px solid var(--breach)'
                    : isSelected
                    ? '3px solid var(--accent)'
                    : '1px solid var(--line)'
                }}
              >
                {/* Top line: index, eyebrow, agent chip */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-mono text-[var(--text-faint)]">
                      #{idx + 1}
                    </span>
                    <span className="text-eyebrow">{eyebrow}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isHandoff ? (
                      <span className="cf-chip bg-[var(--bg-2)] text-[var(--clear)] border-[var(--line)] font-semibold">
                        A1 → A2
                      </span>
                    ) : (
                      <span
                        className="cf-chip font-bold"
                        style={{
                          backgroundColor: 'var(--bg-2)',
                          color: agentColor,
                          borderColor: agentColor
                        }}
                      >
                        {initials} · {evt.agent}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message body with VerifiedText */}
                <div
                  className={`text-[var(--text)] leading-relaxed select-text font-sans ${
                    isExpanded ? '' : 'line-clamp-2'
                  }`}
                >
                  <VerifiedText
                    text={evt.message}
                    graphData={graphData}
                    onSelectNode={onSelectNode}
                  />
                </div>

                {/* Expand / Collapse message if long */}
                {evt.message && evt.message.length > 90 && (
                  <div className="mt-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(idx, e)}
                      className="inline-flex items-center gap-1 text-[13px] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    >
                      <span>{isExpanded ? 'Less' : 'More'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
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
