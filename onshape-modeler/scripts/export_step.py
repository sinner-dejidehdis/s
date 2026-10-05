#!/usr/bin/env python3
"""Offline fallback (no Onshape API key): build a plan.json locally and export STEP.

  python export_step.py plan.json out.step        # then in Onshape: Part Studio -> Import / Insert -> upload out.step
Needs: pip install cadquery
Result is plain solids (no sketch/feature tree). Semantics match build.py: new/remove only.
"""
import json
import sys
from pathlib import Path

import cadquery as cq

M = {"in": 25.4, "mm": 1.0}  # export in mm
# name -> (xDir, normal) in world coords; sketch y = normal x xDir
BASES = {"Top": ((1, 0, 0), (0, 0, 1)), "Front": ((1, 0, 0), (0, -1, 0)), "Right": ((0, 1, 0), (1, 0, 0))}


def make_plane(planes, base, offset, k):
    if base in BASES:
        xd, n = BASES[base]
        origin = tuple(c * offset * k for c in n)
    else:
        xd, n, o = planes[base]
        origin = tuple(oc + nc * offset * k for oc, nc in zip(o, n))
        return (xd, n, origin)
    return (xd, n, origin)


def cq_plane(p):
    xd, n, o = p
    return cq.Plane(origin=o, xDir=xd, normal=n)


def sketch_solid(planes, step, depth, direction, k, hollow=False):
    pl = cq_plane(planes[step["plane"]])
    n = pl.zDir
    shift = {"normal": 0, "flip": -depth, "symmetric": -depth / 2}[direction]
    out = None
    for ent in step["entities"]:
        wp = cq.Workplane(pl).workplane(offset=shift)
        if ent["kind"] == "circle":
            w = wp.center(ent["center"][0] * k, ent["center"][1] * k).circle(ent["radius"] * k)
        else:
            pts = ent["points"] if ent["kind"] == "polygon" else _rect(ent)
            w = wp.polyline([(x * k, y * k) for x, y in pts]).close()
        s = w.extrude(depth)
        if out is None:
            out = s
        else:  # hollow: 第一个轮廓为外形，其余为内孔
            out = out.cut(s) if hollow else out.union(s)
    return out


def _rect(e):
    x, y = e["corner"]; w, h = e["size"]
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]


def build(plan):
    k = M[plan.get("units", "in")]
    planes, sketches, bodies = {}, {}, []   # bodies: [name, Workplane]
    for s in plan["steps"]:
        if s["type"] == "plane":
            planes[s["id"]] = make_plane(planes, s["base"], s["offset"], k)
        elif s["type"] == "sketch":
            sketches[s["id"]] = s
            if s["plane"] in BASES:
                planes.setdefault(s["plane"], make_plane(planes, s["plane"], 0, k))
        else:
            sk = sketches[s["sketch"]]
            solid = sketch_solid(planes, sk, s["depth"] * k, s.get("direction", "normal"), k, s.get("hollow", False))
            op = s.get("op", "new")
            if op == "new":
                bodies.append([s.get("name", s["id"]), solid])
            elif op == "remove":
                for b in bodies:
                    if b[1].intersect(solid).val().Volume() > 1e-6:
                        b[1] = b[1].cut(solid)
            else:
                raise SystemExit(f"export_step 只支持 op=new/remove，收到 {op}")
    return bodies


def main():
    plan = json.loads(Path(sys.argv[1]).read_text())
    bodies = build(plan)
    asm = cq.Assembly(name=plan.get("name", "model"))
    for name, wp in bodies:
        asm.add(wp, name=name)
    asm.save(sys.argv[2])
    bb = cq.Compound.makeCompound([b[1].val() for b in bodies]).BoundingBox()
    print(f"{len(bodies)} 个零件 -> {sys.argv[2]}")
    print("包围盒 (in): X=%.2f Y=%.2f Z=%.2f" % (bb.xlen / 25.4, bb.ylen / 25.4, bb.zlen / 25.4))


if __name__ == "__main__":
    main()
