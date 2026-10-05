#!/usr/bin/env python3
"""FRC roller intake, buildable version (same style as elevator.py): Part Studio (custom parts with real holes)
+ Assembly (flanged half-hex bearings, 24T/12T HTD5 pulleys, Kraken X60, 10-32 hardware), BOM-ready.

  python roller_intake.py > plan.json
  python build.py plan.json --url <Part Studio URL> --replace        # 建零件 + 装配
  python export_step.py plan.json out.step                            # 没有 API 密钥时：导出自制件
  python plan_bom.py plan.json                                        # BOM（CSV）；plan_dxf.py 导出侧板 DXF

World: X = left/right (width), Y = front(+)/back(-) along the roller line, Z = up. Roller axes [y, z] in inches.
Frame: two 1/4" 6061 side plates (1.125" bearing bores), two 1x2x1/16" cross tubes with 1.5" plugs and 10-32 bolts.
Roller: 2" OD x 1/16" wall tube, pressed hex hubs, 1/2" hex shaft.  Drive (right plate, +X side): Kraken X60 inboard
of the plate, 12T on the motor shaft, 24T on every roller; HTD5 9mm belts with integer tooth counts (roller spacing
is nudged <= 0.1" so the belts are standard lengths).  Belt planes: A = motor belt, B/C alternate for the chain.
"""
import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import elevator as EL                      # Plan（Part Studio + 装配描述）、COTS 常量
from _common import HTD_P, belt_len, center_for_teeth, hexpts, hull, pd, ring_pts

DEFAULTS = {
    "tag": "intake",
    "inner_width": 24.0,        # 两侧板内侧距离
    "rollers": [[11, 2], [5.5, 4.5], [1, 6]],   # [y, z] 轴心，沿斜线从前到后（会被微调以凑整数齿皮带）
    "roller_diameters": [3.0, 2.0, 2.0],   # 前辊 3"（254 2022：3" 聚碳酸酯管 + 防滑带抓球），其余 2"
    "tube_wall": 0.0625,
    "plate_material": "polycarbonate",     # 254 2022：1/4" 聚碳酸酯侧板，抗冲击；或 "aluminum"
    "pivot": True,                         # 加枢轴（hex 轴 + 两个法兰轴承），供四连杆/slapdown 臂使用
    "pivot_distance": 3.0,                 # 枢轴在最后一个滚轮后面多远（沿滚轮线）
    "plate_margin": 1.0,        # 滚轮外缘到板边
    "roller_teeth": 24,         # 滚轮带轮齿数（COTS 217-3227）
    "motor_teeth": 12,          # 电机带轮齿数（COTS WCP-0454）
    "drive_roller": 1,          # 电机驱动哪个滚轮（下标）
    "ball_diameter": 5.9,       # 仅用于校验球能否同时压在相邻两个滚轮上（假设，按比赛改）
}

PLATE_T, WALL, BORE_D, BOLT_D = EL.PLATE_T, EL.WALL, EL.BORE_D, EL.BOLT_D
HEX_AF = 0.5                                   # 1/2" hex 对边距
HX = HEX_AF / 2 / math.cos(math.pi / 6)        # hex 外接圆半径
GAP = 0.0625                                   # 滚轮端面到侧板
PUL_HALF, FLANGE = 0.285, 0.063                # COTS 带轮半宽、轴承法兰厚（与 elevator 同）
MOTOR_R = 1.2                                  # Kraken 本体半径（包络）
PLUG_L = 1.5


def circ(c, r):
    return {"kind": "circle", "center": [round(c[0], 5), round(c[1], 5)], "radius": round(r, 5)}


def poly(pts):
    return {"kind": "polygon", "points": [[round(x, 5), round(y, 5)] for x, y in pts]}


