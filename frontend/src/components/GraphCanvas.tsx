import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape, { Core, NodeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { GraphData, SwarmEvent, CollisionInfo } from '../types';
import { getCollision, getAgentColor, getAgentInitials } from '../adapters/events';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

try {
  cytoscape.use(dagre);
} catch {
  // extension already registered
}

interface GraphCanvasProps {
  graphData: GraphData | null;
  activeEvent: SwarmEvent | null;
  events: SwarmEvent[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

interface TooltipInfo {
  x: number;
  y: number;
  qualname: string;
  fileLine: string;
  pagerank?: string;
  betweenness?: string;
  risk?: string;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphData,
  activeEvent,
  events,
  selectedNodeId,
  onSelectNode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const cachedPositionsRef = useRef<Record<string, Record<string, { x: number; y: number }>>>({});
  const persistentClaimsRef = useRef<Record<string, { agent: string; intent?: string }>>({});

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [hopCountBadge, setHopCountBadge] = useState<number | null>(null);

  // Check if reduced motion is requested
  const prefersReducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Reset persistent claims on new run or reset
  useEffect(() => {
    if (activeEvent && activeEvent.index === 0) {
      persistentClaimsRef.current = {};
    }
  }, [activeEvent]);

  // Initialize and render Cytoscape instance
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const graphKey = graphData.graph_name || 'default';
    const cachedPositions = cachedPositionsRef.current[graphKey];

    // Build elements
    const elements = [
      ...graphData.nodes.map((n) => ({
        group: 'nodes' as const,
        data: {
          id: n.data.id,
          name: n.data.name,
          label: n.data.label,
          qualname: n.data.id,
          path: n.data.path || '',
          lineno: n.data.lineno || 1,
          parent: n.data.parent,
          risk_score: n.data.risk_score || 0,
          pagerank: n.data.pagerank || 0,
          betweenness: n.data.betweenness || 0
        }
      })),
      ...graphData.edges.map((e) => ({
        group: 'edges' as const,
        data: {
          id: e.data.id,
          source: e.data.source,
          target: e.data.target,
          label: e.data.label || '',
          type: e.data.type || e.data.label || 'CALLS'
        }
      }))
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        // Base Function Node
        {
          selector: 'node',
          style: {
            'background-color': '#171D26',
            'label': 'data(name)',
            'color': '#E6E8EC',
            'font-size': '13px',
            'font-family': 'Inter, system-ui, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': 'mapData(risk_score, 0, 1, 24, 44)',
            'height': 'mapData(risk_score, 0, 1, 24, 44)',
            'border-width': 1.5,
            'border-color': '#6B7686',
            'transition-property': 'background-color, border-color, border-width, opacity',
            'transition-duration': 0.2
          }
        },
        // Compound Module Container
        {
          selector: 'node:parent',
          style: {
            'background-color': '#0B0E13',
            'background-opacity': 0.6,
            'border-width': 1,
            'border-color': '#232B36',
            'border-style': 'dashed',
            'label': 'data(name)',
            'font-size': '13px',
            'font-family': 'Inter, system-ui, sans-serif',
            'color': '#6B7686',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': 8,
            'padding': '16px'
          }
        },
        // Test Node: small square in --text-faint
        {
          selector: 'node[label = "Test"]',
          style: {
            'shape': 'rectangle',
            'width': 18,
            'height': 18,
            'background-color': '#171D26',
            'border-color': '#6B7686',
            'border-width': 1,
            'color': '#6B7686',
            'font-size': '13px'
          }
        },
        // CALLS Edge: thin --text-faint
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#6B7686',
            'target-arrow-color': '#6B7686',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8,
            'curve-style': 'bezier',
            'opacity': 0.75
          }
        },
        // TESTED_BY: dashed, fainter
        {
          selector: 'edge[label = "TESTED_BY"], edge[type = "TESTED_BY"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#6B7686',
            'target-arrow-color': '#6B7686',
            'opacity': 0.35,
            'width': 1.2
          }
        },
        // Persistent Agent Halos
        {
          selector: '.agent-claim-a1',
          style: {
            'border-color': '#5B8DEF !important',
            'border-width': 4,
            'background-color': '#11161D !important',
            'color': '#5B8DEF',
            'font-weight': 'bold'
          }
        },
        {
          selector: '.agent-claim-a2',
          style: {
            'border-color': '#E0A458 !important',
            'border-width': 4,
            'background-color': '#11161D !important',
            'color': '#E0A458',
            'font-weight': 'bold'
          }
        },
        {
          selector: '.agent-claim-a3',
          style: {
            'border-color': '#4FB286 !important',
            'border-width': 4,
            'background-color': '#11161D !important',
            'color': '#4FB286',
            'font-weight': 'bold'
          }
        },
        {
          selector: '.agent-claim-a4',
          style: {
            'border-color': '#A58BE0 !important',
            'border-width': 4,
            'background-color': '#11161D !important',
            'color': '#A58BE0',
            'font-weight': 'bold'
          }
        },
        // Dimmed Elements during Collision
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.25
          }
        },
        // Active Collision Hop Nodes
        {
          selector: '.collision-hop-node',
          style: {
            'border-color': '#D9534F !important',
            'border-width': 4,
            'background-color': '#171D26 !important',
            'color': '#D9534F',
            'font-weight': 'bold',
            'opacity': 1.0
          }
        },
        // Active Collision Hop Edges
        {
          selector: '.collision-hop-edge',
          style: {
            'line-color': '#D9534F !important',
            'target-arrow-color': '#D9534F !important',
            'width': 3.5,
            'opacity': 1.0,
            'z-index': 99
          }
        },
        // Resolved Path State (Transitions to Signal, then Clear)
        {
          selector: '.resolved-signal-node',
          style: {
            'border-color': '#E3A23B !important',
            'border-width': 3,
            'opacity': 1.0
          }
        },
        {
          selector: '.resolved-signal-edge',
          style: {
            'line-color': '#E3A23B !important',
            'target-arrow-color': '#E3A23B !important',
            'width': 2.5,
            'opacity': 0.9
          }
        },
        {
          selector: '.resolved-clear-node',
          style: {
            'border-color': '#3FA796 !important',
            'border-width': 3,
            'opacity': 1.0
          }
        },
        {
          selector: '.resolved-clear-edge',
          style: {
            'line-color': '#3FA796 !important',
            'target-arrow-color': '#3FA796 !important',
            'width': 2.5,
            'opacity': 0.9
          }
        },
        // Selected Node & 2-Hop Callers
        {
          selector: '.selected-target',
          style: {
            'border-color': '#6EA8FE !important',
            'border-width': 4,
            'color': '#6EA8FE',
            'font-weight': 'bold'
          }
        },
        {
          selector: '.caller-hop-1',
          style: {
            'border-color': '#6EA8FE !important',
            'border-width': 2.5
          }
        },
        {
          selector: '.caller-hop-2',
          style: {
            'border-color': '#9AA4B2 !important',
            'border-width': 2
          }
        }
      ]
    });

    // Run layout or use cached positions to guarantee the graph never jumps between events
    if (cachedPositions && Object.keys(cachedPositions).length > 0) {
      cy.layout({
        name: 'preset',
        positions: (node: NodeSingular) => cachedPositions[node.id()] || { x: 0, y: 0 },
        fit: true,
        padding: 40
      } as any).run();
    } else {
      const layout = cy.layout({
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 35,
        rankSep: 60,
        padding: 40
      } as any);

      layout.on('layoutstop', () => {
        // Cache computed positions for this graph
        const posMap: Record<string, { x: number; y: number }> = {};
        cy.nodes().forEach((n) => {
          posMap[n.id()] = n.position();
        });
        cachedPositionsRef.current[graphKey] = posMap;
      });

      layout.run();
    }

    // Node Interaction Events: Click & Hover
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const id = node.id();
      onSelectNode(id);
    });

    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const data = node.data();
      const renderedPos = node.renderedPosition();
      const containerBounds = containerRef.current?.getBoundingClientRect();

      if (containerBounds) {
        setTooltip({
          x: containerBounds.left + renderedPos.x,
          y: containerBounds.top + renderedPos.y - 12,
          qualname: data.qualname || data.id,
          fileLine: data.path ? `${data.path}:${data.lineno}` : '—',
          pagerank: typeof data.pagerank === 'number' ? data.pagerank.toFixed(4) : '—',
          betweenness: typeof data.betweenness === 'number' ? data.betweenness.toFixed(4) : '—',
          risk: typeof data.risk_score === 'number' ? data.risk_score.toFixed(4) : '—'
        });
      }
    });

    cy.on('mouseout', 'node', () => {
      setTooltip(null);
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphData, onSelectNode]);

  // Imperative class mutation: Persistent Halos, Animations, and Selections without re-rendering Cytoscape
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // 1. Track persistent agent claims
    if (activeEvent && activeEvent.node_ids && activeEvent.node_ids.length > 0) {
      const agentInitials = getAgentInitials(activeEvent.agent).toLowerCase();
      let haloClass = 'agent-claim-a1';
      if (agentInitials === 'a2') haloClass = 'agent-claim-a2';
      else if (agentInitials === 'a3') haloClass = 'agent-claim-a3';
      else if (agentInitials === 'a4') haloClass = 'agent-claim-a4';

      if (['CLAIM', 'CODE_GEN', 'FORK_SIMULATION'].includes(activeEvent.phase)) {
        activeEvent.node_ids.forEach((nid) => {
          persistentClaimsRef.current[nid] = {
            agent: haloClass,
            intent: activeEvent.params?.intent
          };
        });
      }
    }

    // Apply persistent halos across nodes
    Object.entries(persistentClaimsRef.current).forEach(([nid, claim]) => {
      const node = cy.getElementById(nid);
      if (node && !node.hasClass(claim.agent)) {
        node.addClass(claim.agent);
      }
    });

    // 2. Clear transient classes
    cy.elements().removeClass(
      'dimmed collision-hop-node collision-hop-edge resolved-signal-node resolved-signal-edge resolved-clear-node resolved-clear-edge'
    );
    setHopCountBadge(null);

    const collision = getCollision(activeEvent);

    // 3. Collision Path Animation
    if (collision && collision.path_nodes && collision.path_nodes.length > 1) {
      const pathNodes = collision.path_nodes;
      setHopCountBadge(collision.hops || pathNodes.length - 1);

      // Collect path elements
      const pathEles = cy.collection();
      pathNodes.forEach((nid, i) => {
        const node = cy.getElementById(nid);
        if (node) pathEles.merge(node);
        if (i < pathNodes.length - 1) {
          const nextId = pathNodes[i + 1];
          const edge = cy.edges(
            `[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`
          );
          if (edge) pathEles.merge(edge);
        }
      });

      // Dim non-path elements to 25% opacity
      cy.elements().not(pathEles).addClass('dimmed');

      // Camera animates to fit path with padding
      if (!prefersReducedMotion.current) {
        cy.animate({
          fit: { eles: pathEles, padding: 80 },
          duration: 300,
          easing: 'ease-in-out-cubic'
        });
      }

      // Sequentially illuminate hops at 300ms intervals
      pathNodes.forEach((nid, hopIndex) => {
        const delay = prefersReducedMotion.current ? 0 : hopIndex * 300;
        setTimeout(() => {
          const node = cy.getElementById(nid);
          if (node) node.addClass('collision-hop-node');

          if (hopIndex < pathNodes.length - 1) {
            const nextId = pathNodes[hopIndex + 1];
            const edge = cy.edges(
              `[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`
            );
            if (edge) edge.addClass('collision-hop-edge');
          }
        }, delay);
      });
    }

    // 4. Resolution & Handoff Path Fading (fade to --signal, then --clear on verify)
    if (activeEvent?.phase === 'HANDOFF' || activeEvent?.phase === 'RESOLUTION') {
      const pastCollision = events.map(getCollision).find(Boolean);
      if (pastCollision && pastCollision.path_nodes) {
        pastCollision.path_nodes.forEach((nid, idx) => {
          const node = cy.getElementById(nid);
          if (node) node.addClass('resolved-signal-node');
          if (idx < pastCollision.path_nodes.length - 1) {
            const nextId = pastCollision.path_nodes[idx + 1];
            const edge = cy.edges(
              `[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`
            );
            if (edge) edge.addClass('resolved-signal-edge');
          }
        });
      }
    }

    if (activeEvent?.phase === 'VERIFICATION') {
      const pastCollision = events.map(getCollision).find(Boolean);
      if (pastCollision && pastCollision.path_nodes) {
        pastCollision.path_nodes.forEach((nid, idx) => {
          const node = cy.getElementById(nid);
          if (node) node.addClass('resolved-clear-node');
          if (idx < pastCollision.path_nodes.length - 1) {
            const nextId = pastCollision.path_nodes[idx + 1];
            const edge = cy.edges(
              `[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`
            );
            if (edge) edge.addClass('resolved-clear-edge');
          }
        });
      }
    }
  }, [activeEvent, events]);

  // Handle User Node Selection & 2-Hop Callers Highlighting
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass('selected-target caller-hop-1 caller-hop-2');

    if (selectedNodeId) {
      const target = cy.getElementById(selectedNodeId);
      if (target.length > 0) {
        target.addClass('selected-target');

        // Hop 1 reverse callers
        const hop1Incomers = target.incomers('node');
        hop1Incomers.addClass('caller-hop-1');

        // Hop 2 reverse callers
        const hop2Incomers = hop1Incomers.incomers('node').not(target).not(hop1Incomers);
        hop2Incomers.addClass('caller-hop-2');
      }
    }
  }, [selectedNodeId]);

  const fitGraph = useCallback(() => {
    cyRef.current?.fit(undefined, 40);
  }, []);

  const zoomIn = useCallback(() => {
    cyRef.current?.zoom((cyRef.current?.zoom() || 1) * 1.25);
  }, []);

  const zoomOut = useCallback(() => {
    cyRef.current?.zoom((cyRef.current?.zoom() || 1) * 0.8);
  }, []);

  return (
    <div className="relative w-full h-full bg-[var(--bg-0)] overflow-hidden select-none">
      {/* Cytoscape Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Hop Counter Badge during Collision */}
      {hopCountBadge !== null && (
        <div className="absolute top-4 left-6 z-20 px-3 py-1.5 rounded-[6px] border border-[var(--breach)] bg-[var(--bg-1)] font-mono text-[13px] font-bold text-[var(--breach)] shadow-md">
          CHAIN: {hopCountBadge} HOPS
        </div>
      )}

      {/* Quiet Legend Bottom-Left */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 px-3 py-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)] font-mono text-[13px] text-[var(--text-dim)] shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[2px] border border-dashed border-[var(--line)] bg-[var(--bg-0)]" />
          <span>Module</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--bg-2)] border border-[var(--line)]" />
          <span>Function</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--bg-2)] border border-[var(--text-faint)]" />
          <span>Test</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[var(--text-faint)]" />
          <span>CALLS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 border-t border-dashed border-[var(--text-faint)] opacity-60" />
          <span>TESTED_BY</span>
        </div>
      </div>

      {/* Canvas Fit & Zoom Controls Bottom-Right */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 p-1 rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)] shadow-sm">
        <button
          onClick={zoomIn}
          className="p-1.5 rounded-[4px] hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
          title="Zoom In"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={zoomOut}
          className="p-1.5 rounded-[4px] hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={fitGraph}
          className="p-1.5 rounded-[4px] hover:bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
          title="Fit View"
          aria-label="Fit view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Hover Tooltip (>=13px) */}
      {tooltip && (
        <div
          className="fixed z-40 px-3 py-2 rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)] text-[13px] font-mono shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-bold text-[var(--text)]">{tooltip.qualname}</div>
          <div className="text-[var(--text-faint)] text-[13px]">{tooltip.fileLine}</div>
          <div className="mt-1 pt-1 border-t border-[var(--line)] grid grid-cols-3 gap-2 text-[var(--text-dim)] text-[13px]">
            <div>
              Risk: <span className="text-[var(--text)]">{tooltip.risk}</span>
            </div>
            <div>
              PR: <span className="text-[var(--text)]">{tooltip.pagerank}</span>
            </div>
            <div>
              BC: <span className="text-[var(--text)]">{tooltip.betweenness}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
