#!/usr/bin/env python3
"""Generate a plan.json for an FRC single-flywheel hooded shooter (two side plates, flywheel wheels on a shaft,
concentric hood, rear feed roller, tie rods).

  python shooter.py --set ball_diameter=5.9 --set hood_end=330 > plan.json

Coordinates: X = width (left-right), Y = forward, Z = up. Origin = flywheel axis. Side-plate sketch: x = Y, y = Z.
Geometry: a ball compressed by `compression` between the flywheel surface and a hood concentric with the flywheel
(hood inner radius = wheel radius + ball diameter - compression). It rides along the hood CCW (angle measured
from +Y toward +Z) and leaves tangentially: launch angle = hood_end - 270 deg.
"""
import argparse
import json
import math
import sys

DEFAULTS = {
    "tag": "shooter",
    "width": 8.0,              # 两侧板内侧距离
    "plate_thickness": 0.25,
    "ball_diameter": 5.9,      # 球直径（假设，按比赛改）
    "compression": 0.75,       # 球在飞轮和 hood 之间的压缩量
    "wheel_diameter": 4.0,     # 飞轮直径
    "wheel_width": 1.0,
    "n_wheels": 2,
    "wheel_pitch": 3.0,        # 飞轮中心距
    "shaft_diameter": 0.5,
    "hood_thickness": 0.125,
    "hood_start": 210.0,       # hood 圆弧起止角（度，从 +Y 向 +Z）
    "hood_end": 330.0,         # 发射角 = hood_end - 270
    "feed_roller_diameter": 2.0,
    "feed_angle": 195.0,       # 送球辊中心角度
    "shaft_overhang": 0.75,    # 轴伸出侧板外侧（装皮带轮/电机）
}

K = lambda deg: math.radians(deg)


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


def polar(r, deg, c=(0.0, 0.0)):
    return [c[0] + r * math.cos(K(deg)), c[1] + r * math.sin(K(deg))]


