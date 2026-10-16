import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import cytoscape, { Core, NodeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { GraphData, SwarmEvent } from '../types';
import { getCollision, getAgentColor, getAgentInitials } from '../adapters/events';
import { Maximize2, ZoomIn, ZoomOut, Tag, Eye } from 'lucide-react';

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

interface PersistentClaim {
  nodeId: string;
  agent: string;
  initials: string;
  color: string;
  intent: string;
  chipLabel: string;
}

interface ClaimChipRender {
  nodeId: string;
  chipLabel: string;
  color: string;
  x: number;
  y: number;
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
  const persistentClaimsRef = useRef<Record<string, PersistentClaim>>({});
  const isFocusModeRef = useRef<boolean>(false);

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [hopCountBadge, setHopCountBadge] = useState<number | null>(null);
  const [showAllLabels, setShowAllLabels] = useState<boolean>(false);
  const [showTestedBy, setShowTestedBy] = useState<boolean>(false);
  const [claimChips, setClaimChips] = useState<ClaimChipRender[]>([]);

  // Check if reduced motion is requested
  const prefersReducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Identify top 8 nodes by risk_score for idle mode
  const top8NodeIds = useMemo(() => {
    if (!graphData?.nodes) return new Set<string>();
    const funcNodes = graphData.nodes.filter(
      (n) => !n.data.parent && n.data.label !== 'Module'
    );
    const sorted = [...funcNodes].sort(
      (a, b) => (b.data.risk_score || 0) - (a.data.risk_score || 0)
    );
    return new Set(sorted.slice(0, 8).map((n) => n.data.id));
  }, [graphData]);

  // Reset persistent claims on new run or reset
  useEffect(() => {
    if (activeEvent && activeEvent.index === 0) {
      persistentClaimsRef.current = {};
      isFocusModeRef.current = false;
      setClaimChips([]);
    }
  }, [activeEvent]);

  // Update claim chips overlay positions from cytoscape
  const updateClaimChipPositions = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const chips: ClaimChipRender[] = [];
    Object.values(persistentClaimsRef.current).forEach((claim) => {
      const node = cy.getElementById(claim.nodeId);
      if (node.length > 0 && !node.hasClass('hidden-node') && node.visible()) {
        const pos = node.renderedPosition();
        const outerH = node.renderedOuterHeight();
        chips.push({
          nodeId: claim.nodeId,
          chipLabel: claim.chipLabel,
          color: claim.color,
          x: pos.x,
          y: pos.y - outerH / 2 - 8
        });
      }
    });

    setClaimChips(chips);
  }, []);

  // Initialize and render Cytoscape instance
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    // Filter edges: render only CALLS (solid) and TESTED_BY (dashed). Exclude DEFINES and IMPORTS.
    // Exclude self-loops.
    const filteredEdges = graphData.edges
      .filter((e) => {
        if (e.data.source === e.data.target) return false;
        const type = (e.data.type || e.data.label || 'CALLS').toUpperCase();
        return type === 'CALLS' || type === 'TESTED_BY';
      })
      .map((e) => ({
        group: 'edges' as const,
        data: {
          id: e.data.id,
          source: e.data.source,
          target: e.data.target,
          label: e.data.label || '',
          type: (e.data.type || e.data.label || 'CALLS').toUpperCase()
        }
      }));

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
      ...filteredEdges
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        // Base Function Node in Focus: 40–52px, label 14px function name only
        {
          selector: 'node',
          style: {
            'background-color': '#171D26',
            'label': (ele: NodeSingular) => {
              if (ele.isParent()) return ele.data('name');
              if (showAllLabels) return ele.data('name');
              if (top8NodeIds.has(ele.id())) return ele.data('name');
              if (isFocusModeRef.current || ele.hasClass('collision-hop-node')) {
                return ele.data('name');
              }
              return '';
            },
            'color': '#E6E8EC',
            'font-size': '14px',
            'min-zoomed-font-size': 13,
            'font-family': 'Inter, system-ui, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': 'mapData(risk_score, 0, 1, 40, 52)',
            'height': 'mapData(risk_score, 0, 1, 40, 52)',
            'border-width': 1.5,
            'border-color': '#6B7686',
            'transition-property': 'background-color, border-color, border-width, opacity, width, height',
            'transition-duration': 0.3
          }
        },
        // Compound Module Container: 13px label
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
            'min-zoomed-font-size': 13,
            'font-family': 'Inter, system-ui, sans-serif',
            'color': '#6B7686',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': 8,
            'padding': '16px'
          }
        },
        // Test Node
        {
          selector: 'node[label = "Test"]',
          style: {
            'shape': 'rectangle',
            'width': 22,
            'height': 22,
            'background-color': '#171D26',
            'border-color': '#6B7686',
            'border-width': 1,
            'color': '#6B7686',
            'font-size': '13px',
            'min-zoomed-font-size': 13
          }
        },
        // Hidden node for focus mode
        {
          selector: '.hidden-node',
          style: {
            'display': 'none'
          }
        },
        // CALLS Edge: solid, arrowheads, no self loops
        {
          selector: 'edge[type = "CALLS"]',
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
        // TESTED_BY: dashed, hidden by default (toggleable)
        {
          selector: 'edge[type = "TESTED_BY"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#6B7686',
            'target-arrow-color': '#6B7686',
            'target-arrow-shape': 'triangle',
            'opacity': 0.4,
            'width': 1.2,
            'display': showTestedBy ? 'element' : 'none'
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
        // Active Collision Path: 56px in --breach
        {
          selector: '.collision-hop-node',
          style: {
            'width': 56,
            'height': 56,
            'border-color': '#D9534F !important',
            'border-width': 4,
            'background-color': '#171D26 !important',
            'color': '#D9534F',
            'font-weight': 'bold',
            'opacity': 1.0,
            'z-index': 99
          }
        },
        {
          selector: '.collision-hop-edge',
          style: {
            'line-color': '#D9534F !important',
            'target-arrow-color': '#D9534F !important',
            'width': 3,
            'opacity': 1.0,
            'z-index': 99
          }
        },
        // Resolution: Fades to --signal at BLOCKED/HANDOFF, then --clear when merged
        {
          selector: '.resolved-signal-node',
          style: {
            'border-color': '#E3A23B !important',
            'border-width': 3,
            'color': '#E3A23B',
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
            'color': '#3FA796',
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
        // Selected Node & Callers
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

    // Idle initial layout: dagre Top-to-Bottom, fitted to canvas with 60px padding
    const initialLayout = cy.layout({
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 40,
      rankSep: 70,
      padding: 60
    } as any);

    initialLayout.on('layoutstop', () => {
      cy.fit(undefined, 60);
      updateClaimChipPositions();
    });

    initialLayout.run();

    // Node Interaction Events
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      onSelectNode(node.id());
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

    // Synchronize chip positions on pan, zoom, position
    cy.on('pan zoom position render', () => {
      updateClaimChipPositions();
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphData, showAllLabels, showTestedBy, top8NodeIds, onSelectNode, updateClaimChipPositions]);

  // Window / Container resize observer: refit full graph on idle resize
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (cyRef.current) {
        cyRef.current.resize();
        if (!isFocusModeRef.current) {
          cyRef.current.fit(undefined, 60);
        }
        updateClaimChipPositions();
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateClaimChipPositions]);

  // Focus Mode & Dynamic State updates during a run
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // 1. Track persistent agent claims
    if (activeEvent && activeEvent.node_ids && activeEvent.node_ids.length > 0) {
      const agentInitials = getAgentInitials(activeEvent.agent).toUpperCase();
      const agentColor = getAgentColor(activeEvent.agent);
      const haloClass = `agent-claim-${agentInitials.toLowerCase()}`;
      const intent = activeEvent.params?.intent || 'SIGNATURE_CHANGE';

      if (['CLAIM', 'CODE_GEN', 'FORK_SIMULATION'].includes(activeEvent.phase)) {
        activeEvent.node_ids.forEach((nid) => {
          persistentClaimsRef.current[nid] = {
            nodeId: nid,
            agent: haloClass,
            initials: agentInitials,
            color: agentColor,
            intent,
            chipLabel: `${agentInitials} · ${intent}`
          };
        });
      }
    }

    const claimedNodes = Object.values(persistentClaimsRef.current);
    const hasActiveClaims = claimedNodes.length > 0;
    const isRunActive = activeEvent !== null && activeEvent.phase !== 'IDLE' && hasActiveClaims;

    // 2. FOCUS MODE: Visible set = claimed symbols + within 4 CALLS hops + parent modules
    if (isRunActive && !isFocusModeRef.current) {
      isFocusModeRef.current = true;

      const claimedIds = claimedNodes.map((c) => c.nodeId);
      const visibleIds = new Set<string>(claimedIds);
      let currentFrontier = new Set<string>(claimedIds);

      // 4 CALLS hops in either direction
      for (let hop = 0; hop < 4; hop++) {
        const nextFrontier = new Set<string>();
        currentFrontier.forEach((nid) => {
          const node = cy.getElementById(nid);
          if (node.length > 0) {
            // Outgoing CALLS
            const outTargets = node.outgoers('edge[type = "CALLS"]').targets();
            outTargets.forEach((tgt) => {
              const tid = tgt.id();
              if (!visibleIds.has(tid)) {
                visibleIds.add(tid);
                nextFrontier.add(tid);
              }
            });
            // Incoming CALLS
            const inSources = node.incomers('edge[type = "CALLS"]').sources();
            inSources.forEach((src) => {
              const sid = src.id();
              if (!visibleIds.has(sid)) {
                visibleIds.add(sid);
                nextFrontier.add(sid);
              }
            });
          }
        });
        currentFrontier = nextFrontier;
      }

      // Add parent module containers of all visible nodes
      visibleIds.forEach((nid) => {
        const node = cy.getElementById(nid);
        const parentId = node.data('parent');
        if (parentId) {
          visibleIds.add(parentId);
        }
      });

      // Hide all non-visible nodes
      cy.nodes().forEach((n) => {
        if (visibleIds.has(n.id())) {
          n.removeClass('hidden-node');
        } else {
          n.addClass('hidden-node');
        }
      });

      // Re-layout subgraph LEFT→RIGHT by call depth (dagre rankDir LR, nodeSep 50, rankSep 120)
      const visibleNodes = cy.nodes().not('.hidden-node');
      const focusLayout = visibleNodes.layout({
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 50,
        rankSep: 120,
        animate: !prefersReducedMotion.current,
        animationDuration: 300,
        padding: 60
      } as any);

      focusLayout.on('layoutstop', () => {
        cy.animate({
          fit: { eles: visibleNodes, padding: 60 },
          duration: 300
        });
        updateClaimChipPositions();
      });

      focusLayout.run();
    } else if (!isRunActive && isFocusModeRef.current) {
      // Revert to idle mode
      isFocusModeRef.current = false;
      cy.nodes().removeClass('hidden-node');
      cy.fit(undefined, 60);
      updateClaimChipPositions();
    }

    // Apply persistent halos across nodes
    Object.entries(persistentClaimsRef.current).forEach(([nid, claim]) => {
      const node = cy.getElementById(nid);
      if (node.length > 0 && !node.hasClass(claim.agent)) {
        node.addClass(claim.agent);
      }
    });

    // 3. Clear transient classes
    cy.elements().removeClass(
      'dimmed collision-hop-node collision-hop-edge resolved-signal-node resolved-signal-edge resolved-clear-node resolved-clear-edge'
    );
    setHopCountBadge(null);

    const collision = getCollision(activeEvent);

    // 4. Collision Path Animation: 56px path nodes in --breach, 25% opacity other visible nodes, 3px edges drawn sequentially
    if (collision && collision.path_nodes && collision.path_nodes.length > 1) {
      const pathNodes = collision.path_nodes;
      setHopCountBadge(collision.hops || pathNodes.length - 1);

      // Collect path elements
      const pathEles = cy.collection();
      pathNodes.forEach((nid, i) => {
        const node = cy.getElementById(nid);
        if (node.length > 0) pathEles.merge(node);
        if (i < pathNodes.length - 1) {
          const nextId = pathNodes[i + 1];
          const edge = cy.edges(
            `[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`
          );
          if (edge.length > 0) pathEles.merge(edge);
        }
      });

      // Dim non-path visible elements to 25% opacity
      cy.elements().not(pathEles).addClass('dimmed');

      // Camera animates to fit path with 80px padding
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
          if (node.length > 0) node.addClass('collision-hop-node');

          if (hopIndex < pathNodes.length - 1) {
            const nextId = pathNodes[hopIndex + 1];
            const edge = cy.edges(
              `[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`
            );
            if (edge.length > 0) edge.addClass('collision-hop-edge');
          }
          updateClaimChipPositions();
        }, delay);
      });
    }

    // 5. Resolution: Path fades to --signal at BLOCKED/HANDOFF, then --clear when merged
    if (
      activeEvent?.phase === 'HANDOFF' ||
      activeEvent?.phase === 'RESOLUTION' ||
      activeEvent?.phase === 'BLOCKED'
    ) {
      const pastCollision = events.map(getCollision).find(Boolean);
      if (pastCollision && pastCollision.path_nodes) {
        pastCollision.path_nodes.forEach((nid, idx) => {
          const node = cy.getElementById(nid);
          if (node.length > 0) node.addClass('resolved-signal-node');
          if (idx < pastCollision.path_nodes.length - 1) {
            const nextId = pastCollision.path_nodes[idx + 1];
            const edge = cy.edges(
              `[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`
            );
            if (edge.length > 0) edge.addClass('resolved-signal-edge');
          }
        });
      }
    }

    if (activeEvent?.phase === 'VERIFICATION') {
      const pastCollision = events.map(getCollision).find(Boolean);
      if (pastCollision && pastCollision.path_nodes) {
        pastCollision.path_nodes.forEach((nid, idx) => {
          const node = cy.getElementById(nid);
          if (node.length > 0) node.addClass('resolved-clear-node');
          if (idx < pastCollision.path_nodes.length - 1) {
            const nextId = pastCollision.path_nodes[idx + 1];
            const edge = cy.edges(
              `[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`
            );
            if (edge.length > 0) edge.addClass('resolved-clear-edge');
          }
        });
      }
    }

    updateClaimChipPositions();
  }, [activeEvent, events, updateClaimChipPositions]);

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
    if (cyRef.current) {
      const visible = cyRef.current.nodes().not('.hidden-node');
      cyRef.current.fit(visible.length > 0 ? visible : undefined, 60);
      updateClaimChipPositions();
    }
  }, [updateClaimChipPositions]);

  const zoomIn = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.25);
      updateClaimChipPositions();
    }
  }, [updateClaimChipPositions]);

  const zoomOut = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 0.8);
      updateClaimChipPositions();
    }
  }, [updateClaimChipPositions]);

  return (
    <div className="relative w-full h-full bg-[var(--bg-0)] overflow-hidden select-none">
      {/* Cytoscape Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* HTML Overlay for Persistent Claim Chips */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {claimChips.map((chip) => (
          <div
            key={chip.nodeId}
            className="absolute transition-all duration-200 -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-[4px] font-mono text-[13px] font-bold border shadow-lg bg-[var(--bg-1)] whitespace-nowrap"
            style={{
              left: chip.x,
              top: chip.y,
              borderColor: chip.color,
              color: chip.color
            }}
          >
            {chip.chipLabel}
          </div>
        ))}
      </div>

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

      {/* Canvas Controls Bottom-Right: Toggles & Zoom */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 p-1 rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)] shadow-sm font-mono text-[13px]">
        {/* Toggle Show All Labels */}
        <button
          onClick={() => setShowAllLabels(!showAllLabels)}
          className={`flex items-center gap-1 px-2 py-1 rounded-[4px] transition-colors cursor-pointer ${
            showAllLabels
              ? 'bg-[var(--accent)] text-[var(--bg-0)] font-bold'
              : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-2)]'
          }`}
          title="Toggle Show All Labels (defaults to Top 8 risk nodes)"
        >
          <Tag className="w-3.5 h-3.5" />
          <span>All labels</span>
        </button>

        {/* Toggle Tested By */}
        <button
          onClick={() => setShowTestedBy(!showTestedBy)}
          className={`flex items-center gap-1 px-2 py-1 rounded-[4px] transition-colors cursor-pointer ${
            showTestedBy
              ? 'bg-[var(--accent)] text-[var(--bg-0)] font-bold'
              : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-2)]'
          }`}
          title="Toggle display of TESTED_BY dependency edges"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Tests</span>
        </button>

        <div className="w-[1px] h-4 bg-[var(--line)] mx-1" />

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
          title="Fit View (60px padding)"
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
