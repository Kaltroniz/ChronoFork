import React, { useState } from 'react';
import { SwarmEvent } from '../types';
import { getTrace, getCollision } from '../adapters/events';
import { Copy, ExternalLink, HelpCircle, Check, Database, Clock, List } from 'lucide-react';

interface QueryInspectorProps {
  activeEvent: SwarmEvent | null;
}

// Lightweight Cypher tokenizer
const highlightCypher = (cypher: string): React.ReactNode => {
  if (!cypher) return null;

  // Regex tokens for Cypher
  const tokenRegex =
    /('(?:\\'|[^'])*'|"(?:\\"|[^"])*")|(\$[a-zA-Z0-9_]+)|(:[a-zA-Z0-9_]+)|(\b(?:MATCH|OPTIONAL|WHERE|RETURN|WITH|MERGE|SET|DELETE|REMOVE|CALL|YIELD|ORDER BY|BY|DESC|ASC|DISTINCT|AS|IN|AND|OR|NOT|COUNT|COLLECT|LENGTH|NODES|RELATIONSHIPS|COALESCE|TIMESTAMP|SHORTESTPATH)\b)/gi;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(cypher)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <span key={`txt-${lastIndex}`} className="text-[var(--text)]">
          {cypher.substring(lastIndex, match.index)}
        </span>
      );
    }

    const [fullMatch, strToken, paramToken, labelToken, keywordToken] = match;

    if (strToken) {
      elements.push(
        <span key={`str-${match.index}`} style={{ color: 'var(--signal)' }}>
          {strToken}
        </span>
      );
    } else if (paramToken) {
      elements.push(
        <span key={`prm-${match.index}`} style={{ color: 'var(--text-dim)' }}>
          {paramToken}
        </span>
      );
    } else if (labelToken) {
      elements.push(
        <span key={`lbl-${match.index}`} style={{ color: 'var(--clear)' }}>
          {labelToken}
        </span>
      );
    } else if (keywordToken) {
      elements.push(
        <span key={`kw-${match.index}`} className="font-bold" style={{ color: 'var(--accent)' }}>
          {keywordToken.toUpperCase()}
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < cypher.length) {
    elements.push(
      <span key={`txt-${lastIndex}`} className="text-[var(--text)]">
        {cypher.substring(lastIndex)}
      </span>
    );
  }

  return elements;
};

export const QueryInspector: React.FC<QueryInspectorProps> = ({ activeEvent }) => {
  const [activeTab, setActiveTab] = useState<'query' | 'params' | 'rows'>('query');
  const [copied, setCopied] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const trace = getTrace(activeEvent);
  const collision = getCollision(activeEvent);

  const handleCopyQuery = () => {
    if (!trace?.cypher) return;
    navigator.clipboard.writeText(trace.cypher);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBrowser = () => {
    if (trace?.cypher) {
      navigator.clipboard.writeText(trace.cypher);
    }
    const host = window.location.hostname || 'localhost';
    window.open(`http://${host}:3000`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-1)] border-t border-[var(--line)] overflow-hidden select-none">
      {/* Row 1: Graph key · duration (1 decimal) · rows as non-wrapping chips */}
      <div className="px-3 py-1.5 bg-[var(--bg-0)] border-b border-[var(--line)] flex items-center gap-2 overflow-x-auto whitespace-nowrap text-[13px] font-mono shrink-0">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[var(--bg-2)] border border-[var(--line)] text-[var(--accent)] shrink-0 font-medium">
          <Database className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{trace?.graph || 'graph:taskflow'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[var(--bg-2)] border border-[var(--line)] text-[var(--signal)] shrink-0 font-medium">
          <Clock className="w-3.5 h-3.5 text-[var(--signal)]" />
          <span>{trace?.duration_ms !== undefined ? `${trace.duration_ms.toFixed(1)}ms` : '— ms'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[var(--bg-2)] border border-[var(--line)] text-[var(--clear)] shrink-0 font-medium">
          <List className="w-3.5 h-3.5 text-[var(--clear)]" />
          <span>
            {trace?.row_count !== undefined
              ? `${trace.row_count} rows`
              : `${trace?.rows?.length ?? 0} rows`}
          </span>
        </span>
      </div>

      {/* Row 2: Tabs (left) & Action Icon Buttons with tooltips (right) */}
      <div className="h-[40px] px-3 bg-[var(--bg-1)] border-b border-[var(--line)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 font-mono text-[13px]">
          <button
            onClick={() => setActiveTab('query')}
            className={`px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
              activeTab === 'query'
                ? 'bg-[var(--bg-2)] text-[var(--accent)] font-semibold border border-[var(--line)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Query
          </button>
          <button
            onClick={() => setActiveTab('params')}
            className={`px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
              activeTab === 'params'
                ? 'bg-[var(--bg-2)] text-[var(--accent)] font-semibold border border-[var(--line)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Params
          </button>
          <button
            onClick={() => setActiveTab('rows')}
            className={`px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
              activeTab === 'rows'
                ? 'bg-[var(--bg-2)] text-[var(--accent)] font-semibold border border-[var(--line)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Rows
          </button>
        </div>

        {/* Icon Action Buttons Right with Tooltips */}
        <div className="flex items-center gap-1.5 shrink-0">
          {trace?.cypher && (
            <>
              <button
                onClick={handleCopyQuery}
                className="p-1.5 rounded-[6px] text-[13px] font-mono border border-[var(--line)] bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
                title={copied ? 'Copied query to clipboard' : 'Copy openCypher query'}
                aria-label="Copy query"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[var(--clear)]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleOpenBrowser}
                className="p-1.5 rounded-[6px] text-[13px] font-mono border border-[var(--line)] bg-[var(--bg-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
                title="Open in FalkorDB Browser (localhost:3000)"
                aria-label="Open in FalkorDB Browser"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </>
          )}

          {collision && (
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="p-1.5 rounded-[6px] text-[13px] font-mono border border-[var(--line)] bg-[var(--bg-2)] text-[var(--signal)] hover:text-[var(--text)] transition-colors cursor-pointer"
              title="Explain collision decision"
              aria-label="Explain collision"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Explanation Modal / Dropdown */}
      {showExplanation && collision && (
        <div className="p-4 bg-[var(--bg-2)] border-b border-[var(--line)] text-[13px] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-eyebrow text-[var(--breach)]">Stepped Decision Explanation</span>
            <button
              onClick={() => setShowExplanation(false)}
              className="text-[var(--text-dim)] hover:text-[var(--text)] text-[13px] cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="font-mono text-[var(--text)]">
            Policy: <span className="font-bold text-[var(--breach)]">{collision.policy}</span>
            {collision.risk_score !== undefined && (
              <span className="ml-3 text-[var(--text-dim)]">
                (Risk score: {collision.risk_score.toFixed(3)})
              </span>
            )}
          </div>
          <p className="text-[var(--text-dim)] leading-relaxed">
            {collision.reason ||
              'Transitive dependency chain detected between concurrently claimed symbols.'}
          </p>
        </div>
      )}

      {/* Body Content */}
      <div className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed select-text">
        {!trace ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-faint)]">
            <span>no query for this step</span>
          </div>
        ) : activeTab === 'query' ? (
          <pre className="whitespace-pre-wrap font-mono">{highlightCypher(trace.cypher)}</pre>
        ) : activeTab === 'params' ? (
          trace.params && Object.keys(trace.params).length > 0 ? (
            <pre className="text-[var(--text-dim)] whitespace-pre-wrap">
              {JSON.stringify(trace.params, null, 2)}
            </pre>
          ) : (
            <div className="text-[var(--text-faint)]">No query parameters provided for this step.</div>
          )
        ) : (
          <div>
            {trace.rows && trace.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-eyebrow">
                      {trace.header ? (
                        trace.header.map((col, idx) => (
                          <th key={idx} className="pb-2 pr-4 font-semibold">
                            {Array.isArray(col) ? col[1] : String(col)}
                          </th>
                        ))
                      ) : (
                        <th className="pb-2 pr-4 font-semibold">Result</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {trace.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[var(--bg-2)] transition-colors">
                        {Array.isArray(row) ? (
                          row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="py-1.5 pr-4 text-[var(--text)] whitespace-nowrap"
                            >
                              {typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}
                            </td>
                          ))
                        ) : (
                          <td className="py-1.5 pr-4 text-[var(--text)]">{String(row)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-[var(--text-faint)]">0 rows returned from this query.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
