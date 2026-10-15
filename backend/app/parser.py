"""AST Ingestion and Import-Aware Call Resolution for ChronoFork.

Converts Python repositories into FalkorDB code graphs under repo:<name>.
Labels:
  Every node receives the shared base label `:Symbol` plus a specific label:
  `:Symbol:Module`, `:Symbol:Class`, `:Symbol:Function`, or `:Symbol:Test`.
Edges:
  `DEFINES`, `IMPORTS`, `CALLS`, `TESTED_BY`.
Props:
  `name`, `qualname`, `path`, `lineno`, `signature_hash`.
"""

import ast
import os
import hashlib
from typing import Dict, List, Set, Tuple, Optional, Any
from pathlib import Path


class SymbolNode:
    def __init__(self, name: str, qualname: str, label: str, path: str, lineno: int, signature_hash: str):
        self.name = name
        self.qualname = qualname
        self.label = label  # Module, Class, Function, Test
        self.path = path
        self.lineno = lineno
        self.signature_hash = signature_hash


class CodeGraph:
    def __init__(self, repo_name: str, repo_path: str):
        self.repo_name = repo_name
        self.repo_path = os.path.abspath(repo_path)
        self.symbols: Dict[str, SymbolNode] = {}  # qualname -> SymbolNode
        self.defines_edges: List[Tuple[str, str]] = []  # (module_qualname, symbol_qualname)
        self.imports_edges: List[Tuple[str, str]] = []  # (from_mod, to_mod_or_symbol)
        self.calls_edges: List[Tuple[str, str]] = []  # (caller_qualname, callee_qualname)
        self.tested_by_edges: List[Tuple[str, str]] = []  # (target_qualname, test_qualname)


def compute_signature_hash(node: ast.AST) -> str:
    """Computes a stable hash of the function signature and args."""
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        args = [a.arg for a in node.args.args]
        defaults_len = len(node.args.defaults)
        sig = f"{node.name}({','.join(args)}):defaults={defaults_len}"
        return hashlib.sha256(sig.encode("utf-8")).hexdigest()[:12]
    return "000000000000"


def file_path_to_module_path(root_dir: str, file_path: str) -> str:
    """Converts a filesystem path to a python module dot-notation."""
    rel = os.path.relpath(file_path, root_dir)
    clean = os.path.splitext(rel)[0].replace(os.sep, ".")
    if clean.endswith(".__init__"):
        clean = clean[:-9]
    return clean


