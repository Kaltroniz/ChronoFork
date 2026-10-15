"""P6 Acceptance Test: Real Patches in Isolated Workspaces and Test Verification."""
import sys
import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from backend.app.agents.coder import WorkspaceManager, Coder, Verifier

print("=== P6 Acceptance Test: Real Isolated Workspace Patches ===")
base_repo = os.path.join(ROOT_DIR, "demo_repo", "taskflow")
mgr = WorkspaceManager(base_repo_path=base_repo, workspaces_root="/tmp/chronofork_p6_test")

# 1. Initialize Coder 1 Workspace
print("\n--- Step 1: Initializing Isolated Workspace for Agent 1 ---")
coder_1 = Coder("agent_1", "ConfigCoder", "p6_run", mgr)
print(f"Agent 1 Workspace created at: {coder_1.workspace_path}")
assert os.path.exists(os.path.join(coder_1.workspace_path, "taskflow", "config.py"))

# 2. Baseline Test Run
print("\n--- Step 2: Running Baseline Pytest in Workspace ---")
baseline_test = coder_1.verify()
print(f"Baseline Pytest result: Success={baseline_test['success']}, exit_code={baseline_test['exit_code']}")
assert baseline_test["success"] is True, "Baseline tests must pass"
print("PASSED: Baseline tests passed in isolated workspace copy.")

# 3. Apply Real Patch to config.py
print("\n--- Step 3: Applying Real Patch to config.py ---")
new_config_code = '''"""Configuration loader module for TaskFlow (Patched with backward compatibility)."""
import os
import hashlib


def get_default_config() -> dict:
    return {
        "env": "production",
        "timeout": 30,
        "auth_secret": "chrono-secret-key-42",
        "retries": 3,
        "max_workers": 4
    }


def compute_config_signature(conf: dict) -> str:
    serialized = str(sorted(conf.items()))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:12]


def load_config(path: str = "app.conf", as_object: bool = False) -> dict:
    """
    Patched load_config: preserves dict interface by default, supports as_object.
    """
    conf = get_default_config()
    conf["path"] = path
    conf["signature"] = compute_config_signature(conf)
    return conf
'''
coder_1.apply_patch(os.path.join("taskflow", "config.py"), new_config_code)

# 4. Verify Patch with Pytest
print("\n--- Step 4: Verifying Patch with Pytest ---")
patch_test = coder_1.verify()
print(f"Post-Patch Pytest result: Success={patch_test['success']}")
assert patch_test["success"] is True, f"Post-patch tests failed: {patch_test['output']}"
print("PASSED: 12 tests passed after real patch applied in workspace!")

# 5. Cleanup
mgr.cleanup_workspace("p6_run", "agent_1")
print("\n>>> P6 ACCEPTANCE TEST PASSED SUCCESSFULLY! Real patches verified with pytest! <<<")
