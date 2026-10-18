import pathlib

FILES = ["README.md", "docs/blog-post.md", "docs/QA_PREP.md", "docs/ARCHITECTURE.md",
         "docs/benchmark.md", "docs/demo-script.md", "docs/evidence/phase6/claims_table.md"]
SIMPLE = [("0.8250", "0.854"), ("0.76 ms", "~1-2 ms"), ("0.76ms", "~1-2 ms"),
          ("sub-millisecond", "millisecond-scale"), ("1.09s", "0.15s"), ("~1.7s", "~0.96s")]
BENCH = [("`0.64 ms`", "`1.13 ms`"), ("`1.37 ms`", "`1.97 ms`"), ("`2.04 ms`", "`6.06 ms`"),
         ("`8.33 ms`", "`12.75 ms`"), ("`1.48 ms`", "`3.41 ms`"),
         ("with 1.37 ms median", "with ~1.97 ms median")]

Q17 = """
### Q17: Wouldn't each agent's own tests catch this? Isn't "git merges cleanly" a weak baseline?
**Answer**: Partly, in this demo. Agent 1's branch changes `load_config`'s contract without migrating its callers, so Agent 1's own branch fails tests too. We did not measure git merges or per-branch tests in the benchmark (those columns say "not measured"); the only measured baseline is the merged-tree test run, which equals ground truth by construction. What we claim and measured is claim-time detection: before any code exists, ChronoFork knows a breaking-intent claim reaches another agent's claim within 4 CALLS hops (22/38 seeded collisions, 0 false positives), and it sequences the contract change and the caller migration. Limits: synthetic corpus, static call resolution only, 4-hop bound.
"""

BLOG_NOTE = """> **A caveat we want to be upfront about:** in this demo, Agent 1's branch changes `load_config`'s contract without migrating its callers, so Agent 1's own branch also fails tests. We did not measure git merges or per-branch tests in the benchmark. What ChronoFork adds is claim-time detection: before any code is written it knows a breaking change on `load_config` reaches `execute_job` four hops away, and it sequences the contract change and the caller migration so they land together."""

def rw(p, fn):
    path = pathlib.Path(p)
    if not path.exists():
        print("skip", p); return
    old = path.read_text(encoding="utf-8")
    new = fn(old)
    if new != old:
        path.write_text(new, encoding="utf-8"); print("updated", p)

def generic(t):
    for a, b in SIMPLE:
        t = t.replace(a, b)
    out = []
    for line in t.split("\n"):
        if "FastMCP" in line and "backend/" not in line and ".py" not in line:
            line = line.replace("FastMCP", "MCP-compatible")
        out.append(line)
    return "\n".join(out)

for f in FILES:
    rw(f, generic)

def bench(t):
    for a, b in BENCH:
        t = t.replace(a, b)
    return t
rw("docs/benchmark.md", bench)

def qa(t):
    t = t.replace("`GET /graph/taskflow`, or `GET /collisions/test_run`", "or `GET /graph/taskflow`")
    if "### Q17" not in t:
        t = t.rstrip() + "\n\n---\n" + Q17
    return t
rw("docs/QA_PREP.md", qa)

def blog(t):
    marker = "In the ChronoFork console, the **Verdict Tab**"
    if BLOG_NOTE[:40] not in t and marker in t:
        t = t.replace(marker, BLOG_NOTE + "\n\n" + marker)
    return t
rw("docs/blog-post.md", blog)

rw("docs/NUMBERS.md", lambda t: t.split("## 6. UI Layout Geometry")[0].rstrip() + "\n")
