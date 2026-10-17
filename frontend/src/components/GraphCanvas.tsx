import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import cytoscape, { Core, NodeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { GraphData, SwarmEvent } from '../types';
import { getCollision, getAgentColor, getAgentInitials, agentLabel } from '../adapters/events';
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
  currentScenario?: number;
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
  agentId: string;
  nodeId: string;
  agent: string;
  initials: string;
  color: string;
  intent: string;
  chipLabel: string;
  agentName?: string;
}

interface ClaimChipRender {
  id: string;
  nodeId: string;
  chipLabel: string;
  color: string;
  intent: string;
  agentName?: string;
  x: number;
  y: number;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphData,
  activeEvent,
  events,
  currentScenario = 1,
  selectedNodeId,
  onSelectNode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const isFocusModeRef = useRef<boolean>(false);
  const lastLaidOutClaimIdsRef = useRef<string>('');
  const activeChainNodeIdsRef = useRef<string[]>([]);

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [hopCountBadge, setHopCountBadge] = useState<number | null>(null);
  const [showAllLabels, setShowAllLabels] = useState<boolean>(false);
  const [showTestedBy, setShowTestedBy] = useState<boolean>(false);
  const [claimChips, setClaimChips] = useState<ClaimChipRender[]>([]);
  const [handoffPos, setHandoffPos] = useState<{ x: number; y: number } | null>(null);

  // Check if reduced motion is requested
  const prefersReducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Identify top 8 function/class nodes by risk_score for idle mode
  const top8NodeIds = useMemo(() => {
    if (!graphData?.nodes) return new Set<string>();
    const funcNodes = graphData.nodes.filter(
      (n) => n.data.label === 'Function' || n.data.label !== 'Module'
    );
    const sorted = [...funcNodes].sort(
      (a, b) => (b.data.risk_score || 0) - (a.data.risk_score || 0)
    );
    return new Set(sorted.slice(0, 8).map((n) => n.data.id));
  }, [graphData]);

  const eventsUpToCurrent = useMemo(() => {
    if (!activeEvent) return events;
    const idx = events.findIndex((e) => e.index === activeEvent.index);
    if (idx >= 0) return events.slice(0, idx + 1);
    return events.slice(0, activeEvent.index + 1);
  }, [events, activeEvent]);

  // Maintain claims map keyed strictly by agent_id built ONLY from CLAIM events (and memory-adapted claims in scenario 2)
  // Requirement 2: Claim chip text: "A1 · SIGNATURE_CHANGE" (agent id + intent from the CLAIM).
  // Agent names stay in the timeline and in a chip tooltip.
  const claimsByAgent = useMemo(() => {
    const map = new Map<string, PersistentClaim>();

    for (const e of eventsUpToCurrent) {
      if (e.phase === 'CLAIM') {
        const symbol = e.params?.symbol_qname || (e.node_ids && e.node_ids[0]) || '';
        const intent = e.params?.intent || 'BODY_EDIT';
        const label = agentLabel(e);
        const agentId = label.id;
        const color = getAgentColor(label.id);
        const haloClass = `agent-claim-${label.id.toLowerCase()}`;

        if (!map.has(agentId)) {
          map.set(agentId, {
            agentId,
            nodeId: symbol,
            agent: haloClass,
            initials: label.id,
            color,
            intent,
            chipLabel: `${label.id} · ${intent}`,
            agentName: label.name
          });
        }
      } else if (e.phase === 'MEMORY_ADAPTATION') {
        // Scenario 2: Memory-adapted claims
        // A1 adapts intent on load_config to BODY_EDIT
        map.set('A1', {
          agentId: 'A1',
          nodeId: (e.node_ids && e.node_ids[0]) || 'taskflow.config.load_config',
          agent: 'agent-claim-a1',
          initials: 'A1',
          color: getAgentColor('A1'),
          intent: 'BODY_EDIT',
          chipLabel: 'A1 · BODY_EDIT',
          agentName: 'ConfigCoder'
        });

        if (!map.has('A2')) {
          map.set('A2', {
            agentId: 'A2',
            nodeId: 'taskflow.worker.execute_job',
            agent: 'agent-claim-a2',
            initials: 'A2',
            color: getAgentColor('A2'),
            intent: 'BODY_EDIT',
            chipLabel: 'A2 · BODY_EDIT',
            agentName: 'WorkerCoder'
          });
        }
      }
    }

    return map;
  }, [eventsUpToCurrent]);

  // Update claim chips overlay positions with vertical offset if multiple on same node
  const updateClaimChipPositions = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const chips: ClaimChipRender[] = [];
    const claims = Array.from(claimsByAgent.values());

    // Group by nodeId for vertical stacking
    const claimsByNode = new Map<string, PersistentClaim[]>();
    claims.forEach((c) => {
      const list = claimsByNode.get(c.nodeId) || [];
      list.push(c);
      claimsByNode.set(c.nodeId, list);
    });

