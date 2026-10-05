"""Approximate COTS envelopes (bolt heads/shanks, locknuts, rivets, Kraken, pulleys) vs custom parts.
Envelope sizes are nominal catalogue numbers, not CAD-exact.  python tests/check_cots_envelopes.py [ext ...]"""
import json, subprocess, sys
from collections import defaultdict
from pathlib import Path
import cadquery as cq
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import export_step as E

K = 25.4
COTS = json.loads((ROOT / "references/cots.json").read_text())
W = lambda ax, v: [sum(v[j] * ax[j][i] for j in range(3)) for i in range(3)]       # local vec -> world vec


def cyl(r, h, p, d):
    return cq.Solid.makeCylinder(r * K, h * K, cq.Vector(*[c * K for c in p]), cq.Vector(*d))


def add(a, s, k=1):
    return [x + k * y for x, y in zip(a, s)]


def envelopes(item):
    key, o, ax = item["key"], item["origin"], item["axes"]
    if key.startswith("shcs"):
        c = COTS[key]["bolt"]; L = float(key.rsplit("_", 1)[1])
        head = add(o, W(ax, c["under_head"])); tip = W(ax, c["tip_dir"])
        return [cyl(0.095, L, head, tip), cyl(0.156, 0.19, head, [-t for t in tip])]
    if key == "nylock_10_32":
        return [cyl(0.215, 0.234, o, ax[2])]
    if key == "rivet_3_16":
        return [cyl(0.094, 0.25, o, ax[2]), cyl(0.19, 0.06, o, [-t for t in ax[2]])]
    if key == "kraken_x60":
        return [cyl(1.2, 2.5, add(o, W(ax, [0, -1.23, 0])), ax[1])]
    if key == "pulley_12t_9mm_falcon":
        return [cyl(0.43, 0.6, add(o, W(ax, [0, 0, -0.3])), ax[2])]
    if key == "pulley_36t_9mm_half_hex":
        return [cyl(1.2, 0.6, add(o, W(ax, [0, -0.3, 0])), ax[1])]
    if key == "pulley_24t_9mm_half_hex":
        return [cyl(0.9, 0.6, add(o, W(ax, [0, -0.3, 0])), ax[1])]
    return []


exts = sys.argv[1:] or ["0", "0.5", "1"]
total = 0
for ext in exts:
    plan = json.loads(subprocess.run([sys.executable, ROOT / "scripts/templates/elevator.py", "--set", f"extension={ext}"],
                                     capture_output=True, text=True, check=True).stdout)
    bodies = [(n, w.val()) for n, w in E.build(plan)]
    hits = defaultdict(float)
    for item in plan["assembly"]["cots"]:
        for env in envelopes(item):
            eb = env.BoundingBox()
            for n, b in bodies:
                if item["key"].startswith("pulley") and ("shaft" in n or "belt" in n):
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
