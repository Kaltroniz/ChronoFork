"""In-Memory SSE Event Buffer and Streamer for ChronoFork.

Ensures zero event loss regardless of client connection timing:
Stores every event emitted for a `run_id` in order.
When a client connects to `GET /runs/{id}/events?delay_ms=...`,
it streams buffered events starting from index 0 with requested pacing.
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional, AsyncGenerator


class EventBuffer:
    def __init__(self):
        # run_id -> List of event dicts
        self._buffers: Dict[str, List[Dict[str, Any]]] = {}
        # run_id -> List of asyncio.Event listeners for live streaming
        self._listeners: Dict[str, List[asyncio.Queue]] = {}
        # run_id -> bool is_completed
        self._completed: Dict[str, bool] = {}

    def init_run(self, run_id: str) -> None:
        self._buffers[run_id] = []
        self._listeners[run_id] = []
        self._completed[run_id] = False

    def emit_event(
        self,
        run_id: str,
        agent: str,
        phase: str,
        tool: str,
        message: str,
        cypher: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        node_ids: Optional[List[str]] = None,
        edge_ids: Optional[List[str]] = None,
        scores: Optional[Dict[str, Any]] = None,
        collision: Optional[Dict[str, Any]] = None,
        memory_write: Optional[Dict[str, Any]] = None,
        trace: Optional[Dict[str, Any]] = None,
        execution_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Creates, buffers, and distributes an event."""
        if run_id not in self._buffers:
            self.init_run(run_id)

        # Pull real FalkorDB query execution trace strictly for this tool (no stale fallback)
        if not trace and tool:
            from backend.app.falkor_client import falkor_client
            trace = falkor_client.get_trace_for_tool(tool, consume=True)

        event = {
            "index": len(self._buffers[run_id]),
            "ts": time.time(),
            "run_id": run_id,
            "agent": agent,
            "phase": phase,
            "tool": tool,
            "cypher": trace.get("cypher") if trace else cypher,
            "params": trace.get("params") if trace else (params or {}),
            "trace": trace,
            "execution_data": execution_data,
            "node_ids": node_ids or [],
            "edge_ids": edge_ids or [],
            "scores": scores or {},
            "collision": collision,
            "memory_write": memory_write,
            "message": message
        }

        self._buffers[run_id].append(event)

        # Notify any live listeners
        if run_id in self._listeners:
            for q in self._listeners[run_id]:
                try:
                    q.put_nowait(event)
                except Exception:
                    pass

        return event

    def mark_completed(self, run_id: str) -> None:
        self._completed[run_id] = True
        if run_id in self._listeners:
            for q in self._listeners[run_id]:
                try:
                    q.put_nowait({"type": "DONE"})
                except Exception:
                    pass

    def get_buffered_events(self, run_id: str) -> List[Dict[str, Any]]:
        return list(self._buffers.get(run_id, []))

    async def stream_events(self, run_id: str, delay_ms: int = 400) -> AsyncGenerator[str, None]:
        """
        Streams events to client.
        Always replays from index 0 of buffer, then listens for new live events.
        """
        # Yield already-buffered events
        buffered = self.get_buffered_events(run_id)
        current_idx = 0
        
        for evt in buffered:
            data = json.dumps(evt)
            yield f"data: {data}\n\n"
            current_idx += 1
            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000.0)

        # If run is already completed, signal end
        if self._completed.get(run_id, False):
            yield f"data: {json.dumps({'type': 'RUN_COMPLETE', 'run_id': run_id})}\n\n"
            return

        # Otherwise attach live queue listener
        q = asyncio.Queue()
        if run_id not in self._listeners:
            self._listeners[run_id] = []
        self._listeners[run_id].append(q)

        try:
            while True:
                msg = await q.get()
                if isinstance(msg, dict) and msg.get("type") == "DONE":
                    yield f"data: {json.dumps({'type': 'RUN_COMPLETE', 'run_id': run_id})}\n\n"
                    break
                
                data = json.dumps(msg)
                yield f"data: {data}\n\n"
                if delay_ms > 0:
                    await asyncio.sleep(delay_ms / 1000.0)
        finally:
            if run_id in self._listeners and q in self._listeners[run_id]:
                self._listeners[run_id].remove(q)


# Global singleton event buffer
event_bus = EventBuffer()
