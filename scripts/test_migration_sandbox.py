import tempfile, shutil, os, subprocess

tmp = tempfile.mkdtemp()
shutil.copytree('/mnt/c/Users/Acer/OneDrive/Documents/hackathons/New folder/demo_repo/taskflow', tmp, dirs_exist_ok=True)

# 1. Breaking ConfigObject
with open(os.path.join(tmp, 'taskflow/config.py'), 'w') as f:
    f.write('''"""Configuration loader module for TaskFlow."""
import os, hashlib

class ConfigObject:
    def __init__(self, data: dict):
        self.env = data.get('env', 'production')
        self.timeout = data.get('timeout', 30)
        self.auth_secret = data.get('auth_secret', 'chrono-secret-key-42')
        self.path = data.get('path', 'app.conf')
        self.signature = data.get('signature', '')

def get_default_config() -> dict:
    return {'env': 'production', 'timeout': 30, 'auth_secret': 'chrono-secret-key-42', 'retries': 3, 'max_workers': 4}

def compute_config_signature(conf: dict) -> str:
    return hashlib.sha256(str(sorted(conf.items())).encode('utf-8')).hexdigest()[:12]

def load_config(path: str = 'app.conf') -> ConfigObject:
    conf = get_default_config()
    conf['path'] = path
    conf['signature'] = compute_config_signature(conf)
    return ConfigObject(conf)
''')

# 2. Migrate database.py
with open(os.path.join(tmp, 'taskflow/database.py'), 'w') as f:
    f.write('''"""Database module."""
from taskflow.config import load_config
_DB_STORE = {}

def get_connection(path: str = 'app.conf') -> dict:
    cfg = load_config(path=path)
    env_val = cfg.env if hasattr(cfg, 'env') else cfg['env']
    timeout_val = cfg.timeout if hasattr(cfg, 'timeout') else cfg['timeout']
    secret_val = cfg.auth_secret if hasattr(cfg, 'auth_secret') else cfg['auth_secret']
    return {'db_url': f'sqlite:///taskflow_{env_val}.db', 'timeout': timeout_val, 'secret': secret_val, 'connected': True}

def save_result(key: str, val: dict) -> None:
    _DB_STORE[key] = val

def get_result(key: str) -> dict:
    return _DB_STORE.get(key, {})

def clear_store() -> None:
    _DB_STORE.clear()
''')

# 3. Migrate test_config.py
with open(os.path.join(tmp, 'tests/test_config.py'), 'w') as f:
    f.write('''"""Tests for config."""
from taskflow.config import load_config, get_default_config, compute_config_signature

def test_get_default_config():
    cfg = get_default_config()
    assert cfg['env'] == 'production'
    assert cfg['timeout'] == 30
    assert 'auth_secret' in cfg

def test_load_config_default():
    cfg = load_config()
    assert hasattr(cfg, 'env') and cfg.env == 'production'
    assert hasattr(cfg, 'path') and cfg.path == 'app.conf'
    assert hasattr(cfg, 'signature') and len(cfg.signature) == 12

def test_compute_config_signature():
    cfg1 = {'a': 1, 'b': 2}
    cfg2 = {'b': 2, 'a': 1}
    assert compute_config_signature(cfg1) == compute_config_signature(cfg2)
''')

env = os.environ.copy()
env['PYTHONPATH'] = tmp
res = subprocess.run(['/opt/venv/bin/pytest', '-v'], cwd=tmp, env=env, capture_output=True, text=True)
print('Returncode:', res.returncode)
print('Passed count:', res.stdout.count(' PASSED'))
print('Failed count:', res.stdout.count(' FAILED'))
shutil.rmtree(tmp)
