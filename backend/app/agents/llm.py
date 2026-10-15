"""Pluggable LLM Provider for ChronoFork Agents (Gemini, Anthropic, OpenAI, or Mock)."""
import os
import json
from typing import Dict, Any, Optional


class LLMProvider:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "gemini").lower()
        self.api_key = (
            os.getenv("GEMINI_API_KEY") or
            os.getenv("ANTHROPIC_API_KEY") or
            os.getenv("OPENAI_API_KEY") or
            ""
        )

    def plan_subtasks(self, user_task: str, repo_symbols: list) -> list:
        """Decomposes a task into agent subtasks with symbol claims and intents."""
        # If API key is not present or mock requested, use deterministic synthesis
        if not self.api_key or self.provider == "mock":
            if "reports" in user_task.lower():
                return [
                    {
                        "agent_id": "agent_1",
                        "agent_name": "WorkerCoder",
                        "role": "Core Pipeline",
                        "color": "#3b82f6",
                        "claim_symbol": "taskflow.worker.execute_job",
                        "intent": "BODY_EDIT",
                        "subtask": "Queue optimizations and retry logic"
                    },
                    {
                        "agent_id": "agent_3",
                        "agent_name": "ReportsCoder",
                        "role": "Analytics",
                        "color": "#10b981",
                        "claim_symbol": "taskflow.reports.generator.generate_summary",
                        "intent": "BODY_EDIT",
                        "subtask": "Quarterly analytics report aggregation"
                    }
                ]
            else:
                return [
                    {
                        "agent_id": "agent_1",
                        "agent_name": "ConfigCoder",
                        "role": "Backend Configuration",
                        "color": "#3b82f6",
                        "claim_symbol": "taskflow.config.load_config",
                        "intent": "SIGNATURE_CHANGE",
                        "subtask": "Migrate load_config to return ConfigObject"
                    },
                    {
                        "agent_id": "agent_2",
                        "agent_name": "WorkerCoder",
                        "role": "Background Worker",
                        "color": "#f59e0b",
                        "claim_symbol": "taskflow.worker.execute_job",
                        "intent": "BODY_EDIT",
                        "subtask": "Add retry loop and job metrics"
                    }
                ]

        # Live Gemini API call
        try:
            import httpx
            prompt = f"""
            You are a lead software architect. Decompose this coding task into 2 subtasks for parallel AI coding agents:
            TASK: {user_task}
            AVAILABLE SYMBOLS: {repo_symbols[:15]}
            Return JSON list: [{{ "agent_id": "agent_1", "agent_name": "Name", "role": "Role", "claim_symbol": "symbol.qualname", "intent": "SIGNATURE_CHANGE|BODY_EDIT" }}]
            """
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            res = httpx.post(url, json=payload, timeout=10.0)
            if res.status_code == 200:
                raw = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                # Parse JSON
                clean = raw.strip().replace("```json", "").replace("```", "")
                return json.loads(clean)
        except Exception as e:
            print(f"Live LLM call error (falling back to deterministic synthesis): {e}")

        # Fallback
        return self.plan_subtasks(user_task, repo_symbols)

    def generate_migration_patch(self, symbol_name: str, callers: list, original_code: str) -> Optional[str]:
        """Uses Gemini to generate the caller migration patch from graph impact list."""
        if not self.api_key:
            return None

        try:
            import httpx
            prompt = f"""
            You are a Python software engineer in an autonomous coding swarm.
            Function `{symbol_name}` was migrated to return a strongly-typed `ConfigObject` with attributes (.env, .timeout, .auth_secret, .path, .signature) instead of a dict.
            The code graph uncovered the following dependent callers that must be migrated:
            {callers}

            Here is the caller file code:
            ```python
            {original_code}
            ```

            Rewrite the code so it safely accesses ConfigObject attributes (`cfg.env`, `cfg.timeout`, `cfg.auth_secret`) or falls back to dict access.
            Return ONLY the raw Python code. Do not wrap in markdown or explanations.
            """
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            res = httpx.post(url, json=payload, timeout=12.0)
            if res.status_code == 200:
                raw = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                cleaned = raw.strip()
                if cleaned.startswith("```python"):
                    cleaned = cleaned[len("```python"):].strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned[len("```"):].strip()
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3].strip()
                return cleaned
        except Exception as ex:
            print(f"Gemini live patch generation exception: {ex}")
        return None


llm_provider = LLMProvider()
