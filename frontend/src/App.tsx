import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { GraphCanvas } from './components/GraphCanvas';
import { HeroSplit } from './components/HeroSplit';
import { ZeroPathProof } from './components/ZeroPathProof';
import { StoryCaptionBar } from './components/StoryCaptionBar';
import { ResultStrip } from './components/ResultStrip';
import { RightSplitter } from './components/RightSplitter';
import { AgentTimeline } from './components/AgentTimeline';
import { QueryInspector } from './components/QueryInspector';
import { GraphData, SwarmEvent, MemoryData } from './types';
import { normalizeEvent } from './adapters/events';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation & Mode State
  const [selectedRepo, setSelectedRepo] = useState<string>('taskflow');
  const [currentScenario, setCurrentScenario] = useState<number>(1);
  const [mode, setMode] = useState<'replay' | 'live'>('replay');
  const [speedMs, setSpeedMs] = useState<number>(500);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);

  // Data State
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [events, setEvents] = useState<SwarmEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Playback & Story State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isStoryActive, setIsStoryActive] = useState<boolean>(false);
  const [storyStage, setStoryStage] = useState<number>(1); // 1 -> 2 -> 3
  const [heroDismissed, setHeroDismissed] = useState<boolean>(false);
  const [zeroProofDismissed, setZeroProofDismissed] = useState<boolean>(false);

  // UI Drawer State
  const [resultStripExpanded, setResultStripExpanded] = useState<boolean>(true);

  // Health & Error State
  const [backendHealthy, setBackendHealthy] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDevFixture, setIsDevFixture] = useState<boolean>(false);
  const [memoryWasReset, setMemoryWasReset] = useState<boolean>(false);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<any>(null);

  // 1. Initial Health Check & Data Fetching
  const checkBackendHealth = useCallback(async () => {
    try {
      const res = await fetch('/health', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setBackendHealthy(true);
        setErrorMessage(null);
        return true;
      } else {
        setBackendHealthy(false);
        return false;
      }
    } catch {
      setBackendHealthy(false);
      return false;
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 5000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  const fetchGraphData = useCallback(async (repo: string) => {
    try {
      const res = await fetch(`/graph/repo:${repo}`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (err) {
      console.warn('Could not fetch graph data:', err);
    }
  }, []);

  const fetchMemoryData = useCallback(async (repo: string) => {
    try {
      const res = await fetch(`/memory/${repo}`);
      if (res.ok) {
        const data = await res.json();
        setMemoryData(data);
      }
    } catch (err) {
      console.warn('Could not fetch memory data:', err);
    }
  }, []);

  useEffect(() => {
    fetchGraphData(selectedRepo);
    fetchMemoryData(selectedRepo);
  }, [selectedRepo, fetchGraphData, fetchMemoryData]);

  // Reset Demo handler
  const handleResetDemo = async () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    if (timerRef.current) clearInterval(timerRef.current);

    setEvents([]);
    setCurrentIndex(0);
    setIsRunning(false);
    setIsPaused(false);
    setIsStoryActive(false);
    setHeroDismissed(false);
    setZeroProofDismissed(false);
    setSelectedNodeId(null);

    try {
      await fetch(`/memory/${selectedRepo}/reset`, { method: 'POST' });
      await fetchMemoryData(selectedRepo);
      await fetchGraphData(selectedRepo);
      setMemoryWasReset(true);
    } catch (err) {
      console.warn('Error resetting memory:', err);
    }
  };

  // Reset Scenario handler: resets memory and resets run to clean state
  const handleResetScenario = async (scId: number) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await fetch(`/memory/${selectedRepo}/reset`, { method: 'POST' });
      await fetchMemoryData(selectedRepo);
      setMemoryWasReset(true);
      setEvents([]);
      setCurrentIndex(0);
      setIsRunning(false);
      setIsPaused(true);
    } catch (err) {
      console.warn('Memory reset failed:', err);
    }
  };

  // 2. Scenario Runner
  const startScenario = useCallback(
    async (scId: number, autoPlay: boolean = true) => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);

      setEvents([]);
      setCurrentIndex(0);
      setIsRunning(true);
      setIsPaused(!autoPlay);
      setCurrentScenario(scId);
      setHeroDismissed(false);
      setZeroProofDismissed(false);

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
            memory_enabled: scId === 1 ? false : memoryEnabled
          })
        });

        if (!runRes.ok) {
          let detail = `HTTP ${runRes.status}`;
          try {
            const errData = await runRes.json();
            if (errData.detail) detail = errData.detail;
          } catch {}
          throw new Error(`Execution error: ${detail}`);
        }

        const runData = await runRes.json();
        const run_id = runData.run_id;

        // Connect SSE Stream
        const es = new EventSource(`/runs/${run_id}/events?delay_ms=0`);
        eventSourceRef.current = es;

        const receivedEvents: SwarmEvent[] = [];

        es.onmessage = (e) => {
          try {
            const raw = JSON.parse(e.data);
            if (raw.type === 'RUN_COMPLETE') {
              es.close();
              fetchMemoryData(targetRepo);
              return;
            }

            const normalized = normalizeEvent(raw);
            receivedEvents.push(normalized);
            setEvents([...receivedEvents]);

            if (normalized.phase === 'MEMORY_UPDATE' || normalized.phase === 'MEMORY_PERSISTENCE' || normalized.memory_write) {
              setMemoryWasReset(false);
              fetchMemoryData(targetRepo);
            }
          } catch (err) {
            console.error('SSE parse error:', err);
          }
        };

        es.onerror = () => {
          es.close();
        };
      } catch (err: any) {
        console.error('Error starting scenario:', err);
        setErrorMessage(err.message || 'Failed to start scenario execution. Ensure backend and FalkorDB are running.');
        setIsRunning(false);
      }
    },
    [selectedRepo, mode, memoryEnabled, fetchMemoryData]
  );

  // 3. Playback Pacing Loop & Story Mode Auto-Advance
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
          // Finished current event stream
          if (eventSourceRef.current?.readyState === EventSource.CLOSED || isDevFixture) {
            // If in Story Mode, auto-advance to next chapter
            if (isStoryActive) {
              if (storyStage === 1) {
                setStoryStage(2);
                setTimeout(() => startScenario(2), 1200);
              } else if (storyStage === 2) {
                setStoryStage(3);
                setTimeout(() => startScenario(3), 1200);
              } else {
                setIsStoryActive(false);
                setIsRunning(false);
              }
            } else {
              setIsRunning(false);
            }
            clearInterval(timerRef.current);
          }
          return prev;
        }
      });
    }, speedMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isPaused, events.length, speedMs, isStoryActive, storyStage, isDevFixture, startScenario]);

  // Story Mode Trigger: Starts by resetting memory so confidence is identical every time
  const handlePlayStory = async () => {
    try {
      await fetch(`/memory/${selectedRepo}/reset`, { method: 'POST' });
      await fetchMemoryData(selectedRepo);
      setMemoryWasReset(true);
    } catch (err) {
      console.warn('Memory reset failed:', err);
    }
    setIsStoryActive(true);
    setStoryStage(1);
    startScenario(1);
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(prev + 1, events.length - 1));
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        startScenario(currentScenario);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsStoryActive(false);
        setHeroDismissed(true);
        setZeroProofDismissed(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [events.length, currentScenario, startScenario]);

  // Expose test automation hooks on window in dev
  useEffect(() => {
    (window as any).__chronoSetIndex = (idx: number) => {
      setIsPaused(true);
      setCurrentIndex(idx);
    };
    (window as any).__chronoStartScenario = (scId: number) => {
      return startScenario(scId, false);
    };
    (window as any).__chronoGetState = () => ({
      currentIndex,
      currentScenario,
      activeEvent: events[currentIndex] || null,
      events,
      eventsLength: events.length,
      isRunning,
      isPaused
    });
  }, [currentIndex, currentScenario, events, isRunning, isPaused, startScenario]);

  // Current active event and events strictly up to current index
  const activeEvent = events[currentIndex] || null;
  const currentEvents = events.slice(0, currentIndex + 1);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-0)] text-[var(--text)] font-sans select-none">
      {/* Backend Unreachable Banner */}
      {!backendHealthy && (
        <div className="bg-[var(--signal)] text-[var(--bg-0)] font-mono text-[13px] font-bold py-1 px-4 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Backend unreachable — retrying connection to http://127.0.0.1:8000</span>
          </div>
          <button
            onClick={() => checkBackendHealth()}
            className="flex items-center gap-1 hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry now</span>
          </button>
        </div>
      )}

      {/* TOP BAR (52px) */}
      <TopBar
        activeEvent={activeEvent}
        mode={mode}
        onToggleMode={setMode}
        onResetDemo={handleResetDemo}
      />

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT RAIL (280px) */}
        <LeftRail
          currentScenario={currentScenario}
          onSelectScenario={(scId) => {
            setIsStoryActive(false);
            startScenario(scId);
          }}
          isRunning={isRunning}
          isPaused={isPaused}
          isStoryActive={isStoryActive}
          onPlayStory={handlePlayStory}
          onTogglePlay={() => {
            if (!isRunning) startScenario(currentScenario);
            else setIsPaused(!isPaused);
          }}
          onStepForward={() => {
            setCurrentIndex((prev) => Math.min(prev + 1, events.length - 1));
          }}
          onReset={() => handleResetScenario(currentScenario)}
          speedMs={speedMs}
          onChangeSpeed={setSpeedMs}
          memoryEnabled={memoryEnabled}
          onToggleMemory={() => setMemoryEnabled(!memoryEnabled)}
          isDevFixture={isDevFixture}
          memoryWasReset={memoryWasReset}
        />

        {/* CENTER COLUMN: Graph Canvas + Overlays + ResultStrip */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* GRAPH CANVAS (Dominant) */}
          <div className="flex-1 relative overflow-hidden">
            <GraphCanvas
              graphData={graphData}
              activeEvent={activeEvent}
              events={currentEvents}
              currentScenario={currentScenario}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />

            {/* Overlays: HeroSplit (top-center on collision) */}
            <HeroSplit
              activeEvent={activeEvent}
              events={currentEvents}
              graphData={graphData}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
              onDismiss={() => setHeroDismissed(true)}
              dismissed={heroDismissed}
            />

            {/* Overlays: ZeroPathProof (top-center on safe parallel) */}
            <ZeroPathProof
              activeEvent={activeEvent}
              events={currentEvents}
              currentScenario={currentScenario}
              onDismiss={() => setZeroProofDismissed(true)}
              dismissed={zeroProofDismissed}
            />

          </div>

          {/* DOCKED CAPTION BAR (72px strip between canvas and bottom result strip) */}
          <div id="chrono-caption-bar" className="h-[72px] shrink-0 border-t border-[var(--line)] bg-[var(--bg-1)] flex items-center justify-center px-4 z-10">
            <StoryCaptionBar
              activeEvent={activeEvent}
              currentScenario={currentScenario}
              graphData={graphData}
              isStoryActive={isStoryActive}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />
          </div>

          {/* BOTTOM RESULT STRIP (280px fixed height, 44px collapsed header) */}
          <ResultStrip
            activeEvent={activeEvent}
            events={currentEvents}
            memoryData={memoryData}
            graphData={graphData}
            mode={mode}
            memoryEnabled={memoryEnabled}
            isExpanded={resultStripExpanded}
            onToggleExpand={() => setResultStripExpanded(!resultStripExpanded)}
            onToggleMemory={() => setMemoryEnabled(!memoryEnabled)}
            onResetMemory={async () => {
              await fetch(`/memory/${selectedRepo}/reset`, { method: 'POST' });
              fetchMemoryData(selectedRepo);
              setMemoryWasReset(true);
            }}
            onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            currentScenario={currentScenario}
          />
        </div>

        {/* RIGHT COLUMN: Resizable Splitter with AgentTimeline + QueryInspector (420px) */}
        <RightSplitter
          defaultTopRatio={0.55}
          topComponent={
            <AgentTimeline
              events={events.slice(0, currentIndex + 1)}
              selectedIndex={currentIndex}
              graphData={graphData}
              onSelectEvent={(idx) => {
                setIsPaused(true);
                setCurrentIndex(idx);
                setHeroDismissed(false);
                setZeroProofDismissed(false);
              }}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />
          }
          bottomComponent={<QueryInspector activeEvent={activeEvent} />}
        />
      </div>

      {/* Error Toast Bottom-Right */}
      {errorMessage && (
        <div className="fixed bottom-4 right-4 z-50 p-4 rounded-[8px] border border-[var(--breach)] bg-[var(--bg-1)] shadow-xl flex items-center gap-3 font-mono text-[13px] text-[var(--text)]">
          <AlertCircle className="w-5 h-5 text-[var(--breach)] shrink-0" />
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="ml-2 px-2 py-1 rounded bg-[var(--bg-2)] hover:bg-[var(--line)] text-[var(--text-dim)]"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
