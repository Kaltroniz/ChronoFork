import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { GraphData, SwarmEvent, CollisionInfo } from '../types';
import { Maximize2, ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';

// Safely register dagre layout extension
try {
  cytoscape.use(dagre);
} catch (e) {
  // Already registered
}

interface GraphViewerProps {
  graphData: GraphData | null;
  activeEvent: SwarmEvent | null;
  activeCollision: CollisionInfo | null;
  onSelectNode: (nodeId: string) => void;
}

export const GraphViewer: React.FC<GraphViewerProps> = ({
  graphData,
  activeEvent,
  activeCollision,
  onSelectNode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [, setSelectedNodeId] = useState<string | null>(null);

  // Persistent registry of claimed nodes: nodeId -> agentClass
  const persistentClaimsRef = useRef<Record<string, string>>({});

  // Reset persistent claims on new run start
  useEffect(() => {
    if (activeEvent && activeEvent.index === 0) {
      persistentClaimsRef.current = {};
    }
  }, [activeEvent]);

  // Initialize Cytoscape Instance
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    try {
      if (cyRef.current) {
        cyRef.current.destroy();
      }

      // Build elements with compound module parents
      const elements = [
        ...graphData.nodes.map(n => ({
          group: 'nodes' as const,
          data: {
            id: n.data.id,
            name: n.data.name,
            label: n.data.label,
            qualname: n.data.id,
            path: n.data.path,
            lineno: n.data.lineno,
            parent: n.data.parent,
            risk_score: n.data.risk_score || 0,
            pagerank: n.data.pagerank || 0,
            betweenness: n.data.betweenness || 0,
          }
        })),
        ...graphData.edges.map(e => ({
          group: 'edges' as const,
          data: {
            id: e.data.id,
            source: e.data.source,
            target: e.data.target,
            label: e.data.label,
            type: e.data.type || e.data.label
          }
        }))
      ];

      const cy = cytoscape({
        container: containerRef.current,
        elements,
        boxSelectionEnabled: false,
        autounselectify: false,
        style: [
          // Base Node Style
          {
            selector: 'node',
            style: {
              'background-color': '#1e293b',
              'label': 'data(name)',
              'color': '#cbd5e1',
              'font-size': '11px',
              'font-family': 'Inter, sans-serif',
              'text-valign': 'bottom',
              'text-margin-y': 5,
              'width': 'mapData(risk_score, 0, 1, 26, 50)',
              'height': 'mapData(risk_score, 0, 1, 26, 50)',
              'border-width': 2,
              'border-color': '#475569',
              'transition-property': 'background-color, border-color, border-width, width, height',
              'transition-duration': 0.3
            }
          },
          // Compound Module Container Style
          {
            selector: 'node:parent',
            style: {
              'background-color': 'rgba(15, 23, 42, 0.45)',
              'border-width': 1.5,
              'border-color': 'rgba(99, 102, 241, 0.35)',
              'border-style': 'dashed',
              'label': 'data(name)',
              'font-size': '10px',
              'color': '#818cf8',
              'text-valign': 'top',
              'text-halign': 'center',
              'padding': '14px'
            }
          },
          {
            selector: 'node[label = "Module"]',
            style: {
              'shape': 'round-rectangle',
              'background-color': '#1e1b4b',
              'border-color': '#6366f1',
              'border-width': 2,
            }
          },
          {
            selector: 'node[label = "Test"]',
            style: {
              'shape': 'diamond',
              'background-color': '#064e3b',
              'border-color': '#10b981',
              'border-width': 2,
            }
          },
          {
            selector: 'node[label = "Class"]',
            style: {
              'shape': 'hexagon',
              'background-color': '#3b0764',
              'border-color': '#a855f7',
              'border-width': 2,
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 1.5,
              'line-color': '#334155',
              'target-arrow-color': '#334155',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'arrow-scale': 0.8,
              'opacity': 0.65
            }
          },
          {
            selector: 'edge[label = "CALLS"], edge[type = "CALLS"]',
            style: {
              'line-color': '#38bdf8',
              'target-arrow-color': '#38bdf8',
              'width': 2,
              'opacity': 0.85
            }
          },
          {
            selector: 'edge[label = "TESTED_BY"], edge[type = "TESTED_BY"]',
            style: {
              'line-color': '#34d399',
              'target-arrow-color': '#34d399',
              'line-style': 'dashed',
              'width': 1.5,
              'opacity': 0.7
            }
          },
          // Persistent Agent Halos
          {
            selector: '.agent-1-active',
            style: {
              'border-color': '#3b82f6 !important',
              'border-width': 4,
              'background-color': '#1d4ed8 !important',
              'color': '#93c5fd',
              'font-weight': 'bold'
            }
          },
          {
            selector: '.agent-2-active',
            style: {
              'border-color': '#f59e0b !important',
              'border-width': 4,
              'background-color': '#b45309 !important',
              'color': '#fde68a',
              'font-weight': 'bold'
            }
          },
          {
            selector: '.agent-3-active',
            style: {
              'border-color': '#10b981 !important',
              'border-width': 4,
              'background-color': '#047857 !important',
              'color': '#a7f3d0',
              'font-weight': 'bold'
            }
          },
          {
            selector: '.agent-4-active',
            style: {
              'border-color': '#8b5cf6 !important',
              'border-width': 4,
              'background-color': '#6d28d9 !important',
              'color': '#ddd6fe',
              'font-weight': 'bold'
            }
          },
          // Hop-by-Hop Animation Highlight
          {
            selector: '.hop-active',
            style: {
              'background-color': '#f97316 !important',
              'border-color': '#fed7aa !important',
              'border-width': 5,
              'color': '#ffedd5',
              'font-weight': 'bold'
            }
          },
          {
            selector: '.hop-edge',
            style: {
              'line-color': '#f97316 !important',
              'target-arrow-color': '#f97316 !important',
              'width': 4,
              'opacity': 1.0,
              'z-index': 90
            }
          },
          // Final Collision State
          {
            selector: '.collision-highlight',
            style: {
              'background-color': '#ef4444 !important',
              'border-color': '#fca5a5 !important',
              'border-width': 5,
              'color': '#fecaca',
              'font-weight': 'bold'
            }
          },
          {
            selector: '.collision-edge',
            style: {
              'line-color': '#ef4444 !important',
              'target-arrow-color': '#ef4444 !important',
              'width': 4,
              'opacity': 1.0,
              'z-index': 99
            }
          },
          {
            selector: 'node:selected',
            style: {
              'border-color': '#06b6d4',
              'border-width': 4,
              'color': '#22d3ee'
            }
          }
        ],
        layout: {
          name: 'dagre',
          rankDir: 'TB',
          nodeSep: 35,
          rankSep: 55,
          padding: 25
        } as any
      });

      cy.on('tap', 'node', (evt) => {
        const id = evt.target.id();
        setSelectedNodeId(id);
        onSelectNode(id);
      });

      cyRef.current = cy;
    } catch (err) {
      console.warn('Cytoscape dagre fallback', err);
    }
  }, [graphData]);

  // Handle Event Highlights, Persistent Halos & Hop-by-Hop Animations
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Track persistent claimed nodes
    if (activeEvent && activeEvent.node_ids && activeEvent.node_ids.length > 0) {
      let agentClass = 'agent-1-active';
      if (activeEvent.agent.includes('Worker') || activeEvent.agent === 'agent_2') {
        agentClass = 'agent-2-active';
      } else if (activeEvent.agent.includes('Reports') || activeEvent.agent === 'agent_3') {
        agentClass = 'agent-3-active';
      } else if (activeEvent.agent.includes('Telemetry') || activeEvent.agent === 'agent_4') {
        agentClass = 'agent-4-active';
      }

      if (['CLAIM', 'CODE_GEN', 'FORK_SIMULATION'].includes(activeEvent.phase)) {
        activeEvent.node_ids.forEach(nid => {
          persistentClaimsRef.current[nid] = agentClass;
        });
      }
    }

    // Apply persistent halos across all claimed nodes
    Object.entries(persistentClaimsRef.current).forEach(([nid, cls]) => {
      const node = cy.getElementById(nid);
      if (node && !node.hasClass(cls)) {
        node.addClass(cls);
      }
    });

    // Animate Collision Hop-by-Hop
    if (activeCollision && activeCollision.path_nodes && activeCollision.path_nodes.length > 1) {
      const path = activeCollision.path_nodes;
      cy.elements().removeClass('hop-active hop-edge collision-highlight collision-edge');

      // Sequentially pulse hops
      path.forEach((nid, hopIndex) => {
        setTimeout(() => {
          const node = cy.getElementById(nid);
          if (node) {
            node.addClass('collision-highlight');
          }
          if (hopIndex < path.length - 1) {
            const nextId = path[hopIndex + 1];
            const edge = cy.edges(`[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`);
            edge.addClass('collision-edge');
          }
        }, hopIndex * 250);
      });
    } else if (!activeCollision) {
      cy.elements().removeClass('hop-active hop-edge collision-highlight collision-edge');
    }
  }, [activeEvent, activeCollision]);

  const fitGraph = () => cyRef.current?.fit(undefined, 30);
  const zoomIn = () => cyRef.current?.zoom((cyRef.current?.zoom() || 1) * 1.25);
  const zoomOut = () => cyRef.current?.zoom((cyRef.current?.zoom() || 1) * 0.8);

  return (
    <div className="relative w-full h-full bg-[#0b0f19] overflow-hidden flex flex-col">
      {/* Top Banner on Active Collision */}
      {activeCollision && (
        <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between px-5 py-3 rounded-lg bg-red-950/90 border border-red-500 shadow-xl shadow-red-950/70 backdrop-blur-md animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-red-600/30 text-red-400">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Git: 0 line conflicts
                </span>
                <span className="text-red-400 font-bold text-sm">
                  | ChronoFork: 1 transitive collision ({activeCollision.hops} hops)
                </span>
              </div>
              <p className="text-xs text-red-200/90 font-mono mt-0.5">
                Path: {activeCollision.path_nodes.join(' → ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-red-500/20 text-red-300 border border-red-500/40">
              POLICY: {activeCollision.policy}
            </span>
          </div>
        </div>
      )}

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 p-1 rounded-lg bg-slate-900/80 border border-slate-800 backdrop-blur-md">
        <button onClick={zoomIn} className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition" title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={zoomOut} className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition" title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={fitGraph} className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition" title="Fit View">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas Element */}
      <div ref={containerRef} className="w-full h-full flex-1" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span>
          <span>Module</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
          <span>Function</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rotate-45 bg-emerald-500"></span>
          <span>Test</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-sky-400"></span>
          <span>CALLS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 border-t border-dashed border-emerald-400"></span>
          <span>TESTED_BY</span>
        </div>
      </div>
    </div>
  );
};