def build(p):
    W = p["inner_width"]
    x0 = W / 2                    # 侧板内表面
    xo = x0 + PLATE_T             # 侧板外表面
    L = W - 2 * GAP               # 滚轮长度
    tw = p["tube_wall"]
    TR, TM = p["roller_teeth"], p["motor_teeth"]
    D, d = pd(TR), pd(TM)
    R = [list(map(float, r)) for r in p["rollers"]]
    n = len(R)
    rds = [float(v) / 2 for v in p["roller_diameters"]][:n]
    rds += [rds[-1]] * (n - len(rds))
    di = min(p["drive_roller"], n - 1)

    # --- 链带：相邻滚轮中心距微调到整数齿
    chain_T = []
    for i in range(n - 1):
        C0 = math.dist(R[i], R[i + 1])
        T = round(belt_len(C0, D, D) / HTD_P)
        C = center_for_teeth(T, D, D)
        k = C / C0
        R[i + 1] = [R[i][0] + (R[i + 1][0] - R[i][0]) * k, R[i][1] + (R[i + 1][1] - R[i][1]) * k]
        chain_T.append(T)
        if i + 2 < n:                                  # 后面的滚轮整体平移，保持原有间距
            dy, dz = R[i + 1][0] - p["rollers"][i + 1][0], R[i + 1][1] - p["rollers"][i + 1][1]
            for j in range(i + 2, n):
                R[j] = [p["rollers"][j][0] + dy, p["rollers"][j][1] + dz]

    # 滚轮线方向、法向（朝下）
    dvec = (R[-1][0] - R[0][0], R[-1][1] - R[0][1]) if n > 1 else (1.0, 0.0)
    dl = math.hypot(*dvec); dvec = (dvec[0] / dl, dvec[1] / dl)
    nrm = (-dvec[1], dvec[0])
    if nrm[1] > 0:
        nrm = (-nrm[0], -nrm[1])

    # --- 电机：驱动滚轮下方；皮带取整数齿，离所有滚轮轴 >= 滚轮半径 + 电机半径 + 间隙
    motor = None
    for T in range(40, 140):
        C = center_for_teeth(T, D, d)
        m = (R[di][0] + nrm[0] * C, R[di][1] + nrm[1] * C)
        if C >= (D + d) / 2 + 0.6 and all(math.dist(m, r) >= rds[j] + MOTOR_R + 0.15 for j, r in enumerate(R)):
            motor, motor_T, motor_C = m, T, C
            break
    if motor is None:
        sys.exit("找不到合适的电机位置")

    # --- 枢轴：最后一个滚轮后面，沿滚轮线；避开电机（电机本体在板内侧，枢轴轴穿过全宽）
    pivot = None
    if p["pivot"]:
        for k in range(0, 80):
            q = (R[-1][0] + dvec[0] * (p["pivot_distance"] + 0.1 * k), R[-1][1] + dvec[1] * (p["pivot_distance"] + 0.1 * k))
            if math.dist(q, motor) >= MOTOR_R + 0.3 + 0.2 and all(math.dist(q, r) >= rds[j] + 0.3 + 0.15 + 0.4 for j, r in enumerate(R)):
                pivot = q
                break
        else:
            sys.exit("找不到避开电机的枢轴位置")

    # --- 横管（2 根）：第一个/最后一个滚轮下方，沿线向外滑开直到避开滚轮、电机和枢轴
    tubes = []
    for end, r, rdi in ((-1, R[0], rds[0]), (1, R[-1], rds[-1])):
        for k in range(0, 60):
            s = k * 0.25 * end
            c = (r[0] + nrm[0] * (rdi + 1.7) + dvec[0] * s, r[1] + nrm[1] * (rdi + 1.7) + dvec[1] * s)
            if math.dist(c, motor) >= MOTOR_R + 1.15 + 0.15 and \
                    all(math.dist(c, q) >= rds[j] + 1.15 + 0.15 for j, q in enumerate(R)) and \
                    (pivot is None or math.dist(c, pivot) >= 1.15 + 0.65 + 0.1):
                break
        else:
            sys.exit("找不到避开电机的横管位置")
        tubes.append(c)

    # --- 侧板轮廓、孔
    pts = []
    for j, r in enumerate(R):
        pts += ring_pts(r, rds[j] + p["plate_margin"])
    if pivot:
        pts += ring_pts(pivot, 1.2)
    for c in tubes:
        pts += ring_pts(c, 1.5)
    pts += ring_pts(motor, 1.6)
    outline = hull(pts)

    mt = lambda c: [(c[0] - 0.5, c[1]), (c[0] + 0.5, c[1])]          # 横管两端的 2 个螺栓（沿 y 间距 1"）
    common = [circ(r, BORE_D / 2) for r in R] + ([circ(pivot, BORE_D / 2)] if pivot else [])
    for c in tubes:
        common += [circ(q, BOLT_D / 2) for q in mt(c)]
    for a, b in zip(R, R[1:]):
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        free = math.dist(a, b) / 2 - BORE_D / 2 - 0.35
        if free >= 0.5:
            common.append(circ(mid, min(1.0, free)))
    kr = [(motor[0] - 1, motor[1]), (motor[0] + 1, motor[1]), (motor[0], motor[1] - 1), (motor[0], motor[1] + 1)]
    holes_R = common + [circ(motor, 0.40)] + [circ(q, BOLT_D / 2) for q in kr]

    P = EL.Plan()
    FR, MO, BE = "frame", "motor", "belts"
    MAT_PLATE = "polycarbonate 1/4in sheet (press-fit bearings)" if p["plate_material"] == "polycarbonate" else "6061-T6 1/4in plate"

    # ---------- Part Studio ----------
    P.part("INT-001 Side plate L", FR, "Right", -xo, [poly(outline)] + common, PLATE_T, material=MAT_PLATE, flat=True)
    P.part("INT-001 Side plate R", FR, "Right", x0, [poly(outline)] + holes_R, PLATE_T, material=MAT_PLATE, flat=True)

    for i, c in enumerate(tubes, 1):
        P.xtube(f"INT-002 Cross tube {i}", FR, -x0, x0, c[0] - 1.0, c[1] - 0.5, 2.0, 1.0)
        for sd, sfx in ((-1, "L"), (1, "R")):
            xa, xb = sorted((sd * x0, sd * (x0 - PLUG_L)))
            P.xblock(f"INT-003 Tube plug {i}{sfx}", FR, xa, xb, c[0] - 1.0 + WALL, c[1] - 0.5 + WALL, 2.0 - 2 * WALL,
                     1.0 - 2 * WALL, holes=[circ(q, BOLT_D / 2) for q in mt(c)])

    # 皮带平面 x：A 电机带，B/C 链带交替；带轮中心 = 轴承法兰外 + 间隙 + 半宽
    plane_x = [xo + FLANGE + 0.05 + PUL_HALF + k * 0.65 for k in range(3)]
    shaft_l, shaft_r = -(xo + FLANGE + 0.15), plane_x[2] + PUL_HALF + 0.15
    nh = max(2, math.ceil(L / 8) + 1)
    hubw = 0.5
    for i, c in enumerate(R, 1):
        g = f"roller{i}"
        rd = rds[i - 1]
        P.part(f"INT-010 Roller {i} tube", g, "Right", -L / 2, [circ(c, rd), circ(c, rd - tw)], L,
               material=f"polycarbonate tube {2 * rd:.3f} OD x {tw} wall, wrap with anti-slip tape")
        for j in range(nh):
            xa = -L / 2 + (L - hubw) * j / (nh - 1)
            P.part(f"INT-011 Roller {i} hub {j + 1}", g, "Right", xa, [circ(c, rd - tw), poly(hexpts(c, HX + 0.005))], hubw,
                   material=f"6061 round {2 * (rd - tw):.3f} OD, 1/2in hex bore")
        P.part(f"INT-012 Roller {i} hex shaft", g, "Right", shaft_l, [poly(hexpts(c, HX))], shaft_r - shaft_l, hollow=False,
               material="7075 1/2in hex bar")
        for sd in (-1, 1):
            P.place("bearing_flanged_half_hex", FR, [sd * x0, c[0], c[1]], z=[sd, 0, 0], x=[0, 1, 0])

    if pivot:
        pl, pr = -(xo + FLANGE + 0.4), xo + FLANGE + 0.4
        P.part("INT-050 Pivot hex shaft", "pivot", "Right", pl, [poly(hexpts(pivot, HX))], pr - pl, hollow=False,
               material="7075 1/2in hex bar")
        for sd in (-1, 1):
            P.place("bearing_flanged_half_hex", FR, [sd * x0, pivot[0], pivot[1]], z=[sd, 0, 0], x=[0, 1, 0])

    # 每个滚轮需要的带轮平面
    planes_of = {i: set() for i in range(n)}
    for i in range(n - 1):
        planes_of[i].add(1 + i % 2); planes_of[i + 1].add(1 + i % 2)
    planes_of[di].add(0)
    for i, c in enumerate(R):
        for k in sorted(planes_of[i]):
            P.place("pulley_24t_9mm_half_hex" if TR == 24 else f"pulley_{TR}t_9mm_half_hex", f"roller{i + 1}",
                    [plane_x[k], c[0], c[1]], y=[1, 0, 0], z=[0, 0, 1], name=f"roller {i + 1} {TR}T plane {'ABC'[k]}")
        P.groups[f"INT-012 Roller {i + 1} hex shaft"] = f"roller{i + 1}"

    bw = 9 / 25.4

    def belt(name, c1, r1, c2, r2, xc):
        outer = hull(ring_pts(c1, r1 + 0.09) + ring_pts(c2, r2 + 0.09))
        inner = hull(ring_pts(c1, r1 - 0.05) + ring_pts(c2, r2 - 0.05))
        P.part(name, BE, "Right", xc - bw / 2, [poly(outer), poly(inner)], bw, material="HTD5 9mm belt")

    for i in range(n - 1):
        belt(f"INT-021 Belt {chain_T[i]}T ({i + 1}-{i + 2})", R[i], D / 2, R[i + 1], D / 2, plane_x[1 + i % 2])
    belt(f"INT-022 Motor belt {motor_T}T", motor, d / 2, R[di], D / 2, plane_x[0])

    # 电机：Kraken 在右板内侧，12T 在外侧 A 平面；4 颗 10-32 x 0.5" 从板外侧拧进 Kraken
    P.place("kraken_x60", MO, [x0 - 1.23, motor[0], motor[1]], y=[-1, 0, 0], z=[0, 0, 1])
    P.place("pulley_12t_9mm_falcon", MO, [plane_x[0], motor[0], motor[1]], z=[1, 0, 0], x=[0, 1, 0])
    for q in kr:
        P.bolt(0.5, FR, [xo, q[0], q[1]], [-1, 0, 0], nut=False)
    # 横管螺栓：10-32 x 1.5"，头在板外侧，拧进横管端的塞子
    for c in tubes:
        for sd in (-1, 1):
            for q in mt(c):
                P.bolt(1.5, FR, [sd * xo, q[0], q[1]], [-sd, 0, 0], nut=False)

    # ---------- 校验用的信息 ----------
    ratio = TM / TR
    for j, r in enumerate(rds):
        v = math.pi * 2 * r * 6000 * ratio / 60 / 12
        if v < 15:
            print(f"警告：滚轮 {j + 1} 空载面速 {v:.1f} ft/s < 15 ft/s；254 的 intake 面速要大于车速"
                  f"（2017：40 ft/s，2022：3\" 管约 35 ft/s）", file=sys.stderr)
    info = {"rollers_yz_after_belt_snap": [[round(v, 3) for v in r] for r in R],
            "roller_pitch_in": [round(math.dist(a, b), 3) for a, b in zip(R, R[1:])],
            "belts": {"chain_teeth": chain_T, "motor_teeth": motor_T,
                      "motor_belt_center_in": round(motor_C, 3)},
            "motor_center_yz": [round(v, 3) for v in motor],
            "roller_rpm_free": round(6000 * ratio),
            "roller_surface_speed_ft_s_free": [round(math.pi * 2 * r * 6000 * ratio / 60 / 12, 1) for r in rds],
            "pivot_yz": [round(v, 3) for v in pivot] if pivot else None,
            "plate_size_in": [round(max(q[0] for q in outline) - min(q[0] for q in outline), 2),
                              round(max(q[1] for q in outline) - min(q[1] for q in outline), 2)],
            "note": "滚轮轴向固定（卡簧）、带轮固定、皮带张紧未建模；带都是整数齿的标准长度，需按此中心距加工"}
    asm = {"name": "Intake Assembly", "groups": P.groups, "cots": P.cots}
    return {"name": "intake", "tag": p["tag"], "units": "in", "steps": P.steps, "info": info, "assembly": asm,
            "ball": {"diameter_in": p["ball_diameter"], "rollers": R, "roller_radii_in": rds}}


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
