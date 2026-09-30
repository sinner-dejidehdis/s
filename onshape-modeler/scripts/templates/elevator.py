#!/usr/bin/env python3
"""Generate a plan.json for an FRC 2-stage continuous elevator (in-line 2x1 tubes, belt in tube).

  python elevator.py --set travel=52 --set width=18 --set extension=1 > plan.json

参考 254 2025 Undertow：2 级、continuous 连续绳法、2x1x1/16" 方管 + 轴承块、HTD5 皮带走管内、
2 个 Kraken X60 经 11:50 驱动 36T 皮带轮当卷筒、~52" 行程。本模板的改进见 SKILL.md。

Coordinates: X = width (left-right), Y = front-back (carriage faces -Y), Z = up.
Stages nest inward in X (stage 0 outside, carriage inside); stage 0 tubes at y ∈ [0, 2], each inner
stage steps 1/8" forward so moving tubes never rub the crossbars behind them.
Crossbars of stage 0 and stage 1 sit behind the tubes (y ∈ [2, 3]); stage 1's crossbars are always
above stage 0's, so they never pass each other. Carriage plate is in front (y < 0), nothing else is.
"""
import argparse
import json
import math
import sys

DEFAULTS = {
    "tag": "elevator",
    "width": 18.0,              # stage 0 立柱外侧宽度（X）
    "base_height": 38.0,        # stage 0 立柱高度
    "travel": 52.0,             # 总行程（254 2025 ≈ 52"）
    "carriage_length": 8.0,     # carriage 立管长度
    "min_overlap": 8.0,         # 满伸出时相邻两级最少重叠（刚度）
    "bearing_gap": 0.25,        # 相邻两级之间放轴承块的间隙（X）
    "wall_base": 0.125,         # stage 0 管壁（改进：固定级加厚更刚，不增加运动质量）
    "wall_moving": 0.0625,      # 运动级管壁（与 254 相同 1/16"）
    "extension": 0.0,           # 显示姿态 0=收起 1=全伸出（连续绳法：carriage 先走，stage 1 后走）
    "aframe": True,             # 后斜撑（A 字架）
    "aframe_height": 0.6,       # 斜撑上端高度 = base_height × 该比例
    "aframe_run": 12.0,         # 斜撑下端向后伸出（Y）
    "drum_pd": 2.256,           # 36T HTD5 节圆直径
    "shaft_diameter": 0.5,
    "plate_thickness": 0.25,
}

TUBE_X, TUBE_Y, BAR_Z = 1.0, 2.0, 2.0   # 2x1 管：立管 1"(X)×2"(Y)；横梁竖放 1"(Y)×2"(Z)
CLEAR = 0.25
STEP_Y = 0.125   # 每一级向前（-Y）错开，运动级的背面不会贴着上一级横梁的前面滑


class Plan:
    def __init__(self, tag):
        self.steps, self.planes, self.boxes = [], {}, []

    def plane(self, base, offset):
        key = (base, round(offset, 4))
        if key not in self.planes:
            pid = f"pl{len(self.planes)}"
            self.steps.append({"type": "plane", "id": pid, "base": base, "offset": offset,
                               "name": f"{base} {offset:+.3f}"})
            self.planes[key] = pid
        return self.planes[key]

    def part(self, name, base, offset, entities, depth, box, hollow=False):
        sid = f"sk{len(self.steps)}"
        self.steps += [
            {"type": "sketch", "id": sid, "plane": self.plane(base, offset), "name": f"{name} sketch",
             "entities": entities},
            {"type": "extrude", "id": f"ex{len(self.steps)}", "sketch": sid, "depth": depth, "name": name,
             **({"hollow": True} if hollow else {})},
        ]
        self.boxes.append((name, box))

    def vtube(self, name, x0, z0, length, wall, y0=0.0):
        """立管：截面 x∈[x0,x0+1], y∈[y0,y0+2]，从 z0 向上。"""
        rects = [{"kind": "rect", "corner": [x0, y0], "size": [TUBE_X, TUBE_Y]},
                 {"kind": "rect", "corner": [x0 + wall, y0 + wall], "size": [TUBE_X - 2 * wall, TUBE_Y - 2 * wall]}]
        self.part(name, "Top", z0, rects, length, [[x0, x0 + TUBE_X], [y0, y0 + TUBE_Y], [z0, z0 + length]], True)

    def crossbar(self, name, half, z0, wall, y0=TUBE_Y):
        """横梁：x∈[-half,half]，截面 y∈[y0,y0+1], z∈[z0,z0+2]。"""
        rects = [{"kind": "rect", "corner": [y0, z0], "size": [1.0, BAR_Z]},
                 {"kind": "rect", "corner": [y0 + wall, z0 + wall], "size": [1.0 - 2 * wall, BAR_Z - 2 * wall]}]
        self.part(name, "Right", -half, rects, 2 * half, [[-half, half], [y0, y0 + 1], [z0, z0 + BAR_Z]], True)


