#!/usr/bin/env python3
"""Interference / clearance checks for S1-S3 (frame, battery, electronics panel) against the module keep-outs.
python robot_subsys_check.py"""
import itertools
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import cadquery as cq
import cadkit as C
import robot_params as P

OUT = HERE.parent / "output" / "robot_subsys"
K = C.K
parts = []
for s in ("S1_frame", "S2_battery", "S3_electronics_panel"):
    asm = cq.importers.importStep(str(OUT / f"{s}.step"))
    for i, sol in enumerate(asm.solids().vals()):
        parts.append((s, i, sol))
print(len(parts), "solids")
keepouts = []
for sx in (-1, 1):
    for sy in (-1, 1):
        x0, x1 = sorted((sx * (P.PAN_HALF - P.MODULE_KEEPOUT), sx * (P.HX)))
        y0, y1 = sorted((sy * (P.PAN_HALF - P.MODULE_KEEPOUT), sy * (P.HY)))
        keepouts.append((f"module keep-out {sx:+d}{sy:+d}", C.box(x0, x1, y0, y1, P.MODULE_Z[0], P.MODULE_Z[1]).val()))
bad = []
for (sa, ia, a), (sb, ib, b) in itertools.combinations(parts, 2):
    A, B = a.BoundingBox(), b.BoundingBox()
    if A.xmax < B.xmin or B.xmax < A.xmin or A.ymax < B.ymin or B.ymax < A.ymin or A.zmax < B.zmin or B.zmax < A.zmin:
        continue
    v = a.intersect(b).Volume() / K ** 3
    if v > 1e-3:
        bad.append((sa, ia, sb, ib, round(v, 4)))
print("part-part interference:", bad or "none")
# envelopes (battery, PDH, RIO, radio, breaker) vs each other and vs the battery
env = {}
for s in ("S2_battery", "S3_electronics_panel"):
    asm = cq.importers.importStep(str(OUT / f"{s}.step"))
# keep-out intrusions: any non-module part overlapping the keep-out volumes
ki = []
for s, i, sol in parts:
    if s == "S1_frame":
        continue                      # 车架管/角撑板就是模块的安装位置，不算侵入
    for n, ko in keepouts:
        if sol.BoundingBox().xmax < ko.BoundingBox().xmin or ko.BoundingBox().xmax < sol.BoundingBox().xmin:
            continue
        v = sol.intersect(ko).Volume() / K ** 3
        if v > 1e-3:
            ki.append((s, i, n, round(v, 3)))
print("module keep-out intrusions:", ki or "none")
# clearances between named envelopes (from params, analytic)
def gap(a, b):
    dx = max(a[0][0] - b[0][1], b[0][0] - a[0][1], 0); dy = max(a[1][0] - b[1][1], b[1][0] - a[1][1], 0); dz = max(a[2][0] - b[2][1], b[2][0] - a[2][1], 0)
    return (dx * dx + dy * dy + dz * dz) ** 0.5
yf = P.PANEL["y"][1]
box = lambda d: (d["x"], (yf, yf + d["y_thick"]), d["z"])
bat = (P.BATT["x"], P.BATT["y"], P.BATT["z"])
rows = [("battery to PDH", gap(bat, box(P.PDH))), ("battery to roboRIO", gap(bat, box(P.RIO))), ("PDH to roboRIO", gap(box(P.PDH), box(P.RIO))), ("PDH to radio", gap(box(P.PDH), box(P.RADIO))), ("PDH to breaker", gap(box(P.PDH), box(P.BREAKER)))]
for n, g in rows:
    print(f"  clearance {n}: {g:.2f} in")
rear_bumper_top = 7.5
print("panel bottom above bumper top:", P.PANEL['z'][0] - rear_bumper_top, "in (>=0.25 needed so components are not hidden by the bumper)")
sys.exit(1 if bad or ki else 0)
