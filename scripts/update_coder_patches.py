import os

coder_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "app", "agents", "coder.py"))

extra_patches = '''

MIGRATED_DATABASE_PATCH = """\"\"\"Database module for TaskFlow, migrated to ConfigObject contract.\"\"\"
from taskflow.config import load_config

_DB_STORE = {}


def get_connection(path: str = "app.conf") -> dict:
    \"\"\"Migrated: accesses ConfigObject attributes (.env, .timeout, .auth_secret).\"\"\"
    cfg = load_config(path=path)
    env_val = cfg.env if hasattr(cfg, "env") else cfg["env"]
    timeout_val = cfg.timeout if hasattr(cfg, "timeout") else cfg["timeout"]
    secret_val = cfg.auth_secret if hasattr(cfg, "auth_secret") else cfg["auth_secret"]
    return {
        "db_url": f"sqlite:///taskflow_{env_val}.db",
        "timeout": timeout_val,
        "secret": secret_val,
        "connected": True
    }


def save_result(key: str, val: dict) -> None:
    _DB_STORE[key] = val


def get_result(key: str) -> dict:
    return _DB_STORE.get(key, {})


def clear_store() -> None:
    _DB_STORE.clear()
\"\"\"


MIGRATED_TEST_CONFIG_PATCH = """\"\"\"Tests for configuration loader module.\"\"\"
from taskflow.config import load_config, get_default_config, compute_config_signature, ConfigObject


def test_get_default_config():
    cfg = get_default_config()
    assert cfg["env"] == "production"
    assert cfg["timeout"] == 30
    assert "auth_secret" in cfg


def test_load_config_default():
    cfg = load_config()
    assert isinstance(cfg, ConfigObject) or hasattr(cfg, "env")
    assert cfg.env == "production"
    assert cfg.path == "app.conf"
    assert len(cfg.signature) == 12


def test_compute_config_signature():
    cfg1 = {"a": 1, "b": 2}
    cfg2 = {"b": 2, "a": 1}
    assert compute_config_signature(cfg1) == compute_config_signature(cfg2)
\"\"\"
'''

with open(coder_path, "r", encoding="utf-8") as f:
    content = f.read()

if "MIGRATED_DATABASE_PATCH" not in content:
    target = 'return ConfigObject(conf)\n"""'
    idx = content.find(target)
    if idx != -1:
        end_idx = idx + len(target)
        new_content = content[:end_idx] + extra_patches + content[end_idx:]
        with open(coder_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Updated coder.py successfully!")
    else:
        print("Could not find insertion target in coder.py")
else:
    print("MIGRATED_DATABASE_PATCH already in coder.py")
