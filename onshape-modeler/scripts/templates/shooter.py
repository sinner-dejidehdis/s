#!/usr/bin/env python3
"""FRC single-flywheel hooded shooter, buildable version (same style as elevator.py): Part Studio (custom parts with
real holes) + Assembly (flanged half-hex bearings, 12T/24T HTD5 pulleys, Kraken X60, 10-32 hardware), BOM-ready.

  python shooter.py > plan.json
  python build.py plan.json --url <Part Studio URL> --replace        # 建零件 + 装配
  python export_step.py plan.json out.step                            # 没有 API 密钥时：导出自制件
  python plan_bom.py plan.json ; python plan_dxf.py plan.json dxf/    # BOM / 侧板、电机板 DXF

World: X = left/right (width), Y = forward, Z = up; origin = flywheel axis. Side-plate sketch: x = Y, y = Z.
Ball path: squeezed `compression` between the flywheel tires and a hood concentric with the flywheel
(hood inner radius = wheel radius + ball diameter - compression); rides CCW (angle from +Y toward +Z), leaves
tangentially: launch angle = hood_end - 270 deg.
Build: two 1/4" 6061 side plates with 1.125" bearing bores and a tab-and-slot arc for the 1/16" hood sheet (tabs
pass through the plates), three 1x1x1/16" cross tubes with plugs + 10-32 bolts, 1/2" hex flywheel shaft with
hub+urethane-tire wheels and shaft collars, an idler entry roller, and an outboard motor plate per motor side:
[side plate][0.8" belt zone][1/4" motor plate][Kraken], 12T motor pulley -> 24T/36T flywheel pulley (integer-tooth
HTD5 9mm belt).  cots.json only has a Falcon-bore 12T pulley, so the drive is a REDUCTION (flywheel slower than the
motor); use a larger wheel_diameter for speed.
"""
import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import elevator as EL
from _common import HTD_P, center_for_teeth, hexpts, hull, pd, ring_pts

DEFAULTS = {
    "tag": "shooter",
    "width": 8.0,              # 两侧板内侧距离
    "ball_diameter": 5.9,      # 球直径（假设，按比赛改）
    "compression": 0.5,        # 球在飞轮和 hood 之间的压缩量（254 2017：5.5" 球 0.5" 最优，约 9%）
    "wheel_diameter": 4.0,     # 飞轮直径
    "wheel_width": 1.0,
    "n_wheels": 2,
    "wheel_pitch": 3.0,        # 飞轮中心距
    "hood_thickness": 0.0625,
    "hood_start": 210.0,       # hood 圆弧起止角（度，从 +Y 向 +Z）
    "hood_end": 315.0,         # 发射角 = hood_end - 270（默认 45°）
    "feed_roller_diameter": 2.0,
    "feed_angle": 195.0,       # 入口辊中心角度
    "hood_strip": 0.0625,      # hood 内侧聚氨酯条厚度（254 2017：贴聚氨酯条提高压缩和抓力）；0 = 不加
    "inertia_discs": 1,        # 每侧飞轮组外侧加 1 个钢质惯量盘（254 2017 钢飞轮约 4 lb·in²）；0 = 不加
    "motors": 1,               # 1 = 仅右侧；2 = 两侧各一个
    "wheel_teeth": 24,         # 飞轮轴带轮齿数：24 或 36（COTS 只有这两种 hex 孔带轮）
    "motor_angle": 240.0,      # 电机相对飞轮轴的方位角（度）
    "motor_free_rpm": 6000.0,
}

PLATE_T, WALL, BORE_D, BOLT_D = EL.PLATE_T, EL.WALL, EL.BORE_D, EL.BOLT_D
HEX_AF = 0.5
HX = HEX_AF / 2 / math.cos(math.pi / 6)
PUL_HALF, FLANGE = 0.285, 0.063
MP_T, ZB = 0.25, 0.8                  # 电机板厚、带区宽度
MOTOR_R = 1.2
PLUG_L = 1.5


def circ(c, r):
    return {"kind": "circle", "center": [round(c[0], 5), round(c[1], 5)], "radius": round(r, 5)}