def build(p):
    W, H0, T, Lc = p["width"], p["base_height"], p["travel"], p["carriage_length"]
    g, w0, w1 = p["bearing_gap"], p["wall_base"], p["wall_moving"]
    # 三级立管外侧 x
    x0 = W / 2
    x1 = x0 - TUBE_X - g
    x2 = x1 - TUBE_X - g
    if x2 - TUBE_X < 1.0:
        sys.exit(f"width={W} 太窄：carriage 立管之间只剩 {2 * (x2 - TUBE_X):.2f}\"")

    # stage 1：底横梁在 stage 0 底横梁之上，顶横梁在 stage 0 顶横梁之上
    zb1 = BAR_Z + CLEAR
    H1 = H0 + BAR_Z + CLEAR - zb1          # 使 stage 1 顶横梁下沿 = H0 + CLEAR
    t1_max = min(H0 - zb1 - p["min_overlap"],               # 两级重叠
                 H0 - BAR_Z - CLEAR - (zb1 + BAR_Z))         # stage1 底横梁碰不到 stage0 顶横梁
    t2_max = H1 - Lc - p["min_overlap"] / 2                  # carriage 轴承块留在 stage 1 内
    t2 = min(T, t2_max)
    t1 = T - t2
    if t1 > t1_max:
        sys.exit(f"travel={T} 超出最大行程 {t1_max + t2_max:.2f}\"：加大 base_height 或减小 min_overlap")

    s = max(0.0, min(1.0, p["extension"])) * T
    d1 = max(0.0, s - t2)              # stage 1 升高
    dc = d1 + min(s, t2)               # carriage 升高（世界坐标）

    P = Plan(p["tag"])
    # ---- stage 0（固定）
    for side, sx in (("L", -1), ("R", 1)):
        xa = x0 - TUBE_X if sx > 0 else -x0
        P.vtube(f"S0 upright {side}", xa, 0.0, H0, w0)
    P.crossbar("S0 bottom bar", x0 - TUBE_X, 0.0, w0)
    P.crossbar("S0 top bar", x0 - TUBE_X, H0 - BAR_Z, w0)
    # ---- stage 1
    for side, sx in (("L", -1), ("R", 1)):
        xa = x1 - TUBE_X if sx > 0 else -x1
        P.vtube(f"S1 tube {side}", xa, zb1 + d1, H1, w1, -STEP_Y)
    P.crossbar("S1 bottom bar", x1 - TUBE_X, zb1 + d1, w1, TUBE_Y - STEP_Y)
    P.crossbar("S1 top bar", x1 - TUBE_X, zb1 + d1 + H1 - BAR_Z, w1, TUBE_Y - STEP_Y)
    # ---- carriage
    zc = zb1 + dc
    for side, sx in (("L", -1), ("R", 1)):
        xa = x2 - TUBE_X if sx > 0 else -x2
        P.vtube(f"Carriage tube {side}", xa, zc, Lc, w1, -2 * STEP_Y)
    pt = p["plate_thickness"]
    P.part("Carriage plate", "Front", 2 * STEP_Y, [{"kind": "rect", "corner": [-x2, zc], "size": [2 * x2, Lc]}],
           pt, [[-x2, x2], [-2 * STEP_Y - pt, -2 * STEP_Y], [zc, zc + Lc]])

    # ---- 驱动：两侧轴承板 + 卷筒轴 + 两个 36T 卷筒（在 stage 0 后方）
    r_d = p["drum_pd"] / 2
    ay, az = TUBE_Y + 1.0 + CLEAR + r_d, BAR_Z + CLEAR + r_d + 0.25   # 卷筒中心在底横梁后上方
    ply, plz = ay + r_d + 0.75, az + r_d + 0.75
    hole = p["shaft_diameter"] / 2 + 0.008
    for side, xa in (("L", -x0 - pt), ("R", x0)):
        P.part(f"Drive plate {side}", "Right", xa,
               [{"kind": "polygon", "points": [[0, 0], [ply, 0], [ply, plz], [0, plz]]},
                {"kind": "circle", "center": [ay, az], "radius": hole}],
               pt, [[xa, xa + pt], [0, ply], [0, plz]], True)
    sl = W + 2 * pt + 1.0
    P.part("Drum shaft", "Right", -sl / 2, [{"kind": "circle", "center": [ay, az], "radius": p["shaft_diameter"] / 2}],
           sl, [[-sl / 2, sl / 2], [ay - 0.25, ay + 0.25], [az - 0.25, az + 0.25]])
    for side, xa in (("L", -(x0 - TUBE_X - CLEAR)), ("R", x0 - TUBE_X - CLEAR - 1.0)):
        P.part(f"Drum {side}", "Right", xa,
               [{"kind": "circle", "center": [ay, az], "radius": r_d},
                {"kind": "circle", "center": [ay, az], "radius": hole}],
               1.0, [[xa, xa + 1.0], [ay - r_d, ay + r_d], [az - r_d, az + r_d]], True)

    # ---- A 字斜撑（1x1，简化为实心），立柱背面 → 后下方
    if p["aframe"]:
        zt, run = H0 * p["aframe_height"], p["aframe_run"]
        L = math.hypot(run, zt)
        dz, dy = L / run, L / zt           # 垂直 / 水平切口长度，使斜撑法向厚度 = 1"
        pts = [[TUBE_Y, zt], [TUBE_Y + run, 0], [TUBE_Y + run - dy, 0], [TUBE_Y, zt - dz]]
        for side, xa in (("L", -x0), ("R", x0 - TUBE_X)):
            P.part(f"A-frame {side}", "Right", xa, [{"kind": "polygon", "points": pts}], TUBE_X,
                   [[xa, xa + TUBE_X], [TUBE_Y, TUBE_Y + run], [0, zt]])

    lo = [min(b[1][i][0] for b in P.boxes) for i in range(3)]
    hi = [max(b[1][i][1] for b in P.boxes) for i in range(3)]
    info = {"stage1_travel": round(t1, 3), "carriage_travel": round(t2, 3),
            "max_travel": round(t1_max + t2_max, 3),
            "overlap_at_full": round(H0 - (zb1 + t1), 3),
            "carriage_bottom_z": {"stowed": round(zb1, 3), "full": round(zb1 + T, 3)}}
    return {"name": "elevator", "tag": p["tag"], "units": "in", "steps": P.steps, "info": info,
            "expect": {"bbox_in": [round(h - l, 4) for l, h in zip(lo, hi)]}}


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
