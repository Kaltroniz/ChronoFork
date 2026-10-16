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

  // Determine current chapter tick based on scenario and phase
  let currentChapter = 1;
  if (currentScenario === 1) {
    if (activeEvent?.phase === 'GIT_COMPARISON') {
      currentChapter = 2;
    } else if (
      ['RESOLUTION', 'CODE_GEN', 'HANDOFF', 'VERIFICATION', 'MEMORY_UPDATE'].includes(
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

  const captionText = getEventFirstSentence(activeEvent);

  return (
    <div
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-[840px] max-w-[94%] cf-floating-card px-6 py-4 transition-opacity duration-300 pointer-events-auto"
      role="region"
      aria-label="Story Narration and Chapter Progress"
    >
      {/* 5 Chapter Progress Ticks */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[var(--line)]">
        {CHAPTERS.map((ch) => {
          const isPassed = ch.id < currentChapter;
          const isCurrent = ch.id === currentChapter;

          return (
            <div key={ch.id} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`w-full h-1.5 rounded-full transition-colors ${
                  isCurrent
                    ? 'bg-[var(--accent)]'
                    : isPassed
                    ? 'bg-[var(--clear)]'
                    : 'bg-[var(--line)]'
                }`}
              />
              <span
                className={`font-mono text-[13px] uppercase tracking-wider text-center select-none ${
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
      <div className="text-[17px] font-medium text-[var(--text)] leading-snug line-clamp-2 select-text font-sans">
        <VerifiedText text={captionText} graphData={graphData} onSelectNode={onSelectNode} />
      </div>
    </div>
  );
};
