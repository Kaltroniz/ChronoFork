import React from 'react';
import { GraphData } from '../types';

interface SymbolChipProps {
  qualname: string;
  isVerified: boolean;
  onSelectNode?: (nodeId: string) => void;
}

export const SymbolChip: React.FC<SymbolChipProps> = ({ qualname, isVerified, onSelectNode }) => {
  if (isVerified) {
    return (
      <button
        type="button"
        onClick={() => onSelectNode && onSelectNode(qualname)}
        className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] font-mono text-[13px] border border-[var(--line)] bg-[var(--bg-2)] text-[var(--accent)] hover:border-[var(--accent)] transition-colors cursor-pointer select-none"
        title={`Graph Symbol: ${qualname}`}
      >
        {qualname}
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] font-mono text-[13px] border border-[var(--line)] bg-[var(--bg-2)] text-[var(--signal)] cursor-help select-none"
      title="not found in graph"
    >
      ⟨?{qualname}⟩
    </span>
  );
};

interface VerifiedTextProps {
  text: string;
  graphData: GraphData | null;
  onSelectNode?: (nodeId: string) => void;
}

export const VerifiedText: React.FC<VerifiedTextProps> = ({ text, graphData, onSelectNode }) => {
  if (!text) return null;

  // Set of known qualnames / ids from graph
  const knownNodes = React.useMemo(() => {
    const set = new Set<string>();
    if (graphData?.nodes) {
      for (const n of graphData.nodes) {
        if (n.data.id) set.add(n.data.id);
        if (n.data.name) set.add(n.data.name);
      }
    }
    return set;
  }, [graphData]);

  // Regex looking for dotted symbol names, e.g. taskflow.config.load_config or module.func
  // or filenames like config.py
  const tokens = React.useMemo(() => {
    const regex = /([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+(?:\.py)?|[a-zA-Z_][a-zA-Z0-9_]*\.py)/g;
    const parts: Array<{ type: 'text' | 'symbol'; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          value: text.substring(lastIndex, match.index)
        });
      }
      parts.push({
        type: 'symbol',
        value: match[0]
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        value: text.substring(lastIndex)
      });
    }

    return parts;
  }, [text]);

  return (
    <span>
      {tokens.map((part, idx) => {
        if (part.type === 'symbol') {
          const isVerified = knownNodes.has(part.value);
          return (
            <SymbolChip
              key={idx}
              qualname={part.value}
              isVerified={isVerified}
              onSelectNode={onSelectNode}
            />
          );
        }
        return <span key={idx}>{part.value}</span>;
      })}
    </span>
  );
};
