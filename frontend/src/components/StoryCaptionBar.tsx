import React from 'react';
import { SwarmEvent, GraphData } from '../types';
import { getEventFirstSentence } from '../adapters/events';
import { VerifiedText } from './VerifiedText';

interface StoryCaptionBarProps {
  activeEvent: SwarmEvent | null;
  currentScenario: number;
  graphData: GraphData | null;
  isStoryActive: boolean;
  onSelectNode?: (nodeId: string) => void;
}

const CHAPTERS = [
  { id: 1, label: '1 Hidden collision' },
  { id: 2, label: '2 Git vs graph' },
  { id: 3, label: '3 Serialize & hand off' },
  { id: 4, label: '4 Memory' },
  { id: 5, label: '5 Safe parallel' }
];

export const StoryCaptionBar: React.FC<StoryCaptionBarProps> = ({
  activeEvent,
  currentScenario,
  graphData,
  isStoryActive,
  onSelectNode
}) => {
  if (!isStoryActive && !activeEvent) return null;

  // Determine current chapter tick based on event's chapter field or scenario and phase
  let currentChapter = 1;
  if (typeof (activeEvent as any)?.chapter === 'number') {
    currentChapter = (activeEvent as any).chapter;
  } else if (currentScenario === 1) {
    if (activeEvent?.phase === 'GIT_COMPARISON') {
      currentChapter = 2;
    } else if (
      ['RESOLUTION', 'CODE_GEN', 'HANDOFF', 'VERIFICATION', 'MEMORY_UPDATE', 'BLOCKED'].includes(
        activeEvent?.phase || ''
      )
    ) {
      currentChapter = 3;
    } else {
      currentChapter = 1;
    }
  } else if (currentScenario === 2) {
    currentChapter = 4;
  } else if (currentScenario === 3 || currentScenario === 4) {
    currentChapter = 5;
  }

  const captionText = activeEvent
    ? getEventFirstSentence(activeEvent)
    : 'Swarm ready. Select a scenario or start execution to observe multi-agent coordination.';

  return (
    <div
      id="chrono-caption-bar"
      className="w-full max-w-[960px] h-[72px] flex flex-col justify-center px-4 transition-opacity duration-300 select-none"
      role="region"
      aria-label="Story Narration and Chapter Progress"
    >
      {/* 5 Chapter Progress Ticks */}
      <div className="flex items-center justify-between gap-3 pb-1 mb-1 border-b border-[var(--line)]">
        {CHAPTERS.map((ch) => {
          const isPassed = ch.id < currentChapter;
          const isCurrent = ch.id === currentChapter;

          return (
            <div key={ch.id} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full h-1 rounded-full transition-colors ${
                  isCurrent
                    ? 'bg-[var(--accent)]'
                    : isPassed
                    ? 'bg-[var(--clear)]'
                    : 'bg-[var(--line)]'
                }`}
              />
              <span
                className={`font-mono text-[13px] tracking-tight text-center select-none whitespace-nowrap ${
                  isCurrent
                    ? 'text-[var(--text)] font-bold'
                    : isPassed
                    ? 'text-[var(--clear)]'
                    : 'text-[var(--text-faint)]'
                }`}
              >
                {ch.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Narration Caption */}
      <div className="text-[13px] font-medium text-[var(--text)] leading-tight truncate select-text font-sans text-center">
        <VerifiedText text={captionText} graphData={graphData} onSelectNode={onSelectNode} />
      </div>
    </div>
  );
};