    claimsByNode.forEach((nodeClaims, nid) => {
      const node = cy.getElementById(nid);
      if (node.length > 0 && !node.hasClass('hidden-node') && node.visible()) {
        const pos = node.renderedPosition();
        const outerH = node.renderedOuterHeight();
        nodeClaims.forEach((claim, indexOnNode) => {
          chips.push({
            id: `${claim.agentId}-${claim.nodeId}`,
            nodeId: claim.nodeId,
            chipLabel: claim.chipLabel,
            color: claim.color,
            intent: claim.intent,
            agentName: claim.agentName,
            x: pos.x,
            y: pos.y - outerH / 2 - 8 - indexOnNode * 26
          });
        });
      }
    });

    setClaimChips(chips);
  }, [claimsByAgent]);

  // Synchronize chip positions whenever claims change
  useEffect(() => {
    updateClaimChipPositions();
  }, [updateClaimChipPositions]);

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
        // Base Function Node in Focus: 44–56px, legible labels
        {
          selector: 'node',
          style: {
            'background-color': '#1E2633',
            'label': '',
            'color': '#F0F2F5',
            'font-size': 13,
            'font-family': 'Inter, system-ui, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': 'mapData(risk_score, 0, 1, 44, 56)',
            'height': 'mapData(risk_score, 0, 1, 44, 56)',
            'border-width': 2.5,
            'border-color': '#475467',
            'transition-property': 'background-color, border-color, border-width, opacity, width, height',
            'transition-duration': 0.3
          }
        },
        // Compound Module Container: 18px bold label
        {
          selector: 'node:parent',
          style: {
            'background-color': '#0B0E13',
            'background-opacity': 0.6,
            'border-width': 2,
            'border-color': '#2E3846',
            'border-style': 'dashed',
            'label': 'data(name)',
            'font-size': 18,
            'font-weight': 'bold',
            'font-family': 'Inter, system-ui, sans-serif',
            'color': '#A6AFBD',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': 10,
            'padding': '20px'
          }
        },
        // Visible labels on top 8 risk nodes or toggle
        {
          selector: 'node.show-label',
          style: {
            'label': 'data(name)',
            'color': '#F0F2F5',
            'font-size': 13,
            'font-weight': 600
          }
        },
        // Visible labels on focus mode nodes
        {
          selector: 'node.focus-node',
          style: {
            'label': 'data(name)',
            'color': '#F0F2F5',
            'font-size': 14,
            'font-weight': 600,
            'border-color': '#6B7A90',
            'border-width': 2.5,
            'background-color': '#1C2533'
          }
        },
        // Test Node
        {
          selector: 'node[label = "Test"]',
          style: {
            'shape': 'rectangle',
            'width': 24,
            'height': 24,
            'background-color': '#171D26',
            'border-color': '#6B7686',
            'border-width': 1.5,
            'color': '#8B949E',
            'font-size': 13
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
            'width': 2,
            'line-color': '#475467',
            'target-arrow-color': '#475467',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.0,
            'curve-style': 'bezier',
            'opacity': 0.85
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
        // Persistent Agent Halos (no !important)
        {
          selector: '.agent-claim-a1',
          style: {
            'border-color': '#5B8DEF',
            'border-width': 4,
            'background-color': '#13233A',
            'color': '#5B8DEF',
            'font-weight': 'bold'
          }
        },
        {
          selector: '.agent-claim-a2',
          style: {
            'border-color': '#E0A458',
            'border-width': 4,
            'background-color': '#2E2211',
            'color': '#E0A458',
            'font-weight': 'bold'
          }
        },
        {
          selector: '.agent-claim-a3',
          style: {
            'border-color': '#4FB286',
            'border-width': 4,
            'background-color': '#112E23',
            'color': '#4FB286',
            'font-weight': 'bold'
          }
        },
        {
          selector: '.agent-claim-a4',
          style: {
            'border-color': '#A58BE0',
            'border-width': 4,
            'background-color': '#211833',
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
        // Chain Node: 60px, 14px white with dark text-outline
        {
          selector: 'node.chain-node',
          style: {
            'width': 60,
            'height': 60,
            'label': 'data(name)',
            'color': '#FFFFFF',
            'font-size': 14,
            'font-weight': 'bold',
            'text-outline-color': '#0B0E13',
            'text-outline-width': 3,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'z-index': 1000
          }
        },
        // Faint Neighbor: 35% opacity sitting faintly above or below
        {
          selector: 'node.faint-neighbor',
          style: {
            'opacity': 0.35,
            'font-size': 13,
            'color': '#A6AFBD'
          }
        },
        // Active Collision Path: 60px in --breach (#D9534F)
        {
          selector: 'node.collision-breach-node, node.collision-hop-node',
          style: {
            'width': 60,
            'height': 60,
            'border-color': '#D9534F',
            'border-width': 4,
            'background-color': '#2B1417',
            'color': '#FFFFFF',
            'font-weight': 'bold',
            'text-outline-color': '#0B0E13',
            'text-outline-width': 3,
            'opacity': 1.0,
            'z-index': 1000
          }
        },
        {
          selector: 'edge.collision-breach-edge, edge.collision-hop-edge',
          style: {
            'line-color': '#D9534F',
            'target-arrow-color': '#D9534F',
            'width': 4,
            'opacity': 1.0,
            'z-index': 1000
          }
        },
        // Resolution: Fades to --signal (#E3A23B) at BLOCKED/HANDOFF
        {
          selector: 'node.resolved-signal-node',
          style: {
            'width': 56,
            'height': 56,
            'border-color': '#E3A23B',
            'border-width': 4,
            'background-color': '#2E2211',
            'color': '#FFFFFF',
            'font-weight': 'bold',
            'text-outline-color': '#0B0E13',
            'text-outline-width': 3,
            'label': 'data(name)',
            'opacity': 1.0,
            'z-index': 1000
          }
        },
        {
          selector: 'edge.resolved-signal-edge',
          style: {
            'line-color': '#E3A23B',
            'target-arrow-color': '#E3A23B',
            'width': 4,
            'opacity': 1.0,
            'z-index': 1000
          }
        },
        // Migrated & Verification: --clear (#3FA796)
        {
          selector: 'node.migrated-clear-node, node.resolved-clear-node',
          style: {
            'width': 56,
            'height': 56,
            'border-color': '#3FA796',
            'border-width': 4.5,
            'background-color': '#112E23',
            'color': '#FFFFFF',
            'font-weight': 'bold',
            'text-outline-color': '#0B0E13',
            'text-outline-width': 3,
            'label': 'data(name)',
            'opacity': 1.0,
            'z-index': 1000
          }
        },
        {
          selector: 'edge.resolved-clear-edge',
          style: {
            'line-color': '#3FA796',
            'target-arrow-color': '#3FA796',
            'width': 4,
            'opacity': 1.0,
            'z-index': 1000
          }
        },
        // Handoff Animated Edge
        {
          selector: 'edge.handoff-animated-edge',
          style: {
            'line-color': '#3FA796',
            'target-arrow-color': '#3FA796',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.2,
            'width': 3.5,
            'curve-style': 'unbundled-bezier',
            'control-point-distances': [-80],
            'control-point-weights': [0.5],
            'line-style': 'dashed',
            'label': 'HANDED OFF',
            'color': '#3FA796',
            'font-size': 13,
            'font-weight': 'bold',
            'text-background-color': '#0B0E13',
            'text-background-opacity': 0.9,
            'text-background-padding': '4px',
            'z-index': 2000
          }
        },
        // Non-chain edges during run (Requirement 6: 12% opacity and below the chain)
        {
          selector: 'edge.faint-edge',
          style: {
            'opacity': 0.12,
            'z-index': 1
          }
        },
        // Label collision avoidance: hide lower-priority overlapping label (Requirement 5)
        {
          selector: 'node.hide-label',
          style: {
            'label': ''
          }
        },
        // Scenario 3 Disjoint Subgraphs (Requirement 1)
        {
          selector: 'node.disjoint-neigh-a2',
          style: {
            'border-color': '#E0A458',
            'border-width': 3,
            'background-color': '#2E2211',
            'color': '#E0A458'
          }
        },
        {
          selector: 'node.disjoint-neigh-a3',
          style: {
            'border-color': '#4FB286',
            'border-width': 3,
            'background-color': '#112E23',
            'color': '#4FB286'
          }
        },
        // A1 Blast radius halo (Requirement 3)
        {
          selector: 'node.a1-blast-halo',
          style: {
            'border-color': '#5B8DEF',
            'border-width': 3.5,
            'background-color': '#13233A'
          }
        },
        // Selected Node & Callers
        {
          selector: '.selected-target',
          style: {
            'border-color': '#6EA8FE',
            'border-width': 4,
            'color': '#6EA8FE',
            'font-weight': 'bold'
          }
        },
        {
          selector: '.caller-hop-1',
          style: {
            'border-color': '#6EA8FE',
            'border-width': 2.5
          }
        },
        {
          selector: '.caller-hop-2',
          style: {
            'border-color': '#9AA4B2',
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

    // Label collision avoidance (Requirement 5: hide lower-priority overlapping label)
    const updateLabelCollisionAvoidance = () => {
      const isFocus = isFocusModeRef.current;
      const visibleParents = cy.nodes(':visible:parent');
      const visibleChain = cy.nodes(':visible.chain-node');
      const visibleFunctions = cy.nodes(':visible').not(':parent').not('.chain-node');

      const acceptedBoxes: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];

      const getLabelBox = (node: any) => {
        const bb = node.renderedBoundingBox({
          includeNodes: false,
          includeLabels: true,
          includeOverlays: false
        });
        if (bb && bb.w > 0 && bb.h > 0) {
          return { id: node.id(), x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 };
        }
        const rPos = node.renderedPosition();
        const rH = node.renderedHeight();
        const name = node.data('name') || node.id();
        const fs = parseFloat(node.renderedStyle('font-size')) || 13;
        const textW = Math.max(name.length * fs * 0.65, 40);
        const textH = fs * 1.25;
        const top = node.isParent() ? rPos.y - rH / 2 - textH - 4 : rPos.y + rH / 2 + 6;
        return {
          id: node.id(),
          x1: rPos.x - textW / 2,
          y1: top,
          x2: rPos.x + textW / 2,
          y2: top + textH
        };
      };

      const testOverlap = (cand: { x1: number; y1: number; x2: number; y2: number }) => {
        return acceptedBoxes.some((acc) => {
          return !(
            cand.x2 + 2 <= acc.x1 ||
            cand.x1 - 2 >= acc.x2 ||
            cand.y2 + 2 <= acc.y1 ||
            cand.y1 - 2 >= acc.y2
          );
        });
      };

      cy.batch(() => {
        cy.nodes().removeClass('hide-label');

        // 1. Chain nodes have highest priority
        visibleChain.forEach((n: any) => {
          acceptedBoxes.push(getLabelBox(n));
        });

        // 2. Parent modules
        visibleParents.forEach((n: any) => {
          const box = getLabelBox(n);
          if (!testOverlap(box)) {
            acceptedBoxes.push(box);
          } else {
            n.addClass('hide-label');
          }
        });

        // 3. Functions
        const candidateFunctions = isFocus
          ? visibleFunctions
          : visibleFunctions.filter((n: any) => top8NodeIds.has(n.id()) || showAllLabels);

        candidateFunctions.forEach((n: any) => {
          const box = getLabelBox(n);
          if (!testOverlap(box)) {
            acceptedBoxes.push(box);
          } else {
            n.addClass('hide-label');
          }
        });

        if (!isFocus) {
          visibleFunctions.forEach((n: any) => {
            if (!top8NodeIds.has(n.id()) && !showAllLabels) {
              n.addClass('hide-label');
            }
          });
        }
      });
    };

    // Dynamic on-screen label sizing so rendered font size is ALWAYS >= 13px and <= 16px (Requirement 5)
    const updateFontSizes = () => {
      const zoom = cy.zoom();
      if (!zoom || zoom <= 0) return;
      const baseFont = Math.min(16 / zoom, Math.max(13 / zoom, 13 / zoom));
      const chainFont = Math.min(16 / zoom, Math.max(13 / zoom, 14 / zoom));
      const parentFont = Math.min(16 / zoom, Math.max(13 / zoom, 16 / zoom));

      cy.batch(() => {
        cy.nodes(':visible').not('.chain-node').not(':parent').style('font-size', baseFont);
        cy.nodes(':visible:parent').style('font-size', parentFont);
        cy.nodes(':visible.chain-node').style({
          'font-size': chainFont,
          'color': '#FFFFFF',
          'text-outline-color': '#0B0E13',
          'text-outline-width': 3
        });
      });

      updateLabelCollisionAvoidance();
    };

    initialLayout.on('layoutstop', () => {
      if (!isFocusModeRef.current) {
        cy.fit(undefined, 60);
      }
      top8NodeIds.forEach((id) => cy.getElementById(id).addClass('show-label'));
      updateClaimChipPositions();
      updateFontSizes();
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

    // Synchronize chip positions & font sizes on pan, zoom, position, render
    cy.on('pan zoom position render', () => {
      updateClaimChipPositions();
      updateFontSizes();
    });

    cyRef.current = cy;
    (window as any).__chronoCy = cy;
    (window as any).__chronoIsFocusMode = () => isFocusModeRef.current;
    (window as any).__chronoUpdateFontSizes = updateFontSizes;
    (window as any).__chronoGetChainNodeIds = () => activeChainNodeIdsRef.current;
    (window as any).__chronoGetBreachSignalCount = () => {
      return cy.nodes('.collision-breach-node, .resolved-signal-node, .collision-hop-node').length;
    };
    (window as any).__chronoGetVisibleLabelBoxes = () => {
      const boxes: Array<{ id: string; label: string; box: any }> = [];
      cy.nodes(':visible').forEach((n: any) => {
        if (n.hasClass('hide-label')) return;
        const styleLabel = n.renderedStyle('label');
        if (!styleLabel) return;
        const bb = n.renderedBoundingBox({ includeLabels: true, includeNodes: false, includeOverlays: false });
        if (bb.w > 0 && bb.h > 0) {
          boxes.push({ id: n.id(), label: styleLabel, box: { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2, w: bb.w, h: bb.h } });
        }
      });
      return boxes;
    };

    return () => {
      cy.destroy();
      cyRef.current = null;
      delete (window as any).__chronoCy;
      delete (window as any).__chronoIsFocusMode;
      delete (window as any).__chronoUpdateFontSizes;
      delete (window as any).__chronoGetChainNodeIds;
      delete (window as any).__chronoGetBreachSignalCount;
      delete (window as any).__chronoGetVisibleLabelBoxes;
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
        } else {
          const currentChainIds = activeChainNodeIdsRef.current;
          const chainNodes = cyRef.current.nodes().filter((n) => currentChainIds.includes(n.id()));
          const visibleNeighbors = cyRef.current.nodes('.faint-neighbor');
          const fitElements = chainNodes.union(visibleNeighbors);
          if (fitElements.length > 0) {
            cyRef.current.fit(fitElements, 120);
            const cyH = cyRef.current.height() || 788;
            const targetY = Math.round(cyH * 0.62);
            cyRef.current.panBy({ x: 0, y: Math.round(targetY - (cyH / 2)) });
          } else {
            const visibleNodes = cyRef.current.nodes().not('.hidden-node').not(':parent');
            if (visibleNodes.length > 0) {
              cyRef.current.fit(visibleNodes, 120);
              cyRef.current.panBy({ x: 0, y: -20 });
            }
          }
        }
        updateClaimChipPositions();
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateClaimChipPositions]);

  // Synchronize label display on nodes for top8 and showAllLabels toggle
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (showAllLabels) {
      cy.nodes().addClass('show-label');
    } else {
      cy.nodes().removeClass('show-label');
      top8NodeIds.forEach((id) => cy.getElementById(id).addClass('show-label'));
    }
  }, [showAllLabels, top8NodeIds]);

  // Focus Mode & Dynamic State updates during a run
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const claims = Array.from(claimsByAgent.values());
    const claimedIdsList = claims.map((c) => c.nodeId).sort().join(',');
    const hasActiveClaims = claims.length > 0;
    const isRunActive = activeEvent !== null && activeEvent.phase !== 'IDLE' && hasActiveClaims;

    if (!hasActiveClaims || events.length === 0) {
      lastLaidOutClaimIdsRef.current = '';
    }

    // Dynamic chain extraction from events up to current index (Requirement 1 & Requirement 3)
    const eventsUpToNow = events.slice(
      0,
      (activeEvent
        ? (events.findIndex((e) => e.index === activeEvent.index) >= 0
            ? events.findIndex((e) => e.index === activeEvent.index)
            : activeEvent.index)
        : events.length - 1) + 1
    );

    const latestCollisionEvent = [...eventsUpToNow]
      .reverse()
      .find(
        (e) =>
          e.collision &&
          Array.isArray(e.collision.path_nodes) &&
          e.collision.path_nodes.length > 0
      );

    let chainNodeIds: string[] = [];
    let isBlastRadius = false;

    if (latestCollisionEvent?.collision?.path_nodes) {
      chainNodeIds = latestCollisionEvent.collision.path_nodes;
    } else {
      // Requirement 3: At FORK_SIMULATION event before collision in Scenario 1,
      // use reverse-CALLS blast radius of A1's claimed symbol
      const forkEvent = eventsUpToNow.find((e) => e.phase === 'FORK_SIMULATION');
      if (forkEvent && currentScenario === 1) {
        const a1Claim = claims.find((c) => c.agentId === 'A1');
        const startNodeId = a1Claim?.nodeId || 'taskflow.config.load_config';
        const startNode = cy.getElementById(startNodeId);
        if (startNode.length > 0) {
          const revChain: string[] = [startNodeId];
          let curr: any = startNode;
          for (let hop = 0; hop < 4; hop++) {
            const callers = curr.incomers('edge[type = "CALLS"]').sources();
            if (callers.length === 0) break;
            const next: any = callers[0];
            revChain.unshift(next.id());
            curr = next;
          }
          chainNodeIds = revChain;
        } else {
          chainNodeIds = [startNodeId];
        }
        isBlastRadius = true;
      }
    }

    activeChainNodeIdsRef.current = chainNodeIds;
    const hasCollision = Boolean(latestCollisionEvent);

    if (isRunActive) {
      isFocusModeRef.current = true;
      const claimedIds = claims.map((c) => c.nodeId);
      const visibleIds = new Set<string>(claimedIds);

      if (chainNodeIds.length > 0) {
        // Keep entire chain visible
        chainNodeIds.forEach((nid) => visibleIds.add(nid));

        // Add 1-hop reverse callers / forward callees of the chain nodes
        chainNodeIds.forEach((nid) => {
          const n = cy.getElementById(nid);
          if (n.length > 0) {
            n.incomers('edge[type = "CALLS"]').sources().forEach((src) => {
              visibleIds.add(src.id());
            });
            n.outgoers('edge[type = "CALLS"]').targets().forEach((tgt) => {
              visibleIds.add(tgt.id());
            });
          }
        });

        // Add parent module containers
        chainNodeIds.forEach((nid) => {
          const n = cy.getElementById(nid);
          const p = n.data('parent');
          if (p) visibleIds.add(p);
        });
      } else if (currentScenario === 3) {
        // Requirement 1: Scenario 3: show two disjoint neighborhoods (4-hop call neighborhood of each claimed symbol)
        // one in A2's color and one in A3's color, separated by a visible gap and NO connecting highlight
        const a2Claim = claims.find((c) => c.agentId === 'A2');
        const a3Claim = claims.find((c) => c.agentId === 'A3');

        const get4HopNeighborhood = (startId?: string) => {
          const res = new Set<string>();
          if (!startId) return res;
          res.add(startId);
          let frontier = new Set<string>([startId]);
          for (let hop = 0; hop < 4; hop++) {
            const nextFrontier = new Set<string>();
            frontier.forEach((nid) => {
              const node = cy.getElementById(nid);
              if (node.length > 0) {
                node.outgoers('edge[type = "CALLS"]').targets().forEach((t) => {
                  if (!res.has(t.id())) {
                    res.add(t.id());
                    nextFrontier.add(t.id());
                  }
                });
                node.incomers('edge[type = "CALLS"]').sources().forEach((s) => {
                  if (!res.has(s.id())) {
                    res.add(s.id());
                    nextFrontier.add(s.id());
                  }
                });
              }
            });
            frontier = nextFrontier;
          }
          return res;
        };

        const neighA2 = get4HopNeighborhood(a2Claim?.nodeId || 'taskflow.worker.execute_job');
        const neighA3 = get4HopNeighborhood(a3Claim?.nodeId || 'taskflow.reports.generator.generate_summary');

        neighA2.forEach((id) => visibleIds.add(id));
        neighA3.forEach((id) => visibleIds.add(id));

        // Add parent module containers
        visibleIds.forEach((nid) => {
          const node = cy.getElementById(nid);
          const parentId = node.data('parent');
          if (parentId) visibleIds.add(parentId);
        });
      } else {
        // Scenario 2 (or other non-collision scenarios):
        // Show claimed symbols + 2-hop neighborhood + parent modules
        claimedIds.forEach((nid) => {
          const n = cy.getElementById(nid);
          if (n.length > 0) {
            n.incomers('edge[type = "CALLS"]').sources().forEach((src) => {
              visibleIds.add(src.id());
            });
            n.outgoers('edge[type = "CALLS"]').targets().forEach((tgt) => {
              visibleIds.add(tgt.id());
            });
          }
        });
        visibleIds.forEach((nid) => {
          const node = cy.getElementById(nid);
          const parentId = node.data('parent');
          if (parentId) visibleIds.add(parentId);
        });
      }

      // Hide non-visible nodes
      cy.nodes().forEach((n) => {
        if (visibleIds.has(n.id())) {
          n.removeClass('hidden-node');
          if (!n.isParent()) n.addClass('focus-node');
        } else {
          n.addClass('hidden-node');
          n.removeClass('focus-node');
        }
      });

      // Layout management:
      if (chainNodeIds.length > 0) {
        // Requirement 4 & 5: Chain baseline at ~62% of canvas height, equal spacing ~220px
        const cyHeight = cy.height() || 788;
        const CHAIN_Y = Math.round(cyHeight * 0.62); // ~488px
        const CHAIN_X_START = 160;
        const CHAIN_SPACING = 220;

        chainNodeIds.forEach((nid, i) => {
          const node = cy.getElementById(nid);
          if (node.length > 0) {
            node.addClass('chain-node');
            node.position({
              x: CHAIN_X_START + i * CHAIN_SPACING,
              y: CHAIN_Y
            });
          }
        });

        // Other visible nodes sit faintly above/below
        const visibleNonChain = cy.nodes(':visible').not('.chain-node').not(':parent');
        visibleNonChain.forEach((n, idx) => {
          n.addClass('faint-neighbor');
          const isAbove = idx % 2 === 0;
          const anchorIndex = idx % chainNodeIds.length;
          n.position({
            x: CHAIN_X_START + anchorIndex * CHAIN_SPACING,
            y: isAbove ? CHAIN_Y - 150 : CHAIN_Y + 150
          });
        });

        const chainNodes = cy.nodes().filter((n) => chainNodeIds.includes(n.id()));
        const visibleNeighbors = cy.nodes('.faint-neighbor');
        const fitElements = chainNodes.union(visibleNeighbors);
        if (fitElements.length > 0) {
          cy.fit(fitElements, 120);
          const panOffsetY = Math.round(CHAIN_Y - (cyHeight / 2));
          cy.panBy({ x: 0, y: panOffsetY });
        }
        updateClaimChipPositions();
        if ((window as any).__chronoUpdateFontSizes) {
          (window as any).__chronoUpdateFontSizes();
        }
      } else if (currentScenario === 3) {
        // Scenario 3: two disjoint neighborhoods separated by visible gap
        const neighA2Nodes = cy.nodes().filter((n) => {
          const id = n.id();
          return id.includes('worker') || id.includes('queue') || id.includes('auth') || id.includes('database') || id.includes('config');
        }).not(':parent');

        const neighA3Nodes = cy.nodes().filter((n) => {
          const id = n.id();
          return id.includes('report') || id.includes('generator') || id.includes('summary');
        }).not(':parent');

        // Position A2 cluster on the left centered around x = 320
        neighA2Nodes.forEach((n, idx) => {
          n.addClass('disjoint-neigh-a2');
          n.position({
            x: 220 + (idx % 3) * 110,
            y: 280 + Math.floor(idx / 3) * 120
          });
        });

        // Position A3 cluster on the right centered around x = 880
        neighA3Nodes.forEach((n, idx) => {
          n.addClass('disjoint-neigh-a3');
          n.position({
            x: 780 + (idx % 3) * 110,
            y: 280 + Math.floor(idx / 3) * 120
          });
        });

        const visibleNodes = cy.nodes().not('.hidden-node').not(':parent');
        if (visibleNodes.length > 0) {
          cy.fit(visibleNodes, 100);
          cy.panBy({ x: 0, y: -20 });
        }
        updateClaimChipPositions();
        if ((window as any).__chronoUpdateFontSizes) {
          (window as any).__chronoUpdateFontSizes();
        }
      } else {
        // Scenario 2 / other layout
        if (lastLaidOutClaimIdsRef.current !== claimedIdsList) {
          lastLaidOutClaimIdsRef.current = claimedIdsList;
          const visibleNodes = cy.nodes().not('.hidden-node');
          const visibleEdges = visibleNodes.connectedEdges().filter(
            (e: any) => visibleNodes.contains(e.source()) && visibleNodes.contains(e.target())
          );
          const layoutEles = visibleNodes.union(visibleEdges);

          const focusLayout = layoutEles.layout({
            name: 'dagre',
            rankDir: 'LR',
            nodeSep: 60,
            rankSep: 140,
            animate: !prefersReducedMotion.current,
            animationDuration: 300,
            padding: 80
          } as any);

          focusLayout.on('layoutstop', () => {
            cy.fit(visibleNodes, 120);
            cy.panBy({ x: 0, y: -20 });
            updateClaimChipPositions();
            if ((window as any).__chronoUpdateFontSizes) {
              (window as any).__chronoUpdateFontSizes();
            }
          });

          focusLayout.run();
        } else {
          updateClaimChipPositions();
        }
      }
    } else if (!isRunActive && isFocusModeRef.current) {
      isFocusModeRef.current = false;
      lastLaidOutClaimIdsRef.current = '';
      cy.nodes().removeClass('hidden-node chain-node faint-neighbor disjoint-neigh-a2 disjoint-neigh-a3 a1-blast-halo');
      cy.edges().removeClass('faint-edge');
      cy.fit(undefined, 60);
      updateClaimChipPositions();
      if ((window as any).__chronoUpdateFontSizes) {
        (window as any).__chronoUpdateFontSizes();
      }
    }

    // Apply persistent halos across claimed nodes
    claimsByAgent.forEach((claim) => {
      const node = cy.getElementById(claim.nodeId);
      if (node.length > 0 && !node.hasClass(claim.agent)) {
        node.addClass(claim.agent);
      }
    });

    // Clear transient phase classes
    cy.elements().removeClass(
      'dimmed collision-hop-node collision-hop-edge collision-breach-node collision-breach-edge ' +
      'resolved-signal-node resolved-signal-edge migrated-clear-node resolved-clear-node resolved-clear-edge'
    );
    setHopCountBadge(null);

    // Requirement 6: Non-chain edges at 12% opacity and below the chain
    if (chainNodeIds.length > 0) {
      cy.edges().forEach((edge: any) => {
        const sId = edge.source().id();
        const tId = edge.target().id();
        const isChain = chainNodeIds.some((id, idx) => {
          if (idx === chainNodeIds.length - 1) return false;
          const next = chainNodeIds[idx + 1];
          return (sId === id && tId === next) || (sId === next && tId === id);
        });
        if (isChain || edge.id() === 'handoff-edge') {
          edge.removeClass('faint-edge');
        } else {
          edge.addClass('faint-edge');
        }
      });
    } else {
      cy.edges().removeClass('faint-edge');
    }

    // Recolor by phase (Requirement 1 & 4)
    if (hasCollision && chainNodeIds.length > 0) {
      const isVerification =
        activeEvent?.phase === 'VERIFICATION' ||
        activeEvent?.phase === 'MEMORY_UPDATE' ||
        eventsUpToNow.some((e) => e.phase === 'VERIFICATION');

      const isCollisionPhase =
        activeEvent?.phase === 'COLLISION_DETECTION' || activeEvent?.phase === 'GIT_COMPARISON';

      const isResolveBlockedPhase =
        activeEvent?.phase === 'RESOLUTION' || activeEvent?.phase === 'BLOCKED';

      const isPatchHandoffPhase =
        activeEvent?.phase === 'IMPACT_ANALYSIS' ||
        activeEvent?.phase === 'CODE_GEN' ||
        activeEvent?.phase === 'HANDOFF';

      if (isCollisionPhase) {
        chainNodeIds.forEach((nid, i) => {
          const node = cy.getElementById(nid);
          if (node.length > 0) node.addClass('collision-breach-node');
          if (i < chainNodeIds.length - 1) {
            const nextId = chainNodeIds[i + 1];
            const edge = cy.edges(`[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`);
            if (edge.length > 0) edge.addClass('collision-breach-edge');
          }
        });
      } else if (isResolveBlockedPhase) {
        chainNodeIds.forEach((nid, i) => {
          const node = cy.getElementById(nid);
          if (node.length > 0) node.addClass('resolved-signal-node');
          if (i < chainNodeIds.length - 1) {
            const nextId = chainNodeIds[i + 1];
            const edge = cy.edges(`[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`);
            if (edge.length > 0) edge.addClass('resolved-signal-edge');
          }
        });
      } else if (isPatchHandoffPhase && !isVerification) {
        const migrated = new Set<string>();
        for (const e of eventsUpToNow) {
          if (e.phase === 'IMPACT_ANALYSIS' || e.phase === 'CODE_GEN' || e.phase === 'PATCH') {
            if (e.node_ids) e.node_ids.forEach((id) => migrated.add(id));
            if (e.execution_data?.target) migrated.add(e.execution_data.target);
          }
        }
        chainNodeIds.forEach((nid, i) => {
          const node = cy.getElementById(nid);
          if (node.length > 0) {
            if (migrated.has(nid) || (activeEvent?.phase === 'HANDOFF' && (nid.includes('config') || nid.includes('database')))) {
              node.addClass('migrated-clear-node');
            } else {
              node.addClass('resolved-signal-node');
            }
          }
          if (i < chainNodeIds.length - 1) {
            const nextId = chainNodeIds[i + 1];
            const edge = cy.edges(`[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`);
            if (edge.length > 0) edge.addClass('resolved-signal-edge');
          }
        });
      } else if (isVerification) {
        chainNodeIds.forEach((nid, i) => {
          const node = cy.getElementById(nid);
          if (node.length > 0) node.addClass('migrated-clear-node');
          if (i < chainNodeIds.length - 1) {
            const nextId = chainNodeIds[i + 1];
            const edge = cy.edges(`[source = "${nid}"][target = "${nextId}"], [source = "${nextId}"][target = "${nid}"]`);
            if (edge.length > 0) edge.addClass('resolved-clear-edge');
          }
        });
      }
    } else if (isBlastRadius && chainNodeIds.length > 0) {
      // Requirement 3: A1 blast radius halo before collision
      chainNodeIds.forEach((nid) => {
        const node = cy.getElementById(nid);
        if (node.length > 0) node.addClass('a1-blast-halo');
      });
    }

    // HANDOFF animated arrow & DOM overlay position
    if (activeEvent?.phase === 'HANDOFF') {
      const a1Node = cy.getElementById('taskflow.config.load_config');
      const a2Node = cy.getElementById('taskflow.worker.execute_job');
      if (a1Node.length > 0 && a2Node.length > 0) {
        const p1 = a1Node.renderedPosition();
        const p2 = a2Node.renderedPosition();
        setHandoffPos({
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2 - 45
        });
      }
      let handoffEdge = cy.getElementById('handoff-edge');
      if (handoffEdge.length === 0) {
        handoffEdge = cy.add({
          group: 'edges',
          data: {
            id: 'handoff-edge',
            source: 'taskflow.config.load_config',
            target: 'taskflow.worker.execute_job',
            label: 'HANDED OFF'
          },
          classes: 'handoff-animated-edge'
        });
        handoffEdge.style({ opacity: 0 });
        handoffEdge.animate(
          { style: { opacity: 1 } },
          { duration: prefersReducedMotion.current ? 0 : 400 }
        );
      }
    } else {
      setHandoffPos(null);
      const handoffEdge = cy.getElementById('handoff-edge');
      if (handoffEdge.length > 0) {
        handoffEdge.remove();
      }
    }

    updateClaimChipPositions();
    if ((window as any).__chronoUpdateFontSizes) {
      (window as any).__chronoUpdateFontSizes();
    }
  }, [activeEvent, events, claimsByAgent, updateClaimChipPositions]);

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
      <div ref={containerRef} id="chrono-cy-container" className="w-full h-full" />

      {/* HTML Overlay for Persistent Claim Chips */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {claimChips.map((chip) => (
          <div
            key={chip.id || chip.nodeId}
            className="cf-claim-chip absolute transition-all duration-200 -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-[4px] font-mono text-[13px] font-bold border shadow-lg bg-[var(--bg-1)] whitespace-nowrap"
            style={{
              left: chip.x,
              top: chip.y,
              borderColor: chip.color,
              color: chip.color
            }}
            title={chip.agentName ? `${chip.agentName} (${chip.intent})` : undefined}
          >
            {chip.chipLabel}
          </div>
        ))}

        {/* HANDOFF DOM Overlay Badge (Requirement 6) */}
        {activeEvent?.phase === 'HANDOFF' && handoffPos && (
          <div
            className="cf-handoff-overlay absolute px-2.5 py-1 rounded-[4px] bg-[var(--bg-0)] border border-[var(--clear)] text-[var(--clear)] font-mono text-[13px] font-bold shadow-xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: handoffPos.x,
              top: handoffPos.y
            }}
          >
            HANDED OFF
          </div>
        )}
      </div>

      {/* Hop Counter Badge during Collision (below docked 360px hero bar) */}
      {hopCountBadge !== null && (
        <div className="absolute top-16 left-6 z-20 px-3 py-1.5 rounded-[6px] border border-[var(--breach)] bg-[var(--bg-1)] font-mono text-[13px] font-bold text-[var(--breach)] shadow-md">
          CHAIN: {hopCountBadge} HOPS
        </div>
      )}

      {/* Quiet Legend Bottom-Left with visible --text-dim swatch outlines */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 px-3 py-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)] font-mono text-[13px] text-[var(--text-dim)] shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[2px] border border-dashed border-[var(--text-dim)] bg-[var(--bg-0)]" />
          <span>Module</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--bg-2)] border border-[var(--text-dim)]" />
          <span>Function</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--bg-2)] border border-[var(--text-dim)]" />
          <span>Test</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[var(--text-dim)]" />
          <span>CALLS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 border-t border-dashed border-[var(--text-dim)] opacity-80" />
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
