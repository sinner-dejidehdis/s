#!/usr/bin/env python3
"""Generate a plan.json for an FRC roller intake (two side plates + rollers + shafts).

  python roller_intake.py --set inner_width=24 --set rollers='[[11,2],[5.5,4.5],[1,6]]' > plan.json

Coordinates: X = width (left-right), Y = front-back, Z = up-down. Rollers are [y, z] axis positions (in).
"""
import argparse
import json
import sys

DEFAULTS = {
    "tag": "intake",
    "inner_width": 24.0,        # 两侧板内侧距离
    "plate_thickness": 0.25,
    "plate_margin": 1.0,        # 滚轮外缘到板边
    "rollers": [[11, 2], [5.5, 4.5], [1, 6]],   # [y, z] 轴心
    "roller_diameter": 2.0,
    "shaft_diameter": 0.5,
    "shaft_overhang": 0.5,      # 轴伸出侧板外侧
    "roller_gap": 0.0625,       # 滚轮端面到侧板
    "pivot": [0, 0],            # 枢轴孔位置，None 则不开
    "pivot_diameter": 0.5,
}


def build(p):
    W, t = p["inner_width"], p["plate_thickness"]
    rd, sd = p["roller_diameter"] / 2, p["shaft_diameter"] / 2
    hole_r = sd + 0.008          # 轴孔间隙
    ys = [r[0] for r in p["rollers"]]
    zs = [r[1] for r in p["rollers"]]
    m = rd + p["plate_margin"]
    y0, y1, z0, z1 = min(ys) - m, max(ys) + m, min(zs) - m, max(zs) + m
    if p.get("pivot"):
        y0, y1 = min(y0, p["pivot"][0] - 1), max(y1, p["pivot"][0] + 1)
        z0, z1 = min(z0, p["pivot"][1] - 1), max(z1, p["pivot"][1] + 1)
    outline = [[y0, z0], [y1, z0], [y1, z1], [y0, z1]]
    holes = [{"kind": "circle", "center": r, "radius": hole_r} for r in p["rollers"]]
    if p.get("pivot"):
        holes.append({"kind": "circle", "center": p["pivot"], "radius": p["pivot_diameter"] / 2})

    L = W - 2 * p["roller_gap"]
    total = W + 2 * t + 2 * p["shaft_overhang"]
    steps = []
    # 侧板：左板 x∈[-W/2-t,-W/2]，右板 x∈[W/2,W/2+t]，草图在板的 -X 面上向 +X 拉伸
    for side, x in (("L", -W / 2 - t), ("R", W / 2)):
        steps += [
            {"type": "plane", "id": f"pl_plate{side}", "base": "Right", "offset": x, "name": f"Plate {side} plane"},
            {"type": "sketch", "id": f"sk_plate{side}", "plane": f"pl_plate{side}",
             "name": f"Plate {side} outline", "entities": [{"kind": "polygon", "points": outline}]},
            {"type": "extrude", "id": f"ex_plate{side}", "sketch": f"sk_plate{side}", "depth": t,
             "name": f"Plate {side}"},
            {"type": "sketch", "id": f"sk_holes{side}", "plane": f"pl_plate{side}",
             "name": f"Plate {side} holes", "entities": holes},
            {"type": "extrude", "id": f"ex_holes{side}", "sketch": f"sk_holes{side}", "depth": t,
             "op": "remove", "name": f"Plate {side} holes cut"},
        ]
    # 滚轮：实心圆柱 + 轴孔
    steps.append({"type": "plane", "id": "pl_roller", "base": "Right", "offset": -L / 2, "name": "Roller plane"})
    for i, (y, z) in enumerate(p["rollers"], 1):
        steps += [
            {"type": "sketch", "id": f"sk_roller{i}", "plane": "pl_roller", "name": f"Roller {i} sketch",
             "entities": [{"kind": "circle", "center": [y, z], "radius": rd}]},
            {"type": "extrude", "id": f"ex_roller{i}", "sketch": f"sk_roller{i}", "depth": L,
             "name": f"Roller {i}"},
            {"type": "sketch", "id": f"sk_bore{i}", "plane": "pl_roller", "name": f"Roller {i} bore sketch",
             "entities": [{"kind": "circle", "center": [y, z], "radius": sd}]},
            {"type": "extrude", "id": f"ex_bore{i}", "sketch": f"sk_bore{i}", "depth": L,
             "op": "remove", "name": f"Roller {i} bore"},
        ]
    # 轴：穿过侧板的独立零件
    steps.append({"type": "plane", "id": "pl_shaft", "base": "Right", "offset": -total / 2, "name": "Shaft plane"})
    for i, (y, z) in enumerate(p["rollers"], 1):
        steps += [
            {"type": "sketch", "id": f"sk_shaft{i}", "plane": "pl_shaft", "name": f"Shaft {i} sketch",
             "entities": [{"kind": "circle", "center": [y, z], "radius": sd}]},
            {"type": "extrude", "id": f"ex_shaft{i}", "sketch": f"sk_shaft{i}", "depth": total,
             "name": f"Shaft {i}"},
        ]
    return {"name": "roller_intake", "tag": p["tag"], "units": "in", "steps": steps,
            "expect": {"bbox_in": [W + 2 * t + 2 * p["shaft_overhang"], y1 - y0, z1 - z0]}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", default=[], metavar="KEY=VALUE")
    a = ap.parse_args()
    p = dict(DEFAULTS)
    for kv in a.set:
        k, v = kv.split("=", 1)
        if k not in DEFAULTS:
            sys.exit(f"未知参数 {k}，可用: {', '.join(DEFAULTS)}")
        try:
            p[k] = json.loads(v)
        except json.JSONDecodeError:
            p[k] = v
    json.dump(build(p), sys.stdout, indent=1)


if __name__ == "__main__":
    main()
