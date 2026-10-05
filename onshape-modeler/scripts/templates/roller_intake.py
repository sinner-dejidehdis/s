#!/usr/bin/env python3
"""Generate a plan.json for an FRC roller intake: two hulled side plates with bearings, tube rollers on shafts,
HTD5 belt chain between rollers, a Kraken-class motor (envelope) driving the middle roller, tie rods, pivot hole.

  python roller_intake.py --set inner_width=24 --set rollers='[[11,2],[5.5,4.5],[1,6]]' > plan.json

Coordinates: X = width (left-right), Y = front-back, Z = up-down. Rollers are [y, z] axis positions (in).
Drive side = +X (right).  Motor body sits INSIDE the right plate below the roller line, its shaft goes through
the plate to a pulley outside.  Motor is an envelope (cylinder), not the real CAD.
"""
import argparse
import json
import math
import sys

DEFAULTS = {
    "tag": "intake",
    "inner_width": 24.0,        # 两侧板内侧距离
    "plate_thickness": 0.25,
    "plate_margin": 1.0,        # 滚轮外缘到板边
    "rollers": [[11, 2], [5.5, 4.5], [1, 6]],   # [y, z] 轴心，沿斜线从前到后
    "roller_diameter": 2.0,
    "shaft_diameter": 0.5,
    "roller_gap": 0.0625,       # 滚轮端面到侧板
    "pivot": [0, 0],            # 枢轴孔位置，None 则不开
    "pivot_diameter": 0.5,
    "ball_diameter": 5.9,       # 用于检查球能否同时压在相邻两个滚轮上（假设，按比赛改）
    "roller_teeth": 24,         # 滚轮带轮齿数（HTD5 9mm）
    "motor_teeth": 18,          # 电机带轮齿数
    "drive_roller": 1,          # 电机驱动哪个滚轮（下标）
    "motor": True,
}

HTD_P = 5 / 25.4
BEAR_R, BEAR_BORE = 0.5625, 0.26         # 法兰轴承外径/孔
MOTOR_R, MOTOR_L = 1.2, 2.5              # Kraken 包络
PUL_W, BELT_W = 0.45, 9 / 25.4


def pd(teeth):
    return teeth * HTD_P / math.pi


def hull(points):
    pts = sorted(set((round(x, 6), round(y, 6)) for x, y in points))
    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and ((out[-1][0] - out[-2][0]) * (p[1] - out[-2][1])
                                     - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0])) <= 0:
                out.pop()
            out.append(p)
        return out
    lo, hi = half(pts), half(reversed(pts))
    return [list(p) for p in lo[:-1] + hi[:-1]]


