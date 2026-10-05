#!/usr/bin/env python3
"""Preview PNG of a plan: custom parts + translucent COTS envelopes (+ the sweep ball for the shooter).
  python render_preview.py plan.json out.png [--views iso,side,front]"""
import json, math, sys
from pathlib import Path
import cadquery as cq
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
sys.path.insert(0, str(Path(__file__).resolve().parent))
import export_step as E
from cots_envelopes import K, envelopes

VIEWS = {"iso": (20, -58), "side": (0, 0), "front": (0, 90), "top": (90, -90)}


def color(n):
    l = n.lower()
    if "belt" in l: return "teal"
    if "tire" in l: return "tab:red"
    if "plate" in l: return "tab:blue"
    if "hood" in l: return "tab:orange"
    if "roller" in l and "shaft" not in l: return "tab:green"
    return "dimgray"


def main():
    plan = json.loads(Path(sys.argv[1]).read_text()); out = sys.argv[2]
    views = ("iso,side,front" if "--views" not in sys.argv else sys.argv[sys.argv.index("--views") + 1]).split(",")
    bodies = E.build(plan)
    envs = [e for it in (plan.get("assembly") or {}).get("cots", []) for e in envelopes(it)]
    ball = None
    if plan.get("ball") and "center_radius_in" in plan["ball"]:
        b = plan["ball"]; a = math.radians(270)
        ball = cq.Solid.makeSphere(b["diameter_in"] / 2 * K, cq.Vector(0, b["center_radius_in"] * math.cos(a) * K,
                                   b["center_radius_in"] * math.sin(a) * K), cq.Vector(0, 0, 1), -90, 90, 360)
    allv = cq.Compound.makeCompound([w.val() for _, w in bodies]).BoundingBox()
    fig = plt.figure(figsize=(5.6 * len(views), 6))
    for k, v in enumerate(views):
        ax = fig.add_subplot(1, len(views), k + 1, projection="3d"); ax.view_init(*VIEWS[v])
        def add(shape, col, al):
            vv, tt = shape.tessellate(0.5)
            ax.add_collection3d(Poly3DCollection([[(p.x, p.y, p.z) for p in (vv[a], vv[b], vv[c])] for a, b, c in tt],
                                                 facecolor=col, edgecolor="none", alpha=al))
        for n, w in bodies: add(w.val(), color(n), 0.5)
        for e in envs: add(e, "purple", 0.35)
        if ball is not None: add(ball, "gold", 0.9)
        ax.set_xlim(allv.xmin, allv.xmax); ax.set_ylim(allv.ymin, allv.ymax); ax.set_zlim(allv.zmin, allv.zmax)
        ax.set_box_aspect((allv.xlen, allv.ylen, allv.zlen)); ax.set_title(f"{plan['name']} ({v}); purple = COTS envelope")
    plt.tight_layout(); plt.savefig(out, dpi=100); print("->", out)


if __name__ == "__main__":
    main()
