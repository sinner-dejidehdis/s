"""Approximate COTS envelopes (bolt heads/shanks, locknuts, rivets, Kraken, pulleys) vs custom parts.
Envelope sizes are nominal catalogue numbers, not CAD-exact.  python tests/check_cots_envelopes.py [ext ...]"""
import json, subprocess, sys
from collections import defaultdict
from pathlib import Path
import cadquery as cq
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import export_step as E

from cots_envelopes import K, envelopes


args = sys.argv[1:]
tpl = "elevator"
if "--tpl" in args:
    i = args.index("--tpl"); tpl = args[i + 1]; del args[i:i + 2]
exts = args or (["0", "0.5", "1"] if tpl == "elevator" else ["-"])
total = 0
for ext in exts:
    extra = ["--set", f"extension={ext}"] if ext != "-" else []
    plan = json.loads(subprocess.run([sys.executable, ROOT / f"scripts/templates/{tpl}.py", *extra],
                                     capture_output=True, text=True, check=True).stdout)
    bodies = [(n, w.val()) for n, w in E.build(plan)]
    hits = defaultdict(float)
    for item in plan["assembly"]["cots"]:
        for env in envelopes(item):
            eb = env.BoundingBox()
            for n, b in bodies:
                if item["key"].startswith(("pulley", "bearing")) and ("shaft" in n or "belt" in n.lower()):
                    continue            # 带轮套在轴上、皮带绕在带轮上：预期接触
                bb = b.BoundingBox()
                if eb.xmax < bb.xmin or bb.xmax < eb.xmin or eb.ymax < bb.ymin or bb.ymax < eb.ymin \
                        or eb.zmax < bb.zmin or bb.zmax < eb.zmin:
                    continue
                v = env.intersect(b).Volume() / K ** 3
                if v > 2e-4:
                    hits[(item["key"], n)] += v
    print(f"extension={ext}: {len(hits)} COTS-vs-custom overlaps")
    for (k, n), v in sorted(hits.items(), key=lambda x: -x[1])[:20]:
        print(f"   {v:.4f} in3  {k}  x  {n}")
    total += len(hits)
sys.exit(1 if total else 0)