def ring_pts(c, r, n=36):
    """圆的外切正 n 边形顶点（顶点半径放大 1/cos(pi/n)），折线面不会侵入真圆"""
    r = r / math.cos(math.pi / n)
    return [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def build(p):
    W, t = p["inner_width"], p["plate_thickness"]
    rd, sr = p["roller_diameter"] / 2, p["shaft_diameter"] / 2
    R = [tuple(map(float, r)) for r in p["rollers"]]
    n = len(R)
    L = W - 2 * p["roller_gap"]
    xo = W / 2 + t                                   # 右板外表面
    plane_x = [xo + 0.15 + PUL_W / 2 + k * 0.5 for k in range(3)]   # 带平面 A、B（链带交替）、C（电机带）
    rr_p, rm_p = pd(p["roller_teeth"]) / 2 - 0.05, pd(p["motor_teeth"]) / 2 - 0.05   # 带轮本体（齿根）半径

    # 滚轮线方向、法向（朝下）
    d = (R[-1][0] - R[0][0], R[-1][1] - R[0][1]) if n > 1 else (1.0, 0.0)
    dl = math.hypot(*d); d = (d[0] / dl, d[1] / dl)
    nrm = (-d[1], d[0])
    if nrm[1] > 0:
        nrm = (-nrm[0], -nrm[1])

    # 电机位置：驱动滚轮下方，离所有滚轮轴 >= rd + 电机半径 + 间隙
    steps, planes, cnt = [], {}, [0]
    di = min(p["drive_roller"], n - 1)
    motor = None
    if p["motor"]:
        C = 2.8
        while True:
            m = (R[di][0] + nrm[0] * C, R[di][1] + nrm[1] * C)
            if all(math.dist(m, r) >= rd + MOTOR_R + 0.15 for r in R) and C >= rr_p + rm_p + 0.6:
                break
            C += 0.1
        motor = m

    # 拉杆：第一个、最后一个滚轮下方；若靠近电机/滚轮就沿滚轮线向外滑开
    rods = []
    for end, r in ((-1, R[0]), (1, R[-1])):
        for k in range(0, 40):
            s = k * 0.25 * end
            c = (r[0] + nrm[0] * (rd + 0.9) + d[0] * s, r[1] + nrm[1] * (rd + 0.9) + d[1] * s)
            if (not motor or math.dist(c, motor) >= MOTOR_R + 0.25 + 0.15) and \
                    all(math.dist(c, q) >= rd + 0.25 + 0.15 for q in R):
                break
        else:
            sys.exit("找不到避开电机的拉杆位置：把 motor 设为 false 或换 drive_roller")
        rods.append(c)
    rod_r = 0.25

    pts = []
    for r in R:
        pts += ring_pts(r, rd + p["plate_margin"])
    if p.get("pivot"):
        pts += ring_pts(p["pivot"], 1.0)
    for c in rods:
        pts += ring_pts(c, 0.75)
    outline = hull(pts)

    holes_common = [{"kind": "circle", "center": list(r), "radius": BEAR_R} for r in R]
    if p.get("pivot"):
        holes_common.append({"kind": "circle", "center": list(p["pivot"]), "radius": p["pivot_diameter"] / 2 + 0.008})
    holes_common += [{"kind": "circle", "center": list(c), "radius": rod_r + 0.01} for c in rods]
    for a, b in zip(R, R[1:]):                      # 相邻滚轮之间的减重孔
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        free = math.dist(a, b) / 2 - BEAR_R - 0.35
        if free >= 0.5:
            holes_common.append({"kind": "circle", "center": [round(v, 5) for v in mid], "radius": round(min(1.0, free), 4)})
    holes_R = holes_common + ([{"kind": "circle", "center": list(motor), "radius": BEAR_BORE}] if motor else [])

    def plane(x):
        key = round(x, 4)
        if key not in planes:
            planes[key] = f"pl{len(planes)}"
            steps.append({"type": "plane", "id": planes[key], "base": "Right", "offset": x, "name": f"Right {x:+.3f}"})
        return planes[key]

    def part(name, x0, ents, depth, hollow=False):
        cnt[0] += 1
        steps.append({"type": "sketch", "id": f"sk{cnt[0]}", "plane": plane(x0), "name": f"{name} sketch", "entities": ents})
        steps.append({"type": "extrude", "id": f"ex{cnt[0]}", "sketch": f"sk{cnt[0]}", "depth": depth, "name": name,
                      **({"hollow": True} if hollow else {})})

    circ = lambda c, r: {"kind": "circle", "center": [round(c[0], 5), round(c[1], 5)], "radius": r}
    poly = lambda pts_: {"kind": "polygon", "points": [[round(x, 5), round(y, 5)] for x, y in pts_]}

    part("INT-001 Plate L", -W / 2 - t, [poly(outline)] + holes_common, t, hollow=True)
    part("INT-001 Plate R", W / 2, [poly(outline)] + holes_R, t, hollow=True)

    xl, xr = -(W / 2 + t + 0.5), plane_x[2] + PUL_W / 2 + 0.2     # 轴两端
    for i, c in enumerate(R, 1):
        part(f"INT-010 Roller {i}", -L / 2, [circ(c, rd), circ(c, sr + 0.01)], L, hollow=True)
        part(f"INT-011 Shaft {i}", xl, [circ(c, sr)], xr - xl)
        part(f"INT-012 Bearing {i} L", -W / 2 - t, [circ(c, BEAR_R), circ(c, BEAR_BORE)], t, hollow=True)
        part(f"INT-012 Bearing {i} R", W / 2, [circ(c, BEAR_R), circ(c, BEAR_BORE)], t, hollow=True)
        need = set()
        if i >= 2: need.add((i - 2) % 2)                 # 与上一个滚轮之间的带
        if i <= n - 1: need.add((i - 1) % 2)             # 与下一个滚轮之间的带
        if p["motor"] and i - 1 == di: need.add(2)
        for k in sorted(need):
            part(f"INT-020 Roller pulley {i}{'ABC'[k]}", plane_x[k] - PUL_W / 2, [circ(c, rr_p), circ(c, sr + 0.01)], PUL_W,
                 hollow=True)

    def belt(name, c1, r1, c2, r2, xc):
        outer = hull(ring_pts(c1, r1 + 0.14) + ring_pts(c2, r2 + 0.14))
        inner = hull(ring_pts(c1, r1) + ring_pts(c2, r2))
        part(name, xc - BELT_W / 2, [poly(outer), poly(inner)], BELT_W, hollow=True)
        # 近似节线长度 -> 齿数
        return (2 * math.dist(c1, c2) + math.pi * (r1 + r2 + 0.1) + ((r1 - r2) ** 2) / math.dist(c1, c2)) / HTD_P

    teeth = {}
    for i in range(n - 1):
        teeth[f"belt {i + 1}-{i + 2}"] = round(belt(f"INT-021 Belt {i + 1}-{i + 2}", R[i], rr_p, R[i + 1], rr_p,
                                                    plane_x[i % 2]))
    if motor:
        part("INT-030 Motor (Kraken envelope)", W / 2 - MOTOR_L, [circ(motor, MOTOR_R)], MOTOR_L)
        part("INT-031 Motor shaft", W / 2, [circ(motor, sr)], plane_x[2] + PUL_W / 2 + 0.1 - W / 2)
        part("INT-032 Motor pulley", plane_x[2] - PUL_W / 2, [circ(motor, rm_p), circ(motor, sr + 0.01)], PUL_W, hollow=True)
        teeth["motor belt"] = round(belt("INT-033 Motor belt", motor, rm_p, R[di], rr_p, plane_x[2]))
    for i, c in enumerate(rods, 1):
        part(f"INT-040 Tie rod {i}", -W / 2 - t, [circ(c, rod_r)], W + 2 * t)

    ratio = p["motor_teeth"] / p["roller_teeth"] if motor else None
    info = {"roller_pitch_in": [round(math.dist(a, b), 3) for a, b in zip(R, R[1:])],
            "belt_teeth_approx": teeth,
            "note_belts": "齿数是按几何估算的近似值；真实 HTD5 皮带只有标准齿数，需调电机位置或加张紧",
            "roller_rpm_free": round(6000 * ratio) if ratio else None,
            "roller_surface_speed_in_s_free": round(math.pi * p["roller_diameter"] * 6000 * ratio / 60) if ratio else None,
            "motor_center_yz": [round(v, 3) for v in motor] if motor else None}
    return {"name": "roller_intake", "tag": p["tag"], "units": "in", "steps": steps, "info": info,
            "ball": {"diameter_in": p["ball_diameter"], "rollers": [list(r) for r in R], "roller_radius_in": rd,
                     "up": [-nrm[0], -nrm[1]]}}


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
