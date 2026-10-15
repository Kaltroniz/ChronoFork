import React, { useState, useEffect, useRef } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { GraphViewer } from './components/GraphViewer';
import { AgentTimeline } from './components/AgentTimeline';
import { CypherInspector } from './components/CypherInspector';
import { BottomDrawer } from './components/BottomDrawer';
import { GraphData, SwarmEvent, MemoryData } from './types';

export const App: React.FC = () => {
  const [selectedRepo, setSelectedRepo] = useState<string>('taskflow');
  const [currentScenario, setCurrentScenario] = useState<number>(1);
  const [mode, setMode] = useState<'replay' | 'live'>('replay');
  const [speedMs, setSpeedMs] = useState<number>(500);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);

  const [events, setEvents] = useState<SwarmEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [bottomDrawerExpanded, setBottomDrawerExpanded] = useState<boolean>(true);

  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<any>(null);

  // 1. Fetch Graph & Memory Data on Repo Change
  useEffect(() => {
    fetchGraphData(selectedRepo);
    fetchMemoryData(selectedRepo);
  }, [selectedRepo]);

  const fetchGraphData = async (repo: string) => {
    try {
      const res = await fetch(`/graph/repo:${repo}`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (err) {
      console.error('Error fetching graph data:', err);
    }
  };

  const fetchMemoryData = async (repo: string) => {
    try {
      const res = await fetch(`/memory/${repo}`);
      if (res.ok) {
        const data = await res.json();
        setMemoryData(data);
      }
    } catch (err) {
      console.error('Error fetching memory data:', err);
    }
  };

  const handleResetMemory = async () => {
    try {
      const res = await fetch(`/memory/${selectedRepo}/reset`, { method: 'POST' });
      if (res.ok) {
        fetchMemoryData(selectedRepo);
      }
    } catch (err) {
      console.error('Error resetting memory:', err);
    }
  };

  // 2. Start Scenario Execution
  const startScenario = async (scId: number) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setEvents([]);
    setCurrentIndex(0);
    setIsRunning(true);
    setIsPaused(false);
    setCurrentScenario(scId);

    const targetRepo = scId === 4 ? 'analytics' : 'taskflow';
    if (targetRepo !== selectedRepo) {
      setSelectedRepo(targetRepo);
    }

    try {
      const runRes = await fetch('/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: targetRepo,
          scenario: scId,
          mode: mode,
          memory_enabled: memoryEnabled
        }),
      });

      const { run_id } = await runRes.json();

      // Connect SSE Stream
      const es = new EventSource(`/runs/${run_id}/events?delay_ms=0`);
      eventSourceRef.current = es;

      const receivedEvents: SwarmEvent[] = [];

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'RUN_COMPLETE') {
            es.close();
            fetchMemoryData(targetRepo);
            return;
          }

          receivedEvents.push(payload);
          setEvents([...receivedEvents]);
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      es.onerror = () => {
        es.close();
      };
    } catch (err) {
      console.error('Error starting scenario:', err);
      setIsRunning(false);
    }
  };

  // 3. Playback Pacing Loop
  useEffect(() => {
    if (!isRunning || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < events.length - 1) {
          return prev + 1;
        } else {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            setIsRunning(false);
            clearInterval(timerRef.current);
          }
          return prev;
        }
      });
    }, speedMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isPaused, events.length, speedMs]);

  const activeEvent = events[currentIndex] || null;
  const activeCollision = activeEvent?.collision || null;

  const handleTogglePlay = () => {
    if (!isRunning) {
      startScenario(currentScenario);
    } else {
      setIsPaused(!isPaused);
    }
  };

  const handleStepForward = () => {
    if (currentIndex < events.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleReset = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    if (timerRef.current) clearInterval(timerRef.current);
    setEvents([]);
    setCurrentIndex(0);
    setIsRunning(false);
    setIsPaused(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0f19] text-slate-100 font-sans">
      {/* LEFT: Task & Run Control Panel */}
      <ControlPanel
        currentScenario={currentScenario}
        onSelectScenario={(scId) => {
          setCurrentScenario(scId);
          startScenario(scId);
        }}
        selectedRepo={selectedRepo}
        onSelectRepo={(repo) => setSelectedRepo(repo)}
        isRunning={isRunning}
        isPaused={isPaused}
        onTogglePlay={handleTogglePlay}
        onStepForward={handleStepForward}
        onReset={handleReset}
        speedMs={speedMs}
        onChangeSpeed={setSpeedMs}
        mode={mode}
        onToggleMode={setMode}
        memoryEnabled={memoryEnabled}
        onToggleMemory={() => setMemoryEnabled(!memoryEnabled)}
        onResetMemory={handleResetMemory}
      />

      {/* CENTER & BOTTOM: Code Graph & Drawers */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* CENTER: Graph Viewer */}
        <div className="flex-1 relative overflow-hidden">
          <GraphViewer
            graphData={graphData}
            activeEvent={activeEvent}
            activeCollision={activeCollision}
            onSelectNode={(nodeId) => {
              console.log('Selected node:', nodeId);
            }}
          />
        </div>

        {/* BOTTOM: Drawer (Verifier, Fork Blast Radius & Memory) */}
        <BottomDrawer
          memoryData={memoryData}
          activeEvent={activeEvent}
          events={events}
          isExpanded={bottomDrawerExpanded}
          onToggleExpand={() => setBottomDrawerExpanded(!bottomDrawerExpanded)}
          onResetMemory={handleResetMemory}
        />
      </div>

      {/* RIGHT: Agent Timeline & Cypher Inspector */}
      <div className="w-96 h-full flex flex-col border-l border-[#1f293d] bg-[#111827]">
        <AgentTimeline
          events={events.slice(0, currentIndex + 1)}
          selectedIndex={currentIndex}
          onSelectEvent={(idx) => {
            setIsPaused(true);
            setCurrentIndex(idx);
          }}
        />

        <CypherInspector activeEvent={activeEvent} />
      </div>
    </div>
  );
};

export default App;
