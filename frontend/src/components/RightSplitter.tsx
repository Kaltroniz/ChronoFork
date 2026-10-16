import React, { useState, useRef, useCallback } from 'react';

interface RightSplitterProps {
  topComponent: React.ReactNode;
  bottomComponent: React.ReactNode;
  defaultTopRatio?: number; // e.g. 0.55
}

export const RightSplitter: React.FC<RightSplitterProps> = ({
  topComponent,
  bottomComponent,
  defaultTopRatio = 0.55
}) => {
  const [topRatio, setTopRatio] = useState<number>(defaultTopRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = moveEvent.clientY - rect.top;
      const newRatio = Math.max(0.25, Math.min(0.8, relativeY / rect.height));
      setTopRatio(newRatio);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-[420px] h-full flex flex-col border-l border-[var(--line)] bg-[var(--bg-1)] overflow-hidden shrink-0 select-none"
    >
      {/* Top Pane */}
      <div
        style={{ height: `${topRatio * 100}%` }}
        className="flex flex-col overflow-hidden"
      >
        {topComponent}
      </div>

      {/* Resizable Divider Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-[5px] bg-[var(--bg-0)] hover:bg-[var(--accent)] border-y border-[var(--line)] cursor-row-resize transition-colors shrink-0 z-10 flex items-center justify-center group"
        title="Drag to resize panels"
      >
        <div className="w-8 h-[2px] rounded-full bg-[var(--line)] group-hover:bg-[var(--accent)]" />
      </div>

      {/* Bottom Pane */}
      <div
        style={{ height: `${(1 - topRatio) * 100}%` }}
        className="flex flex-col overflow-hidden"
      >
        {bottomComponent}
      </div>
    </div>
  );
};
