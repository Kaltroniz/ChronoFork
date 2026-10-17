"""FalkorDB Client Wrapper with Full Query Tracing and Cloud Credentials Support."""
import os
import time
from typing import List, Dict, Any, Optional
from falkordb import FalkorDB, Graph


class FalkorClient:
    """Manages multigraph operations on FalkorDB with real execution tracing."""

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        ssl: Optional[bool] = None,
    ):
        self.host = host or os.getenv("FALKORDB_HOST", "127.0.0.1")
        self.port = port or int(os.getenv("FALKORDB_PORT", "6379"))
        self.username = username or os.getenv("FALKORDB_USERNAME", None)
        self.password = password or os.getenv("FALKORDB_PASSWORD", None)
        
        ssl_env = os.getenv("FALKORDB_SSL", "false").lower() in ("true", "1", "yes")
        self.ssl = ssl if ssl is not None else ssl_env

        conn_kwargs: Dict[str, Any] = {"host": self.host, "port": self.port}
        if self.password:
            conn_kwargs["password"] = self.password
        if self.username:
            conn_kwargs["username"] = self.username
        if self.ssl:
            conn_kwargs["ssl"] = True

        self.db = FalkorDB(**conn_kwargs)
        self.last_trace: Optional[Dict[str, Any]] = None
        self._tool_traces: Dict[str, Dict[str, Any]] = {}

    def list_graphs(self) -> List[str]:
        """Lists all active graph keys."""
        return self.db.list_graphs()

    def get_graph(self, name: str) -> Graph:
        """Selects an existing or new graph by name."""
        return self.db.select_graph(name)

    def delete_graph(self, name: str) -> bool:
        """Permanently deletes a graph key if present."""
        try:
            graphs = self.list_graphs()
            if name in graphs:
                g = self.db.select_graph(name)
                g.delete()
                return True
            return False
        except Exception:
            return False

    def copy_graph(self, src_name: str, dest_name: str) -> Graph:
        """
        Creates a speculative or coordination clone of src_name under dest_name.
        Guarantees destination is deleted before copying to prevent ResponseError.
        """
        self.delete_graph(dest_name)
        src_graph = self.get_graph(src_name)
        return src_graph.copy(dest_name)

        self._tool_traces: Dict[str, Dict[str, Any]] = {}
        self.last_trace: Optional[Dict[str, Any]] = None

    def query(
        self,
        graph_name: str,
        cypher: str,
        params: Optional[Dict[str, Any]] = None,
        tool: Optional[str] = None
    ) -> Any:
        """
        Executes Cypher query on specified graph with microsecond timing and full trace recording.
        Returns: (res, t_ms)
        Records the query trace keyed by tool name.
        """
        g = self.get_graph(graph_name)
        query_params = params or {}
        t0 = time.perf_counter()
        res = g.query(cypher, query_params)
        t_ms = (time.perf_counter() - t0) * 1000

        # Build clean serialized row preview for frontend trace inspector
        rows_preview = []
        if hasattr(res, "result_set") and res.result_set:
            for row in res.result_set[:10]:
                clean_row = []
                for cell in row:
                    if hasattr(cell, "properties"):
                        clean_row.append(cell.properties)
                    elif hasattr(cell, "labels"):
                        clean_row.append({"labels": list(cell.labels), "props": cell.properties})
                    elif hasattr(cell, "nodes"):  # Path
                        clean_row.append([n.properties.get("qualname", str(n)) for n in cell.nodes])
                    else:
                        clean_row.append(cell)
                rows_preview.append(clean_row)

        header = list(res.header) if hasattr(res, "header") and res.header else []
        row_count = len(res.result_set) if hasattr(res, "result_set") and res.result_set else 0

        trace_obj = {
            "graph": graph_name,
            "cypher": cypher.strip(),
            "params": query_params,
            "duration_ms": round(t_ms, 2),
            "row_count": row_count,
            "rows": rows_preview,
            "header": header,
            "tool": tool
        }
        self.last_trace = trace_obj
        if tool:
            self._tool_traces[tool] = trace_obj
        return res, t_ms

    def record_tool_trace(self, tool: str, trace: Dict[str, Any]) -> None:
        """Explicitly assigns a trace dictionary to a specific tool."""
        self._tool_traces[tool] = trace

    def get_trace_for_tool(self, tool: str, consume: bool = True) -> Optional[Dict[str, Any]]:
        """Returns the trace recorded for a specific tool (no stale fallback)."""
        if tool in self._tool_traces:
            return self._tool_traces.pop(tool) if consume else self._tool_traces[tool]
        return None

    def get_last_trace(self) -> Optional[Dict[str, Any]]:
        """Returns the most recent query execution trace."""
        return self.last_trace


# Global singleton instance
falkor_client = FalkorClient()