class ModuleVisitor(ast.NodeVisitor):
    """Pass 1: Extracts module definitions and import mappings."""
    def __init__(self, module_name: str, rel_path: str, is_test_file: bool):
        self.module_name = module_name
        self.rel_path = rel_path
        self.is_test_file = is_test_file
        
        # Local symbols defined in this file
        self.functions: Dict[str, SymbolNode] = {}
        self.classes: Dict[str, SymbolNode] = {}
        
        # Import table: alias -> fully_qualified_target
        self.import_table: Dict[str, str] = {}
        
        # Raw imports for graph edges
        self.imported_modules: Set[str] = set()

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            name = alias.name
            asname = alias.asname or name.split(".")[0]
            self.import_table[asname] = name
            self.imported_modules.add(name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        mod = node.module or ""
        # Handle relative imports
        if node.level > 0:
            parts = self.module_name.split(".")
            base = ".".join(parts[:-node.level]) if len(parts) >= node.level else ""
            mod = f"{base}.{mod}" if (base and mod) else (base or mod)
            
        self.imported_modules.add(mod)
        for alias in node.names:
            target_symbol = f"{mod}.{alias.name}" if mod else alias.name
            asname = alias.asname or alias.name
            self.import_table[asname] = target_symbol
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._add_function(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._add_function(node)
        self.generic_visit(node)

    def _add_function(self, node):
        is_test = self.is_test_file or node.name.startswith("test_")
        label = "Test" if is_test else "Function"
        qualname = f"{self.module_name}.{node.name}"
        sig_hash = compute_signature_hash(node)
        sym = SymbolNode(
            name=node.name,
            qualname=qualname,
            label=label,
            path=self.rel_path,
            lineno=node.lineno,
            signature_hash=sig_hash
        )
        self.functions[node.name] = sym

    def visit_ClassDef(self, node: ast.ClassDef):
        qualname = f"{self.module_name}.{node.name}"
        sym = SymbolNode(
            name=node.name,
            qualname=qualname,
            label="Class",
            path=self.rel_path,
            lineno=node.lineno,
            signature_hash="class"
        )
        self.classes[node.name] = sym
        self.generic_visit(node)


class CallResolver(ast.NodeVisitor):
    """Pass 2: Resolves function calls within function bodies using import table."""
    def __init__(self, caller_qualname: str, module_name: str, import_table: Dict[str, str], local_funcs: Dict[str, SymbolNode]):
        self.caller_qualname = caller_qualname
        self.module_name = module_name
        self.import_table = import_table
        self.local_funcs = local_funcs
        self.resolved_callees: Set[str] = set()

    def visit_Call(self, node: ast.Call):
        callee_qualname = self._resolve_target(node.func)
        if callee_qualname:
            self.resolved_callees.add(callee_qualname)
        self.generic_visit(node)

    def _resolve_target(self, func_node: ast.AST) -> Optional[str]:
        # Case A: Direct call `load_config(...)`
        if isinstance(func_node, ast.Name):
            func_name = func_node.id
            # 1. Check import table
            if func_name in self.import_table:
                return self.import_table[func_name]
            # 2. Check local function in same file
            if func_name in self.local_funcs:
                return f"{self.module_name}.{func_name}"
            return None

        # Case B: Attribute call `config.load_config(...)`
        if isinstance(func_node, ast.Attribute):
            attr_name = func_node.attr
            if isinstance(func_node.value, ast.Name):
                prefix = func_node.value.id
                if prefix in self.import_table:
                    target_mod = self.import_table[prefix]
                    return f"{target_mod}.{attr_name}"
            # Case C: Chained attribute `taskflow.config.load_config(...)`
            elif isinstance(func_node.value, ast.Attribute):
                # Chain resolution can be added if needed
                pass
        return None


def parse_repository(repo_path: str, repo_name: str) -> CodeGraph:
    """Parses all Python modules in a repository with import-aware call resolution."""
    cg = CodeGraph(repo_name, repo_path)
    file_visitors: Dict[str, ModuleVisitor] = {}
    
    # Collect all python files
    py_files = []
    for root, _, files in os.walk(cg.repo_path):
        if ".git" in root or "__pycache__" in root or ".pytest_cache" in root or "venv" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                py_files.append(os.path.join(root, file))

    # Pass 1: Definitions and Imports
    for fpath in py_files:
        rel_path = os.path.relpath(fpath, cg.repo_path).replace("\\", "/")
        mod_name = file_path_to_module_path(cg.repo_path, fpath)
        is_test = "test" in rel_path.lower()
        
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            tree = ast.parse(content, filename=fpath)
        except Exception:
            continue

        visitor = ModuleVisitor(mod_name, rel_path, is_test)
        visitor.visit(tree)
        file_visitors[fpath] = (visitor, tree)

        # Register Module symbol
        mod_sym = SymbolNode(
            name=mod_name.split(".")[-1],
            qualname=mod_name,
            label="Module",
            path=rel_path,
            lineno=1,
            signature_hash="module"
        )
        cg.symbols[mod_name] = mod_sym

        # Register Classes & Functions
        for cls_sym in visitor.classes.values():
            cg.symbols[cls_sym.qualname] = cls_sym
            cg.defines_edges.append((mod_name, cls_sym.qualname))

        for func_sym in visitor.functions.values():
            cg.symbols[func_sym.qualname] = func_sym
            cg.defines_edges.append((mod_name, func_sym.qualname))

        # Add IMPORTS edges to modules
        for imp_mod in visitor.imported_modules:
            cg.imports_edges.append((mod_name, imp_mod))

    # Pass 2: Call Resolution
    for fpath, (visitor, tree) in file_visitors.items():
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                caller_qualname = f"{visitor.module_name}.{node.name}"
                resolver = CallResolver(
                    caller_qualname=caller_qualname,
                    module_name=visitor.module_name,
                    import_table=visitor.import_table,
                    local_funcs=visitor.functions
                )
                # Visit the body of the function
                for stmt in node.body:
                    resolver.visit(stmt)

                for callee_qualname in resolver.resolved_callees:
                    # Verify target exists in repo symbols (rejects external libs or non-existent symbols)
                    if callee_qualname in cg.symbols:
                        cg.calls_edges.append((caller_qualname, callee_qualname))
                        
                        # If caller is a Test symbol, record TESTED_BY edge: (callee)-[:TESTED_BY]->(caller)
                        caller_sym = cg.symbols.get(caller_qualname)
                        if caller_sym and caller_sym.label == "Test":
                            cg.tested_by_edges.append((callee_qualname, caller_qualname))

    return cg


def ingest_code_graph_to_falkordb(cg: CodeGraph, falkor_conn) -> dict:
    """Ingests parsed CodeGraph into FalkorDB base key `repo:<name>`."""
    graph_key = f"repo:{cg.repo_name}"
    
    # Clean prior graph if exists
    falkor_conn.delete_graph(graph_key)
    g = falkor_conn.get_graph(graph_key)

    # 1. Create Nodes with base label :Symbol and specific sublabel
    # Use UNWIND parameter batching for fast ingestion
    node_payload = [
        {
            "name": sym.name,
            "qualname": sym.qualname,
            "path": sym.path,
            "lineno": sym.lineno,
            "signature_hash": sym.signature_hash,
            "label": sym.label
        }
        for sym in cg.symbols.values()
    ]

    create_nodes_cypher = """
    UNWIND $nodes AS n
    CREATE (s:Symbol {
        name: n.name,
        qualname: n.qualname,
        path: n.path,
        lineno: n.lineno,
        signature_hash: n.signature_hash
    })
    """
    g.query(create_nodes_cypher, {"nodes": node_payload})

    # Apply specific sub-labels (:Module, :Function, :Class, :Test)
    for sublabel in ["Module", "Function", "Class", "Test"]:
        qualnames = [n["qualname"] for n in node_payload if n["label"] == sublabel]
        if qualnames:
            sublabel_cypher = f"""
            UNWIND $qnames AS q
            MATCH (s:Symbol {{qualname: q}})
            SET s:{sublabel}
            """
            g.query(sublabel_cypher, {"qnames": qualnames})

    # Create range index on qualname for O(1) matching
    try:
        g.query("CREATE INDEX FOR (s:Symbol) ON (s.qualname)")
    except Exception:
        pass

    # 2. Ingest DEFINES edges
    if cg.defines_edges:
        g.query("""
        UNWIND $edges AS e
        MATCH (m:Symbol {qualname: e[0]}), (s:Symbol {qualname: e[1]})
        CREATE (m)-[:DEFINES]->(s)
        """, {"edges": cg.defines_edges})

    # 3. Ingest CALLS edges
    if cg.calls_edges:
        g.query("""
        UNWIND $edges AS e
        MATCH (src:Symbol {qualname: e[0]}), (tgt:Symbol {qualname: e[1]})
        CREATE (src)-[:CALLS]->(tgt)
        """, {"edges": cg.calls_edges})

    # 4. Ingest TESTED_BY edges
    if cg.tested_by_edges:
        g.query("""
        UNWIND $edges AS e
        MATCH (tgt:Symbol {qualname: e[0]}), (tst:Symbol {qualname: e[1]})
        CREATE (tgt)-[:TESTED_BY]->(tst)
        """, {"edges": cg.tested_by_edges})

    # 5. Ingest IMPORTS edges between modules
    if cg.imports_edges:
        g.query("""
        UNWIND $edges AS e
        MATCH (m1:Symbol {qualname: e[0]}), (m2:Symbol {qualname: e[1]})
        CREATE (m1)-[:IMPORTS]->(m2)
        """, {"edges": cg.imports_edges})

    return {
        "graph_key": graph_key,
        "nodes_count": len(cg.symbols),
        "defines_count": len(cg.defines_edges),
        "calls_count": len(cg.calls_edges),
        "tested_by_count": len(cg.tested_by_edges),
        "imports_count": len(cg.imports_edges)
    }
