#!/usr/bin/env python3
"""Side-view PNG of robot_layout poses with the FRC envelope drawn.  python render_layout.py [out.png]"""
import sys
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
import cadquery as cq
sys.argv = sys.argv[:1] + [a for a in sys.argv[1:]]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
K = 25.4


def tris(shape):
    v, t = shape.tessellate(1.5)
    return [[(v[a].y / K, v[a].z / K), (v[b].y / K, v[b].z / K), (v[c].y / K, v[c].z / K)] for a, b, c in t]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else str(HERE.parent / "output" / "robot_layout_side.png")
    fig, axs = plt.subplots(1, 2, figsize=(15, 6.5))
    for ax, pose in zip(axs, ("stowed", "deployed")):
        asm = cq.importers.importStep(str(HERE.parent / "output" / f"robot_layout_{pose}.step"))
        for s in asm.solids().vals():
            bb = s.BoundingBox()
            col = "lightgray"
            ax.add_collection(PolyCollection(tris(s), facecolor=col, edgecolor="none", alpha=0.35))
        ax.axhline(30, color="red", ls="--"); ax.text(-20, 30.4, "R107 height 30 in", color="red")
        ax.axvline(13.5, color="green", ls="--"); ax.axvline(-13.5, color="green", ls="--"); ax.text(13.7, 31.5, "front perimeter", color="green", rotation=90)
        ax.axvline(25.5, color="orange", ls=":"); ax.text(25.7, 20, "R105 +12 in", color="orange", rotation=90)
        ax.axhspan(2.5, 5.75, xmin=0, xmax=1, color="blue", alpha=0.08); ax.axhline(0, color="k")
        ax.set_xlim(-22, 30); ax.set_ylim(-1, 34); ax.set_aspect("equal"); ax.set_title(f"{pose}: side view (front = right)")
    plt.tight_layout(); plt.savefig(out, dpi=100); print("->", out)


if __name__ == "__main__":
    main()
