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

  // Dotted qualname shape: identifiers separated by dots, not matching file extensions
  // File names ending in .py, .md, .json, .yml, .txt or paths render as plain mono text
  const tokens = React.useMemo(() => {
    // Match either file names/paths or dotted qualnames
    const regex = /([a-zA-Z0-9_\-\/\\]+\.(?:py|md|json|yml|yaml|txt)|[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)/g;
    const parts: Array<{ type: 'text' | 'file' | 'symbol'; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const fileExtRegex = /\.(?:py|md|json|yml|yaml|txt)$/i;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          value: text.substring(lastIndex, match.index)
        });
      }

      const val = match[0];
      if (fileExtRegex.test(val) || val.includes('/') || val.includes('\\')) {
        parts.push({
          type: 'file',
          value: val
        });
      } else {
        parts.push({
          type: 'symbol',
          value: val
        });
      }
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
        if (part.type === 'file') {
          return (
            <span key={idx} className="font-mono text-[13px] text-[var(--text-dim)]">
              {part.value}
            </span>
          );
        }
        if (part.type === 'symbol') {
          const isVerified = knownNodes.has(part.value);
          if (isVerified) {
            return (
              <SymbolChip
                key={idx}
                qualname={part.value}
                isVerified={true}
                onSelectNode={onSelectNode}
              />
            );
          }
          // If not in graph, render as plain text or unknown chip if dotted qualname
          return (
            <span key={idx} className="font-mono text-[13px] text-[var(--text-dim)]">
              {part.value}
            </span>
          );
        }
        return <span key={idx}>{part.value}</span>;
      })}
    </span>
  );
};