def poly(pts):
    return {"kind": "polygon", "points": [[round(x, 5), round(y, 5)] for x, y in pts]}


def polar(r, deg, c=(0.0, 0.0)):
    a = math.radians(deg)
    return [c[0] + r * math.cos(a), c[1] + r * math.sin(a)]


def build(p):
    W = p["width"]
    if W < p["ball_diameter"] + 0.5:
        sys.exit(f"width={W} 比球径 {p['ball_diameter']} 窄，球会卡在侧板上；至少 {p['ball_diameter'] + 0.5:.2f}")
    if not 0 < p["compression"] < p["ball_diameter"] / 2:
        sys.exit("compression 必须在 0 到球半径之间")
    if p["motors"] not in (1, 2):
        sys.exit("motors 只能是 1 或 2")
    if p["wheel_teeth"] not in (24, 36):
        sys.exit("wheel_teeth 只能是 24 或 36（cots.json 里只有这两种 hex 孔带轮）")
    chord = math.sqrt(2 * p["ball_diameter"] / 2 * p["compression"] - p["compression"] ** 2)
    for i in range(p["n_wheels"]):
        xc = (i - (p["n_wheels"] - 1) / 2) * p["wheel_pitch"]
        if abs(xc) - p["wheel_width"] / 2 >= chord:
            print(f"警告：飞轮 {i + 1}（x={xc:+.2f}）在球的接触区（半宽 {chord:.2f}）之外，碰不到球；"
                  f"减小 wheel_pitch 或 n_wheels", file=sys.stderr)

    x0 = W / 2                       # 侧板内表面
    xo = x0 + PLATE_T                # 侧板外表面
    rw = p["wheel_diameter"] / 2
    ht = p["hood_thickness"]
    st = p["hood_strip"]
    hood_in = rw + p["ball_diameter"] - p["compression"]      # 球接触面半径（聚氨酯条表面）
    hood_sheet = hood_in + st                                  # hood 板内表面
    hood_out = hood_sheet + ht
    ball_c = hood_in - p["ball_diameter"] / 2
    rr = p["feed_roller_diameter"] / 2
    feed_c = polar(hood_in + rr, p["feed_angle"])
    R_s = hood_out + 0.9
    tubes = [polar(R_s, a) for a in (225.0, 270.0, 315.0)]
    nw, pitch, ww = p["n_wheels"], p["wheel_pitch"], p["wheel_width"]

    # --- 传动几何
    TW, TM = p["wheel_teeth"], 12
    D, d = pd(TW), pd(TM)
    for T in range(30, 120):
        try:
            Cd = center_for_teeth(T, D, d)
        except ValueError:
            continue                              # 齿数太少，两个带轮会重叠
        if Cd >= MOTOR_R + 0.625 + 0.25:          # Kraken 本体 vs 电机板上的轴承法兰
            belt_T = T
            break
    else:
        sys.exit("找不到合适的皮带齿数")
    M = polar(Cd, p["motor_angle"])
    x_mp0, x_mp1 = xo + ZB, xo + ZB + MP_T
    x_b = x_mp1 - 0.648                           # 带轮中心：距 Kraken 安装面 0.648"（与 elevator 一致）
    mid = (M[0] / 2, M[1] / 2); dm = math.hypot(*M); perp = (-M[1] / dm, M[0] / dm)
    stand = [(mid[0] + perp[0] * 1.2, mid[1] + perp[1] * 1.2), (mid[0] - perp[0] * 1.2, mid[1] - perp[1] * 1.2)]
    kr = [(M[0] - 1, M[1]), (M[0] + 1, M[1]), (M[0], M[1] - 1), (M[0], M[1] + 1)]

    # --- 侧板：轮廓、孔、hood 槽
    a0, a1 = p["hood_start"], p["hood_end"]
    nseg = max(2, int(round((a1 - a0) / 5.0)))
    angs = [a0 + (a1 - a0) * i / nseg for i in range(nseg + 1)]
    kfac = 1.0 / math.cos(math.radians((a1 - a0) / nseg / 2))     # 折线面外切于圆
    band = [polar(hood_out * kfac, a) for a in angs] + [polar(hood_sheet * kfac, a) for a in reversed(angs)]
    slot = [polar((hood_out + 0.01) * kfac, a) for a in angs] + [polar((hood_sheet - 0.01) * kfac, a) for a in reversed(angs)]
    strip_band = [polar(hood_sheet * kfac, a) for a in angs] + [polar(hood_in * kfac, a) for a in reversed(angs)]

    pts = [q for a in angs for q in [polar(hood_out + 0.6, a)]]
    for c in tubes:
        pts += ring_pts(c, 1.3)
    pts += ring_pts((0, 0), rw + 0.75) + ring_pts(feed_c, rr + 0.75)
    outline = hull(pts)
    tb = lambda c: [c]                                           # 横管：每端 1 个螺栓（管中心）
    light = [circ(polar(4.8, a), 1.0) for a in (235.0, 270.0, 305.0)]
    common = [circ((0, 0), BORE_D / 2), circ(feed_c, BORE_D / 2), poly(slot)] + light
    for c in tubes:
        common.append(circ(c, BOLT_D / 2))
    stand_holes = [circ(s, BOLT_D / 2) for s in stand]
    motor_sides = (1,) if p["motors"] == 1 else (-1, 1)

    P = EL.Plan()
    FR, FW, EN, MO, BE = "frame", "flywheel", "entry", "motor", "belts"
    MAT = "6061-T6 1/4in plate"
    for sd, sfx in ((-1, "L"), (1, "R")):
        holes = common + (stand_holes if sd in motor_sides else [])
        P.part(f"SHT-001 Side plate {sfx}", FR, "Right", -xo if sd < 0 else x0, [poly(outline)] + holes, PLATE_T,
               material=MAT, flat=True)

    # 横管 + 塞子（1x1x1/16"，每端 1 颗 10-32 x 1.5"）
    for i, c in enumerate(tubes, 1):
        rects = [{"kind": "rect", "corner": [c[0] - 0.5, c[1] - 0.5], "size": [1.0, 1.0]},
                 {"kind": "rect", "corner": [c[0] - 0.5 + WALL, c[1] - 0.5 + WALL], "size": [1.0 - 2 * WALL, 1.0 - 2 * WALL]}]
        P.part(f"SHT-002 Cross tube {i}", FR, "Right", -x0, rects, W, material="6061 tube 1x1x0.0625 wall")
        for sd, sfx in ((-1, "L"), (1, "R")):
            xa, xb = sorted((sd * x0, sd * (x0 - PLUG_L)))
            P.xblock(f"SHT-003 Tube plug {i}{sfx}", FR, xa, xb, c[0] - 0.5 + WALL, c[1] - 0.5 + WALL, 1.0 - 2 * WALL,
                     1.0 - 2 * WALL, holes=[circ(c, BOLT_D / 2)])
            P.bolt(1.5, FR, [sd * xo, c[0], c[1]], [-sd, 0, 0], nut=False)

    # hood：1/16" 板，凸片穿过侧板槽
    P.part("SHT-030 Hood (1/16in sheet, rolled)", FR, "Right", -xo, [poly(band)], 2 * xo, hollow=False,
           material="6061 sheet 0.0625")
    if st > 0:
        for i in range(nw):
            xc = (i - (nw - 1) / 2) * pitch
            P.part(f"SHT-031 Hood strip {i + 1}", FR, "Right", xc - ww / 2, [poly(strip_band)], ww, hollow=False,
                   material="urethane strip 1.0 x {:.4f} (bond to hood)".format(st))

    # 飞轮：hex 轴 + hub + 聚氨酯轮胎 + 轴环
    sh_r = x_mp1 + FLANGE + 0.15 if p["motors"] >= 1 else xo + FLANGE + 0.15
    sh_l = -(x_mp1 + FLANGE + 0.15) if p["motors"] == 2 else -(xo + FLANGE + 0.15)
    P.part("SHT-010 Flywheel hex shaft", FW, "Right", sh_l, [poly(hexpts((0, 0), HX))], sh_r - sh_l, hollow=False,
           material="7075 1/2in hex bar")
    for i in range(nw):
        xc = (i - (nw - 1) / 2) * pitch
        P.part(f"SHT-011 Flywheel {i + 1} hub", FW, "Right", xc - ww / 2, [circ((0, 0), 1.0), poly(hexpts((0, 0), HX + 0.005))],
               ww, material="6061 round 2.000 OD, 1/2in hex bore")
        P.part(f"SHT-011 Flywheel {i + 1} tire", FW, "Right", xc - ww / 2, [circ((0, 0), rw), circ((0, 0), 1.0)], ww,
               material="urethane tire 2.0 ID x {:.2f} OD".format(p["wheel_diameter"]))
    edge = (nw - 1) / 2 * pitch + ww / 2
    disc_t, disc_r = 0.5, 1.75
    for sd, sfx in ((-1, "L"), (1, "R")):
        if p["inertia_discs"]:
            xa, xb = sorted((sd * edge, sd * (edge + disc_t)))
            P.part(f"SHT-014 Inertia disc {sfx}", FW, "Right", xa, [circ((0, 0), disc_r), poly(hexpts((0, 0), HX + 0.005))],
                   xb - xa, material="1018 steel round 3.5 OD x 0.5, 1/2in hex bore")
        c0 = edge + (disc_t if p["inertia_discs"] else 0.0)
        xa, xb = sorted((sd * c0, sd * (c0 + 0.3)))
        P.part(f"SHT-012 Shaft collar {sfx}", FW, "Right", xa, [circ((0, 0), 0.5), poly(hexpts((0, 0), HX + 0.005))], xb - xa,
               material="6061 round 1.0 OD, 1/2in hex bore")
        P.place("bearing_flanged_half_hex", FR, [sd * x0, 0, 0], z=[sd, 0, 0], x=[0, 1, 0])
    # 入口辊（空转）：2" 管 + hub + hex 轴
    L = W - 0.125
    nh = max(2, math.ceil(L / 8) + 1); hubw = 0.5
    P.part("SHT-020 Entry roller tube", EN, "Right", -L / 2, [circ(feed_c, rr), circ(feed_c, rr - 0.0625)], L,
           material="6061 tube 2.000 OD x 0.0625 wall")
    for j in range(nh):
        xa = -L / 2 + (L - hubw) * j / (nh - 1)
        P.part(f"SHT-021 Entry roller hub {j + 1}", EN, "Right", xa, [circ(feed_c, rr - 0.0625), poly(hexpts(feed_c, HX + 0.005))],
               hubw, material="6061 round 1.875 OD, 1/2in hex bore")
    e_r = xo + FLANGE + 0.15
    P.part("SHT-022 Entry roller hex shaft", EN, "Right", -e_r, [poly(hexpts(feed_c, HX))], 2 * e_r, hollow=False,
           material="7075 1/2in hex bar")
    for sd in (-1, 1):
        P.place("bearing_flanged_half_hex", FR, [sd * x0, feed_c[0], feed_c[1]], z=[sd, 0, 0], x=[0, 1, 0])

    # 电机侧：电机板、立柱、Kraken、带轮、皮带
    bw = 9 / 25.4
    mp_outline = hull(ring_pts((0, 0), 1.1) + ring_pts(M, 1.6) + [q for s in stand for q in ring_pts(s, 0.55)])
    for sd in motor_sides:
        sfx = "R" if sd == 1 else "L"
        xa, xb = sorted((sd * x_mp0, sd * x_mp1))
        P.part(f"SHT-050 Motor plate {sfx}", FR, "Right", xa,
               [poly(mp_outline), circ((0, 0), BORE_D / 2), circ(M, 0.40)] + [circ(q, BOLT_D / 2) for q in kr]
               + stand_holes, MP_T, material=MAT, flat=True)
        for j, s in enumerate(stand, 1):
            xa2, xb2 = sorted((sd * xo, sd * x_mp0))
            P.part(f"SHT-051 Standoff {sfx}{j} (0.8in)", FR, "Right", xa2, [circ(s, 0.25), circ(s, BOLT_D / 2)], xb2 - xa2,
                   material="6061 round 1/2 OD, 10-32 clearance bore")
            P.bolt(1.5, FR, [sd * x_mp1, s[0], s[1]], [-sd, 0, 0], grip=PLATE_T + ZB + PLATE_T)   # 螺母在侧板内表面
        P.place("bearing_flanged_half_hex", FR, [sd * x_mp0, 0, 0], z=[sd, 0, 0], x=[0, 1, 0])
        P.place("kraken_x60", MO, [sd * (x_mp1 + 1.23), M[0], M[1]], y=[sd, 0, 0], z=[0, 0, 1])
        P.place("pulley_12t_9mm_falcon", MO, [sd * x_b, M[0], M[1]], z=[sd, 0, 0], x=[0, 1, 0])
        P.place(f"pulley_{TW}t_9mm_half_hex", FW, [sd * x_b, 0, 0], y=[sd, 0, 0], z=[0, 0, 1], name=f"flywheel {TW}T")
        for q in kr:
            P.bolt(0.5, FR, [sd * x_mp0, q[0], q[1]], [sd, 0, 0], nut=False)
        outer = hull(ring_pts((0, 0), D / 2 + 0.09) + ring_pts(M, d / 2 + 0.09))
        inner = hull(ring_pts((0, 0), D / 2 - 0.05) + ring_pts(M, d / 2 - 0.05))
        xa3, xb3 = sorted((sd * (x_b - bw / 2), sd * (x_b + bw / 2)))
        P.part(f"SHT-060 Belt {belt_T}T {sfx}", BE, "Right", xa3, [poly(outer), poly(inner)], xb3 - xa3,
               material="HTD5 9mm belt")

    # 材料补充（xblock 不带 material）
    for s in P.steps:
        if s["type"] == "extrude" and "material" not in s:
            nm = s["name"]
            s["material"] = ("6061 bar (plug)" if "plug" in nm else "6061 tube")

    ratio = TM / TW
    rpm = p["motor_free_rpm"] * ratio
    I = 0.0
    for _ in range(nw):                                   # 铝 hub + 聚氨酯轮胎（密度 0.043 lb/in³）
        m_hub = 0.0975 * math.pi * (1.0 ** 2 - HX ** 2) * ww
        m_tire = 0.043 * math.pi * (rw ** 2 - 1.0) * ww
        I += 0.5 * m_hub * (1.0 + HX ** 2) + 0.5 * m_tire * (rw ** 2 + 1.0)
    if p["inertia_discs"]:
        I += 2 * 0.5 * (0.283 * math.pi * (1.75 ** 2 - HX ** 2) * 0.5) * (1.75 ** 2 + HX ** 2)
    omega = rpm * 2 * math.pi / 60
    info = {"hood_inner_radius_in": round(hood_in, 3), "ball_center_radius_in": round(ball_c, 3),
            "launch_angle_deg": round(p["hood_end"] - 270.0, 1), "side_plate_in": [round(max(q[0] for q in outline) - min(q[0] for q in outline), 2),
                                                                                      round(max(q[1] for q in outline) - min(q[1] for q in outline), 2)],
            "motors": p["motors"], "belt": {"teeth": belt_T, "center_in": round(Cd, 3), "motor_yz": [round(v, 3) for v in M]},
            "drive": f"12T -> {TW}T reduction {TW // 12}:1", "flywheel_free_rpm": round(rpm),
            "wheel_surface_speed_in_s_free": round(math.pi * p["wheel_diameter"] * rpm / 60),
            "compression_pct_of_ball": round(100 * p["compression"] / p["ball_diameter"], 1),
            "flywheel_inertia_lb_in2": round(I, 3), "stored_energy_J_free": round(0.5 * (I * 0.000292641) * omega ** 2, 1),
            "note": "球出口速度约为轮面速度的 0.4–0.6 倍（经验值，需实测）；皮带轮/轴环固定件、hood 固定、送球通道未建模"}
    asm = {"name": "Shooter Assembly", "groups": P.groups, "cots": P.cots}
    return {"name": "shooter", "tag": p["tag"], "units": "in", "steps": P.steps, "info": info, "assembly": asm,
            "ball": {"diameter_in": p["ball_diameter"], "center_radius_in": ball_c, "angles_deg": [a0 + 5.0, (a0 + a1) / 2, a1 - 5.0]}}


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