def build(p):
    W, t = p["width"], p["plate_thickness"]
    if W < p["ball_diameter"] + 0.5:
        sys.exit(f"width={W} 比球径 {p['ball_diameter']} 窄，球会卡在侧板上；至少 {p['ball_diameter'] + 0.5:.2f}")
    if not 0 < p["compression"] < p["ball_diameter"] / 2:
        sys.exit("compression 必须在 0 到球半径之间")
    chord = math.sqrt(2 * p["ball_diameter"] / 2 * p["compression"] - p["compression"] ** 2)   # 压缩接触区半宽
    for i in range(p["n_wheels"]):
        xc = (i - (p["n_wheels"] - 1) / 2) * p["wheel_pitch"]
        if abs(xc) - p["wheel_width"] / 2 >= chord:
            print(f"警告：飞轮 {i + 1}（x={xc:+.2f}）在球的接触区（半宽 {chord:.2f}）之外，碰不到球；"
                  f"减小 wheel_pitch 或 n_wheels", file=sys.stderr)
    rw, rs = p["wheel_diameter"] / 2, p["shaft_diameter"] / 2
    ball_r = p["ball_diameter"] / 2
    ht = p["hood_thickness"]
    hood_in = rw + p["ball_diameter"] - p["compression"]
    hood_out = hood_in + ht
    ball_c = hood_in - ball_r                       # 球心到飞轮轴的距离
    rr = p["feed_roller_diameter"] / 2
    feed_c = polar(hood_in + rr, p["feed_angle"])   # 送球辊表面与 hood 内面齐平
    R_s = hood_out + 0.6                             # 拉杆半径
    rod_r = 0.25
    R_out = R_s + rod_r + 0.5
    rods = [polar(R_s, a) for a in (205.0, 270.0, 335.0)]
    hole_r = rs + 0.01

    outline = hull([polar(R_out, a) for a in range(190, 341, 5)]
                   + [polar(rw + 0.75, a) for a in range(0, 360, 10)]
                   + [polar(rr + 0.75, a, feed_c) for a in range(0, 360, 15)])
    holes = [{"kind": "circle", "center": [0.0, 0.0], "radius": hole_r},
             {"kind": "circle", "center": feed_c, "radius": hole_r}] + \
            [{"kind": "circle", "center": c, "radius": rod_r + 0.01} for c in rods]

    steps, n = [], [0]
    planes = {}

    def plane(x, nm):
        key = round(x, 4)
        if key not in planes:
            pid = f"pl{len(planes)}"
            steps.append({"type": "plane", "id": pid, "base": "Right", "offset": x, "name": nm})
            planes[key] = pid
        return planes[key]

    def part(name, x0, entities, depth, hollow=False, **kw):
        n[0] += 1
        steps.append({"type": "sketch", "id": f"sk{n[0]}", "plane": plane(x0, f"Right {x0:+.3f}"), "name": f"{name} sketch",
                      "entities": entities})
        steps.append({"type": "extrude", "id": f"ex{n[0]}", "sketch": f"sk{n[0]}", "depth": depth, "name": name, **({"hollow": True} if hollow else {}), **kw})

    circ = lambda c, r: {"kind": "circle", "center": list(c), "radius": r}

    # side plates
    part("SHT-001 Plate L", -W / 2 - t, [{"kind": "polygon", "points": outline}] + holes, t, hollow=True)
    part("SHT-001 Plate R", W / 2, [{"kind": "polygon", "points": outline}] + holes, t, hollow=True)
    # flywheel shaft + wheels
    sl = W + 2 * t + 2 * p["shaft_overhang"]
    part("SHT-010 Flywheel shaft", -sl / 2, [circ((0, 0), rs)], sl)
    nw, pitch = p["n_wheels"], p["wheel_pitch"]
    for i in range(nw):
        xc = (i - (nw - 1) / 2) * pitch
        part(f"SHT-011 Flywheel {i + 1}", xc - p["wheel_width"] / 2, [circ((0, 0), rw), circ((0, 0), hole_r)],
             p["wheel_width"], hollow=True)
    # feed roller + shaft
    part("SHT-020 Feed shaft", -sl / 2, [circ(feed_c, rs)], sl)
    part("SHT-021 Feed roller", -W / 2 + 0.125, [circ(feed_c, rr), circ(feed_c, hole_r)], W - 0.25, hollow=True)
    # hood: band between plates
    a0, a1, step = p["hood_start"], p["hood_end"], 5.0
    nseg = max(2, int(round((a1 - a0) / step)))
    angs = [a0 + (a1 - a0) * i / nseg for i in range(nseg + 1)]
    k = 1.0 / math.cos(K((a1 - a0) / nseg / 2))        # 折线面外切于圆（顶点放大），球不会侵入平面
    band = [polar(hood_out * k, a) for a in angs] + [polar(hood_in * k, a) for a in reversed(angs)]
    part("SHT-030 Hood", -W / 2, [{"kind": "polygon", "points": band}], W)
    # tie rods through the plates
    for i, c in enumerate(rods, 1):
        part(f"SHT-040 Tie rod {i}", -W / 2 - t, [circ(c, rod_r)], W + 2 * t)

    launch = p["hood_end"] - 270.0
    info = {"hood_inner_radius_in": round(hood_in, 3), "ball_center_radius_in": round(ball_c, 3),
            "launch_angle_deg": round(launch, 1), "plate_size_in": [round(2 * R_out, 2), round(2 * R_out, 2)],
            "wheel_surface_speed_in_s_at_6000rpm": round(math.pi * p["wheel_diameter"] * 6000 / 60, 0),
            "note": "球出口速度约为轮面速度的 0.4–0.6 倍（经验值，需实测）"}
    return {"name": "shooter", "tag": p["tag"], "units": "in", "steps": steps, "info": info,
            "ball": {"diameter_in": p["ball_diameter"], "center_radius_in": ball_c,
                     "angles_deg": [a0 + 5.0, (a0 + a1) / 2, a1 - 5.0]}}


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
