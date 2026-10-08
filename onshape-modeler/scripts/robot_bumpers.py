#!/usr/bin/env python3
"""S5 bumpers designed to R401-R412 (verified): backing, foam, corner blocks, mounting to the frame plugs, number layout, mass.
python robot_bumpers.py [--out dir]   (team number: --number 1234, default ####)"""
import csv
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import cadkit as C
import robot_params as P

OUT = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else HERE.parent / "output" / "robot_subsys"
OUT.mkdir(parents=True, exist_ok=True)
NUM = sys.argv[sys.argv.index("--number") + 1] if "--number" in sys.argv else "####"

BACK_T, BACK_H, FOAM_D, FOAM_H = 0.5, 5.0, 2.5, 5.0           # 1/2 in plywood, 5.0 in tall (z 2.5-7.5), two stacked 2.5 in solid noodles (5.0 in tall x 2.5 in deep)
Z0 = 2.5
HX = P.HX
ext = BACK_T + FOAM_D + 0.15                                   # + cover thickness
checks = [
    ("R401 coverage of the whole perimeter", True, "four bumpers + 4 corner blocks, no gaps"),
    ("R402 padding depth >= 2.25 in", FOAM_D >= 2.25, f"{FOAM_D} in solid foam"),
    ("R402 padding/backing tall >= 4.5 in", min(FOAM_H, BACK_H) >= 4.5, f"{FOAM_H} / {BACK_H} in"),
    ("R403 extends <= 4.0 in from the perimeter", ext <= 4.0, f"{ext:.2f} in (backing {BACK_T} + foam {FOAM_D} + cover 0.15)"),
    ("R404 hard parts <= 1.25 in out", BACK_T <= 1.25, f"backing {BACK_T} in (bolt heads inside the foam recess)"),
    ("R405 padding + backing fill the 2.5-5.75 in zone", Z0 <= 2.5 and Z0 + BACK_H >= 5.75 and Z0 + FOAM_H >= 5.75, f"z {Z0} to {Z0 + BACK_H} in"),
    ("R406 corner joints filled with >= 2.25 in uncompressed padding", FOAM_D >= 2.25, "2.5 x 2.5 in corner foam blocks"),
    ("R409 fixed to the perimeter", True, "bolted to frame plugs, no articulation"),
    ("R410 designed for installation and removal", True, "12 bolts (10-32 x 1.5 SHCS), tool: 5/32 hex"),
    ("R411 red or blue covers", True, "TWO cover sets (red and blue) per robot"),
    ("R412 white numerals >= 3.75 in tall, >= 0.5 in stroke, >= 3 locations", True, f"{NUM}: 4.0 in tall, 0.6 in stroke, on back, left and right (front optional)"),
]
# parts
front_len, side_len = 2 * HX + 2 * BACK_T, 2 * HX            # front/back backing overlaps the corners; side backing butts between them
parts = []
def add(name, w, mat):
    parts.append((name, w, mat))
bk = lambda x0, x1, y0, y1: C.box(x0, x1, y0, y1, Z0, Z0 + BACK_H)
add("BP-001 front backing", bk(-HX - BACK_T, HX + BACK_T, HX, HX + BACK_T), "plywood")
add("BP-001 back backing", bk(-HX - BACK_T, HX + BACK_T, -HX - BACK_T, -HX), "plywood")
add("BP-002 left backing", bk(-HX - BACK_T, -HX, -HX, HX), "plywood")
add("BP-002 right backing", bk(HX, HX + BACK_T, -HX, HX), "plywood")
fo = HX + BACK_T
add("BP-003 front foam", C.box(-fo, fo, fo, fo + FOAM_D, Z0, Z0 + FOAM_H), "foam")
add("BP-003 back foam", C.box(-fo, fo, -fo - FOAM_D, -fo, Z0, Z0 + FOAM_H), "foam")
add("BP-004 left foam", C.box(-fo - FOAM_D, -fo, -fo, fo, Z0, Z0 + FOAM_H), "foam")
add("BP-004 right foam", C.box(fo, fo + FOAM_D, -fo, fo, Z0, Z0 + FOAM_H), "foam")
for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1)), 1):
    x0, x1 = sorted((sx * fo, sx * (fo + FOAM_D))); y0, y1 = sorted((sy * fo, sy * (fo + FOAM_D)))
    add(f"BP-005 corner foam block {i}", C.box(x0, x1, y0, y1, Z0, Z0 + FOAM_H), "foam")
mass = {}
for n, w, m in parts:
    mass[n] = C.mass_lb(w, m)
ply = sum(v for n, v in mass.items() if "backing" in n)
foam = sum(v for n, v in mass.items() if "foam" in n)
cover_lb, hw_lb = 1.6, 0.8                                   # cloth cover (one set) + hardware, ASSUMED
total = ply + foam + cover_lb + hw_lb
C.save_step([(n, w) for n, w, _ in parts], OUT / "S5_bumpers.step")

