#!/usr/bin/env python3
"""Generate a plan.json for an FRC single-flywheel hooded shooter: hulled side plates with lightening holes,
hex flywheel shaft on bearings, N flywheels, concentric hood, rear feed roller, tie rods, and a belt drive
(motor on an outboard motor plate; 1 or 2 motors).

  python shooter.py --set ball_diameter=5.9 --set hood_end=330 --set motors=2 > plan.json

Coordinates: X = width (left-right), Y = forward, Z = up. Origin = flywheel axis. Side-plate sketch: x = Y, y = Z.
Geometry: a ball compressed by `compression` between the flywheel surface and a hood concentric with the flywheel
(hood inner radius = wheel radius + ball diameter - compression). It rides along the hood CCW (angle measured
from +Y toward +Z) and leaves tangentially: launch angle = hood_end - 270 deg.
Drive (per motor side, outboard): [side plate][0.9" belt zone][1/4" motor plate][motor body].  The motor is an
envelope (cylinder), not the real CAD.
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
    "shaft_diameter": 0.5,     # hex 轴对边距 / 送球轴直径
    "hood_thickness": 0.125,
    "hood_start": 210.0,       # hood 圆弧起止角（度，从 +Y 向 +Z）
    "hood_end": 330.0,         # 发射角 = hood_end - 270
    "feed_roller_diameter": 2.0,
    "feed_angle": 195.0,       # 送球辊中心角度
    "motors": 1,               # 1 = 仅右侧有电机；2 = 两侧各一个
    "motor_teeth": 24,         # 电机带轮齿数（HTD5 9mm）
    "wheel_teeth": 24,         # 飞轮轴带轮齿数；比值 motor:wheel 决定增速
    "motor_angle": 240.0,      # 电机相对飞轮轴的方位角（度）
    "motor_free_rpm": 6000.0,
}

K = math.radians
HTD_P = 5 / 25.4
PUL_W, BELT_W = 0.45, 9 / 25.4
BEAR_R, ZB, MP_T = 0.5625, 0.9, 0.25            # 轴承外半径、带区宽度、电机板厚
MOTOR_R, MOTOR_L = 1.2, 2.5
RHO_AL = 0.0975                                  # lb/in^3，惯量估算按铝（保守偏大）


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


def polar(r, deg, c=(0.0, 0.0)):
    return [c[0] + r * math.cos(K(deg)), c[1] + r * math.sin(K(deg))]


def ring_pts(c, r, n=36):
    """圆的外切正 n 边形顶点，折线面不会侵入真圆"""
    r = r / math.cos(math.pi / n)
    return [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def build(p):
    W, t = p["width"], p["plate_thickness"]
    if W < p["ball_diameter"] + 0.5:
        sys.exit(f"width={W} 比球径 {p['ball_diameter']} 窄，球会卡在侧板上；至少 {p['ball_diameter'] + 0.5:.2f}")
    if not 0 < p["compression"] < p["ball_diameter"] / 2:
        sys.exit("compression 必须在 0 到球半径之间")
    if p["motors"] not in (1, 2):
        sys.exit("motors 只能是 1 或 2")
    chord = math.sqrt(2 * p["ball_diameter"] / 2 * p["compression"] - p["compression"] ** 2)   # 压缩接触区半宽
    for i in range(p["n_wheels"]):
        xc = (i - (p["n_wheels"] - 1) / 2) * p["wheel_pitch"]
        if abs(xc) - p["wheel_width"] / 2 >= chord:
            print(f"警告：飞轮 {i + 1}（x={xc:+.2f}）在球的接触区（半宽 {chord:.2f}）之外，碰不到球；"
                  f"减小 wheel_pitch 或 n_wheels", file=sys.stderr)

    rw = p["wheel_diameter"] / 2
    sr = p["shaft_diameter"] / 2                     # 送球轴半径、hex 对边距的一半
    hx = sr / math.cos(math.pi / 6) + 0.0            # hex 外接圆半径
    ht = p["hood_thickness"]
    hood_in = rw + p["ball_diameter"] - p["compression"]
    hood_out = hood_in + ht
    ball_c = hood_in - p["ball_diameter"] / 2
    rr = p["feed_roller_diameter"] / 2
    feed_c = polar(hood_in + rr, p["feed_angle"])
    R_s = hood_out + 0.6
    rod_r = 0.25
    R_out = R_s + rod_r + 0.5
    rods = [polar(R_s, a) for a in (205.0, 270.0, 335.0)]
    hole_r = sr + 0.01

    hexp = lambda c, r: [[round(c[0] + r * math.cos(math.pi / 3 * i), 5), round(c[1] + r * math.sin(math.pi / 3 * i), 5)]
                         for i in range(6)]
    circ = lambda c, r: {"kind": "circle", "center": [round(c[0], 5), round(c[1], 5)], "radius": r}
    poly = lambda pts_: {"kind": "polygon", "points": [[round(x, 5), round(y, 5)] for x, y in pts_]}
    HEXB = {"kind": "polygon", "points": hexp((0, 0), hx + 0.01)}          # hex 孔（飞轮/带轮/轴承）

    outline = hull([polar(R_out, a) for a in range(190, 341, 5)]
                   + [polar(rw + 0.75, a) for a in range(0, 360, 10)]
                   + [polar(rr + 0.75, a, feed_c) for a in range(0, 360, 15)])
    light = [circ(polar(4.8, a), 1.0) for a in (235.0, 270.0, 305.0)]          # 减重孔
    plate_holes = [circ((0, 0), BEAR_R), circ(feed_c, BEAR_R)] + [circ(c, rod_r + 0.01) for c in rods] + light

    # --- 传动几何（右侧；motors=2 时镜像）
    xo = W / 2 + t
    x_mp0, x_mp1 = xo + ZB, xo + ZB + MP_T
    x_b = xo + 0.15 + PUL_W / 2
    rF, rM = pd(p["wheel_teeth"]) / 2 - 0.05, pd(p["motor_teeth"]) / 2 - 0.05
    Cd = max(2.6, rF + rM + 0.7)
    M = polar(Cd, p["motor_angle"])
    mid = ((M[0]) / 2, M[1] / 2)
    dm = math.hypot(*M); perp = (-M[1] / dm, M[0] / dm)
    stand = [(mid[0] + perp[0] * 1.2, mid[1] + perp[1] * 1.2), (mid[0] - perp[0] * 1.2, mid[1] - perp[1] * 1.2)]
    mp_outline = hull(ring_pts((0, 0), 1.0) + ring_pts(M, 1.6) + [q for s in stand for q in ring_pts(s, 0.5)])

    steps, planes, cnt = [], {}, [0]

    def plane(x):
        key = round(x, 4)
        if key not in planes:
            planes[key] = f"pl{len(planes)}"
            steps.append({"type": "plane", "id": planes[key], "base": "Right", "offset": x, "name": f"Right {x:+.3f}"})
        return planes[key]

    def part(name, xa, xb, ents, hollow=False, sgn=1):
        lo, hi = sorted((sgn * xa, sgn * xb))
        cnt[0] += 1
        steps.append({"type": "sketch", "id": f"sk{cnt[0]}", "plane": plane(lo), "name": f"{name} sketch", "entities": ents})
        steps.append({"type": "extrude", "id": f"ex{cnt[0]}", "sketch": f"sk{cnt[0]}", "depth": hi - lo, "name": name,
                      **({"hollow": True} if hollow else {})})

    L, Rr = "L", "R"
    side_sgn = ((Rr, 1), (L, -1))
    # 侧板（两块相同）
    for sfx, sg in side_sgn:
        part(f"SHT-001 Plate {sfx}", W / 2, xo, [poly(outline)] + plate_holes, True, sg)

    # 轴
    motor_sides = [s for s in side_sgn if s[0] == Rr or p["motors"] == 2]
    x_right = x_mp1
    x_left = -x_mp1 if p["motors"] == 2 else -(xo + 0.5)
    part("SHT-010 Flywheel shaft (hex)", x_left, x_right, [poly(hexp((0, 0), hx))])
    nw, pitch = p["n_wheels"], p["wheel_pitch"]
    for i in range(nw):
        xc = (i - (nw - 1) / 2) * pitch
        part(f"SHT-011 Flywheel {i + 1}", xc - p["wheel_width"] / 2, xc + p["wheel_width"] / 2,
             [circ((0, 0), rw), HEXB], True)
    xs_ = xo + 0.5
    part("SHT-020 Feed shaft", -xs_, xs_, [circ(feed_c, sr)])
    part("SHT-021 Feed roller", -W / 2 + 0.125, W / 2 - 0.125, [circ(feed_c, rr), circ(feed_c, hole_r)], True)
    # 轴承（压入侧板；飞轮轴 hex 孔）
    for sfx, sg in side_sgn:
        part(f"SHT-012 Flywheel bearing {sfx}", W / 2, xo, [circ((0, 0), BEAR_R), HEXB], True, sg)
        part(f"SHT-022 Feed bearing {sfx}", W / 2, xo, [circ(feed_c, BEAR_R), circ(feed_c, hole_r)], True, sg)
    # hood
    a0, a1 = p["hood_start"], p["hood_end"]
    nseg = max(2, int(round((a1 - a0) / 5.0)))
    angs = [a0 + (a1 - a0) * i / nseg for i in range(nseg + 1)]
    k = 1.0 / math.cos(K((a1 - a0) / nseg / 2))        # 折线面外切于圆，球不会侵入平面
    band = [polar(hood_out * k, a) for a in angs] + [polar(hood_in * k, a) for a in reversed(angs)]
    part("SHT-030 Hood", -W / 2, W / 2, [poly(band)])
    for i, c in enumerate(rods, 1):
        part(f"SHT-040 Tie rod {i}", -xo, xo, [circ(c, rod_r)])

    # 传动
    belt_teeth = None
    for sfx, sg in motor_sides:
        part(f"SHT-050 Motor plate {sfx}", x_mp0, x_mp1,
             [poly(mp_outline), circ((0, 0), BEAR_R), circ(M, sr + 0.01)], True, sg)
        part(f"SHT-051 Motor plate bearing {sfx}", x_mp0, x_mp1, [circ((0, 0), BEAR_R), HEXB], True, sg)
        for j, s in enumerate(stand, 1):
            part(f"SHT-052 Standoff {sfx}{j}", xo, x_mp0, [circ(s, 0.2)], False, sg)
        part(f"SHT-060 Motor {sfx} (Kraken envelope)", x_mp1, x_mp1 + MOTOR_L, [circ(M, MOTOR_R)], False, sg)
        part(f"SHT-061 Motor shaft {sfx}", xo + 0.1, x_mp1, [circ(M, sr)], False, sg)
        part(f"SHT-062 Motor pulley {sfx}", x_b - PUL_W / 2, x_b + PUL_W / 2, [circ(M, rM), circ(M, sr + 0.01)], True, sg)
        part(f"SHT-063 Flywheel pulley {sfx}", x_b - PUL_W / 2, x_b + PUL_W / 2, [circ((0, 0), rF), HEXB], True, sg)
        outer = hull(ring_pts((0, 0), rF + 0.14) + ring_pts(M, rM + 0.14))
        inner = hull(ring_pts((0, 0), rF) + ring_pts(M, rM))
        part(f"SHT-064 Belt {sfx}", x_b - BELT_W / 2, x_b + BELT_W / 2, [poly(outer), poly(inner)], True, sg)
        belt_teeth = round((2 * Cd + math.pi * (rF + rM + 0.1) + (rF - rM) ** 2 / Cd) / HTD_P)

    # 转动惯量（飞轮 + 带轮 + 轴，按铝，保守）和储能
    ri_eq = hx
    I = 0.0
    for _ in range(nw):
        m = RHO_AL * math.pi * (rw ** 2 - ri_eq ** 2) * p["wheel_width"]; I += 0.5 * m * (rw ** 2 + ri_eq ** 2)
    for _ in motor_sides:
        m = RHO_AL * math.pi * (rF ** 2 - ri_eq ** 2) * PUL_W; I += 0.5 * m * (rF ** 2 + ri_eq ** 2)
    ratio = p["motor_teeth"] / p["wheel_teeth"]
    rpm = p["motor_free_rpm"] * ratio
    omega = rpm * 2 * math.pi / 60
    launch = p["hood_end"] - 270.0
    info = {"hood_inner_radius_in": round(hood_in, 3), "ball_center_radius_in": round(ball_c, 3),
            "launch_angle_deg": round(launch, 1), "plate_size_in": [round(2 * R_out, 2), round(2 * R_out, 2)],
            "motors": p["motors"], "drive_ratio_motor_to_wheel": round(ratio, 3),
            "flywheel_free_rpm": round(rpm), "wheel_surface_speed_in_s_free": round(math.pi * p["wheel_diameter"] * rpm / 60),
            "flywheel_inertia_lb_in2_aluminum_upper_bound": round(I, 3),
            "stored_energy_J_free": round(0.5 * (I * 0.000292641) * omega ** 2, 1),   # 1 lb·in² = 2.926e-4 kg·m²
            "belt_teeth_approx": belt_teeth,
            "note": "球出口速度约为轮面速度的 0.4–0.6 倍（经验值，需实测）；齿数/惯量是估算值"}
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
