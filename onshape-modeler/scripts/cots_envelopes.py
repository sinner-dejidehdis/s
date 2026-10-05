"""Approximate envelopes (cylinders) of COTS parts for offline interference checks and previews.
Sizes are nominal catalogue numbers, not CAD-exact."""
import json
from pathlib import Path
import cadquery as cq

K = 25.4
COTS = json.loads((Path(__file__).resolve().parent.parent / "references" / "cots.json").read_text())
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
    if key == "bearing_flanged_half_hex":
        return [cyl(0.5625, 0.25, o, ax[2]), cyl(0.625, 0.063, add(o, W(ax, [0, 0, 0.25])), ax[2])]
    if key == "kraken_x60":
        return [cyl(1.2, 2.5, add(o, W(ax, [0, -1.23, 0])), ax[1])]
    if key == "pulley_12t_9mm_falcon":
        return [cyl(0.43, 0.6, add(o, W(ax, [0, 0, -0.3])), ax[2])]
    if key == "pulley_36t_9mm_half_hex":
        return [cyl(1.2, 0.6, add(o, W(ax, [0, -0.3, 0])), ax[1])]
    if key == "pulley_24t_9mm_half_hex":
        return [cyl(0.9, 0.6, add(o, W(ax, [0, -0.3, 0])), ax[1])]
    return []