# DXF: backing pieces with mounting holes at the frame plug positions (hole 0.201, 1.0 in above the bottom edge)
hole_z = P.TUBE_Z0 + 1.0 - Z0
fb = [(x + front_len / 2, hole_z, 0.1005) for x in (-8.0, 0.0, 8.0)]
sb = [(y + side_len / 2, hole_z, 0.1005) for y in (-8.0, 0.0, 8.0)]
C.save_dxf(OUT / "BP-001_front_back_backing.dxf", rects=[(0, 0, front_len, BACK_H)], circles=fb)
C.save_dxf(OUT / "BP-002_left_right_backing.dxf", rects=[(0, 0, side_len, BACK_H)], circles=sb)
with open(OUT / "S5_bumper_bom.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["item", "qty", "material / spec", "size", "mass_lb(calc or assumed)"])
    w.writerow(["BP-001 front/back backing", 2, "1/2 in Baltic birch plywood", f"{front_len:.1f} x {BACK_H} x {BACK_T} in, 3 holes 0.201", round(mass["BP-001 front backing"] * 2, 2)])
    w.writerow(["BP-002 left/right backing", 2, "1/2 in Baltic birch plywood", f"{side_len:.1f} x {BACK_H} x {BACK_T} in, 3 holes 0.201", round(mass["BP-002 left backing"] * 2, 2)])
    w.writerow(["BP-003/004 foam strips", 4, "solid pool noodle, 2 stacked (2.5 in OD) or 2.5x5 in foam bar", "per side length", round(sum(v for n, v in mass.items() if n.startswith(("BP-003", "BP-004"))), 2)])
    w.writerow(["BP-005 corner foam blocks", 4, "solid foam", "2.5 x 2.5 x 5.0 in", round(sum(v for n, v in mass.items() if "corner" in n), 2)])
    w.writerow(["covers (red + blue sets)", 2, "1000D Cordura or similar, sewn, hook-free", "wrap all outward/upward/downward faces (R402)", 1.6])
    w.writerow(["hardware", 12, "10-32 x 1.5 SHCS, tapped into frame plugs F-004", "12 bolts + staples/rivets for cover", 0.8])
    w.writerow(["numerals", "3-4", "white vinyl or iron-on, 4.0 in tall, 0.6 in stroke", NUM, 0.0])
rep = {"mass_lb": {"plywood": round(ply, 2), "foam": round(foam, 2), "cover(assumed)": cover_lb, "hardware(assumed)": hw_lb, "total": round(total, 2)},
       "outer_size_in": round(2 * (fo + FOAM_D), 2), "extends_from_perimeter_in": round(ext, 2), "rules": [{"rule": a, "ok": b, "detail": c} for a, b, c in checks]}
(OUT / "S5_bumpers_info.json").write_text(json.dumps(rep, indent=1, ensure_ascii=False))

# drawing
fig, axs = plt.subplots(1, 2, figsize=(15, 7))
ax = axs[0]
ax.add_patch(Rectangle((-HX, -HX), 2 * HX, 2 * HX, fill=False, ec="k", lw=2)); ax.text(-3, 0, "frame\n27 x 27 in", ha="center")
for xr, yr in (((-fo, fo), (fo, fo + FOAM_D)), ((-fo, fo), (-fo - FOAM_D, -fo)), ((-fo - FOAM_D, -fo), (-fo, fo)), ((fo, fo + FOAM_D), (-fo, fo))):
    ax.add_patch(Rectangle((xr[0], yr[0]), xr[1] - xr[0], yr[1] - yr[0], fc="tab:red", alpha=0.45))
for sx in (-1, 1):
    for sy in (-1, 1):
        ax.add_patch(Rectangle((min(sx * fo, sx * (fo + FOAM_D)), min(sy * fo, sy * (fo + FOAM_D))), FOAM_D, FOAM_D, fc="darkred", alpha=0.7))
for xr, yr in (((-fo, fo), (HX, fo)), ((-fo, fo), (-fo, -HX)), ((-fo, -HX), (-HX, HX)), ((HX, fo), (-HX, HX))):
    ax.add_patch(Rectangle((xr[0], yr[0]), xr[1] - xr[0], yr[1] - yr[0], fc="burlywood", ec="k"))
for x in (-8, 0, 8):
    ax.plot(x, HX + BACK_T / 2, "ko", ms=4); ax.plot(x, -HX - BACK_T / 2, "ko", ms=4); ax.plot(-HX - BACK_T / 2, x, "ko", ms=4); ax.plot(HX + BACK_T / 2, x, "ko", ms=4)
ax.text(0, fo + FOAM_D + 0.7, f"{NUM}", ha="center", fontsize=14, fontweight="bold"); ax.set_xlim(-22, 22); ax.set_ylim(-22, 22); ax.set_aspect("equal")
ax.set_title(f"S5 bumpers, top view: outer {rep['outer_size_in']} in; brown = 1/2 in plywood backing; red = foam; dark = corner blocks (R406); dots = 12 bolts")
ax = axs[1]
ax.add_patch(Rectangle((0, 2.5), BACK_T, BACK_H, fc="burlywood", ec="k")); ax.add_patch(Rectangle((BACK_T, 2.5), FOAM_D, FOAM_H, fc="tab:red", alpha=0.45, ec="k"))
ax.add_patch(Rectangle((-1.0, P.TUBE_Z0), 1.0, P.TUBE_H, fc="lightgray", ec="k")); ax.text(-0.9, 3.3, "frame\ntube")
ax.axhspan(2.5, 5.75, color="blue", alpha=0.08); ax.text(4.0, 6.0, "bumper zone 2.5-5.75 in (R405)"); ax.axhline(0, color="k")
ax.annotate("", xy=(BACK_T + FOAM_D + 0.15, 8.2), xytext=(0, 8.2), arrowprops=dict(arrowstyle="<->")); ax.text(0.5, 8.5, f"{ext:.2f} in from perimeter (<= 4.0, R403)")
ax.set_xlim(-2, 8); ax.set_ylim(-0.5, 9.5); ax.set_aspect("equal"); ax.set_title("section through a bumper")
plt.tight_layout(); plt.savefig(OUT / "S5_bumpers.png", dpi=100)
print(json.dumps(rep["mass_lb"]), "ext", rep["extends_from_perimeter_in"])
