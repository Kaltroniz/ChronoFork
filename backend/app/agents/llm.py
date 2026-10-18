"""Pluggable LLM Provider for ChronoFork Agents (Gemini, Anthropic, OpenAI, or Mock)."""
import os
import json
from typing import Dict, Any, Optional


# Auto-load .env file if present
_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))
if os.path.exists(_env_path):
    try:
        with open(_env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("\"'")
                    if k not in os.environ:
                        os.environ[k] = v
    except Exception:
        pass


class LLMProvider:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "gemini").lower()

    @property
    def api_key(self) -> str:
        return (
            os.getenv("GEMINI_API_KEY") or
            os.getenv("ANTHROPIC_API_KEY") or
            os.getenv("OPENAI_API_KEY") or
            ""
        )

    def _deterministic_plan(self, user_task: str) -> list:
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

    def plan_subtasks(self, user_task: str, repo_symbols: list) -> list:
        """Decomposes a task into agent subtasks with symbol claims and intents."""
        if not self.api_key or self.provider == "mock":
            return self._deterministic_plan(user_task)

        try:
            import httpx
            prompt = f"""
            You are a lead software architect. Decompose this coding task into 2 subtasks for parallel AI coding agents:
            TASK: {user_task}
            AVAILABLE SYMBOLS: {repo_symbols[:15]}
            Return JSON list: [{{"agent_id": "agent_1", "agent_name": "Name", "role": "Role", "claim_symbol": "symbol.qualname", "intent": "SIGNATURE_CHANGE|BODY_EDIT"}}]
            """
            models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.0-flash"]
            headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
            for model_name in models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
                    payload = {"contents": [{"parts": [{"text": prompt}]}]}
                    res = httpx.post(url, headers=headers, json=payload, timeout=10.0)
                    if res.status_code == 200:
                        raw = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                        clean = raw.strip().replace("```json", "").replace("```", "").strip()
                        return json.loads(clean)
                except Exception:
                    continue
        except Exception as e:
            print(f"Live LLM call error (falling back to deterministic synthesis): {e}")

        return self._deterministic_plan(user_task)

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
            models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.0-flash"]
            headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
            for model_name in models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
                    payload = {"contents": [{"parts": [{"text": prompt}]}]}
                    res = httpx.post(url, headers=headers, json=payload, timeout=12.0)
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
                except Exception:
                    continue
        except Exception as ex:
            print(f"Gemini live patch generation exception: {ex}")
        return None

    def get_status(self) -> Dict[str, Any]:
        """Returns the configuration and readiness status of the LLM provider."""
        has_key = bool(self.api_key and len(self.api_key.strip()) > 8)
        return {
            "provider": self.provider,
            "configured": has_key,
            "models_supported": ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.0-flash"],
            "live_mode_available": has_key,
            "mode": "live-gemini" if has_key else "deterministic-fallback"
        }


llm_provider = LLMProvider()
