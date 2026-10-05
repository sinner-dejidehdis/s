#!/usr/bin/env python3
"""Whole-robot layout check: frame + bumper envelope + swerve proxies + shooter + pivoting intake, in two poses
(stowed = starting configuration, deployed = intake over the bumper).  Solves the intake poses, checks FRC envelope
rules (frc_rules_check.py: R104/R105/R106/R107), interference, and estimates weight (R103/R408).

  python robot_layout.py [--out output/]        # needs cadquery, numpy
All sizes in inches.  Swerve modules, battery and electronics are PROXIES / assumed masses, not real CAD.
"""
import json
import math
import sys
from pathlib import Path

import cadquery as cq
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE / "templates")]
import export_step as E
import frc_rules_check as FR
import roller_intake as RI
import shooter as SH

K = 25.4
FRAME_X, FRAME_Y = 27.0, 27.0           # 机架周长 108 in（R104 上限 110 in）
HX_, HY_ = FRAME_X / 2, FRAME_Y / 2
TUBE_H, TUBE_W, TUBE_WALL, TUBE_Z0 = 2.0, 1.0, 0.0625, 2.5      # 2x1x1/16 管，在保险杠区 2.5–5.75 in 内
BUMPER_T, BUMPER_Z = 3.25, (2.5, 7.5)                           # 保险杠包络（偏保守：顶到 7.5 in）
DENS = {"polycarbonate": 0.0433, "6061": 0.0975, "7075": 0.101, "steel": 0.283, "urethane": 0.043, "belt": 0.035}
COTS_LB = {"kraken_x60": 1.23, "bearing_flanged_half_hex": 0.035, "pulley_12t_9mm_falcon": 0.03, "pulley_24t_9mm_half_hex": 0.07,
           "pulley_36t_9mm_half_hex": 0.15, "shcs_10_32_0.5": 0.004, "shcs_10_32_1.5": 0.01, "shcs_10_32_2.25": 0.014,
           "shcs_10_32_2.5": 0.015, "nylock_10_32": 0.004, "rivet_3_16": 0.003, "wcp_0199_bearing_block": 0.12}
ASSUMED_LB = {"swerve modules x4 (incl. motors, ASSUMED 7.0 lb each)": 28.0, "roboRIO+PDH+radio+breaker+wiring (ASSUMED)": 12.0,
              "belly pan 1/8in 6061 25x25": 0.0975 * 25 * 25 * 0.125, "misc fasteners/brackets/risers (ASSUMED)": 4.0}
SHOOTER_Z0 = 5.0                        # shooter 最低点高度；可沉进车架环中间（--shooter-z=）
FLOOR_CLEAR = 0.25                      # 展开时 intake 最低点离地
BUMPER_LB = 8.0                         # 假设值（R103 不计保险杠，R408 计）


def density(mat):
    m = (mat or "").lower()
    for k in ("polycarbonate", "urethane", "belt", "steel", "7075", "6061"):
        if k in m:
            return DENS[k]
    return DENS["6061"]


def box(x0, x1, y0, y1, z0, z1):
    return cq.Workplane().add(cq.Solid.makeBox((x1 - x0) * K, (y1 - y0) * K, (z1 - z0) * K, cq.Vector(x0 * K, y0 * K, z0 * K)))


def tube(x0, x1, y0, y1, z0, z1, axis):
    o = box(x0, x1, y0, y1, z0, z1)
    w = TUBE_WALL
    inner = box(x0 + (w if axis != "x" else 0), x1 - (w if axis != "x" else 0), y0 + (w if axis != "y" else 0),
                y1 - (w if axis != "y" else 0), z0 + w, z1 - w)
    return o.cut(inner)


def frame():
    z0, z1 = TUBE_Z0, TUBE_Z0 + TUBE_H
    return [("FRAME tube front", tube(-HX_, HX_, HY_ - TUBE_W, HY_, z0, z1, "x")), ("FRAME tube back", tube(-HX_, HX_, -HY_, -HY_ + TUBE_W, z0, z1, "x")),
            ("FRAME tube left", tube(-HX_, -HX_ + TUBE_W, -HY_ + TUBE_W, HY_ - TUBE_W, z0, z1, "y")),
            ("FRAME tube right", tube(HX_ - TUBE_W, HX_, -HY_ + TUBE_W, HY_ - TUBE_W, z0, z1, "y"))]


def bumpers():
    z0, z1 = BUMPER_Z
    t = BUMPER_T
    return [("ENVELOPE bumper front", box(-HX_ - t, HX_ + t, HY_, HY_ + t, z0, z1)), ("ENVELOPE bumper back", box(-HX_ - t, HX_ + t, -HY_ - t, -HY_, z0, z1)),
            ("ENVELOPE bumper left", box(-HX_ - t, -HX_, -HY_, HY_, z0, z1)), ("ENVELOPE bumper right", box(HX_, HX_ + t, -HY_, HY_, z0, z1))]


def swerve_proxies():
    c = HX_ - 1.0 - 2.25
    return [(f"PROXY swerve {i}", box(sx * c - 2.25, sx * c + 2.25, sy * c - 2.25, sy * c + 2.25, 0.0, TUBE_Z0))
            for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1)), 1)]


def cloud(bodies):
    pts = []
    for _, w in bodies:
        v, _t = (w.val() if hasattr(w, "val") else w).tessellate(1.0)
        pts += [(p.x / K, p.y / K, p.z / K) for p in v]
    return np.array(pts)


def move_pts(P, pivot, th, pw):
    """rotate about X through pivot (y,z) by th deg (+y toward +z), then place the pivot at world pw=(y,z)."""
    c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
    y, z = P[:, 1] - pivot[0], P[:, 2] - pivot[1]
    return np.stack([P[:, 0], pw[0] + y * c - z * s, pw[1] + y * s + z * c], axis=1)


def move_shape(bodies, pivot, th, pw):
    out = []
    for n, w in bodies:
        s = (w.val() if hasattr(w, "val") else w).rotate(cq.Vector(0, pivot[0] * K, pivot[1] * K), cq.Vector(1, pivot[0] * K, pivot[1] * K), th)
        out.append((n, s.translate(cq.Vector(0, (pw[0] - pivot[0]) * K, (pw[1] - pivot[1]) * K))))
    return out


def hits(A, B, tol=1e-4):
    """(nameA, nameB, volume in^3) pairs that overlap"""
    out = []
    for na, a in A:
        sa = a.val() if hasattr(a, "val") else a
        ba = sa.BoundingBox()
        for nb, b in B:
            sb = b.val() if hasattr(b, "val") else b
            bb = sb.BoundingBox()
            if ba.xmax < bb.xmin or bb.xmax < ba.xmin or ba.ymax < bb.ymin or bb.ymax < ba.ymin or ba.zmax < bb.zmin or bb.zmax < ba.zmin:
                continue
            v = sa.intersect(sb).Volume() / K ** 3
            if v > tol:
                out.append((na, nb, round(v, 4)))
    return out


def main():
    global SHOOTER_Z0
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else HERE.parent / "output"
    for a in sys.argv:
        if a.startswith("--shooter-z="):
            SHOOTER_Z0 = float(a.split("=", 1)[1])
    ip = dict(RI.DEFAULTS); ip["inner_width"] = 22.0                 # 机架 27 in 宽：intake 总宽 ≈ 25.3 in
    # 过保险杠 intake：2 个滚轮（254 2022 也是 2 个）、约 45° 坡度、板边距小（贴地）；参数可用 --intake k=v 覆盖
    ip.update({"rollers": [[8.5, 2.0], [4.5, 6.0]], "roller_diameters": [3.0, 2.0], "plate_margin": 0.5, "arm": True})
    for a in sys.argv:
        if a.startswith("--intake="):
            k, v = a[len("--intake="):].split("=", 1)
            ip[k] = json.loads(v)
    sp = dict(SH.DEFAULTS)
    iplan, splan = RI.build(ip), SH.build(sp)
    ibod, sbod = E.build(iplan), E.build(splan)
    pivot = tuple(iplan["info"]["pivot_yz"])
    report = {"frame_in": [FRAME_X, FRAME_Y], "shooter_lowest_point_z_in": SHOOTER_Z0}

    # ---- shooter：机架中后部，最低点离机架顶 0.5 in，最后端离后周长 1.5 in
    sb = cq.Compound.makeCompound([w.val() for _, w in sbod]).BoundingBox()
    sh_z0 = SHOOTER_Z0
    sh_dx, sh_dy, sh_dz = -(sb.xmin + sb.xmax) / 2 / K, -HY_ + 1.5 - sb.ymin / K, sh_z0 - sb.zmin / K
    shooter = [(n, (w.val() if hasattr(w, "val") else w).translate(cq.Vector(sh_dx * K, sh_dy * K, sh_dz * K))) for n, w in sbod]
    fixed = frame() + bumpers() + swerve_proxies() + shooter

    # ---- intake 姿态求解：枢轴必须在周长内；展开时最低点离地 0.25 in、前伸出 5.5–11.5 in（R105 上限 12 in）；
    #      收起时整体收进周长（starting configuration）、高度 <= 29.5 in，且两个姿态都不与车架/保险杠/shooter 干涉
    P = cloud(ibod)
    best = None
    for FLOOR in (0.25, 0.75, 1.25, 1.75, 2.5):
        FLOOR_CLEAR_ = FLOOR
        best = None
        floor_used = None
        stats = {"ext/z ok": 0, "deploy ok": 0}
        first_hit = first_stow = None
        for ypw in np.arange(HY_ - 1.0, 3.9, -0.5):
            for th_d in np.arange(-80.0, 40.01, 1.0):
                Q0 = move_pts(P, pivot, th_d, (0.0, 0.0))
                ext = ypw + Q0[:, 1].max() - HY_
                zpw = FLOOR_CLEAR_ - Q0[:, 2].min()
                if not (5.5 <= ext <= 11.5) or zpw < 5.0 or zpw > 26.0:
                    continue
                stats["ext/z ok"] += 1
                pw = (float(ypw), float(zpw))
                h = hits(move_shape(ibod, pivot, th_d, pw), fixed)
                if h:
                    first_hit = first_hit or (round(float(ypw), 1), float(th_d), [round(v, 1) for v in pw], h[:4])
                    continue
                stats["deploy ok"] += 1
                why = {"outside": 0, "hit": 0}
                for th in np.arange(th_d, th_d + 330.01, 1.0):
                    Q = move_pts(P, pivot, th, pw)
                    if Q[:, 1].max() > HY_ - 0.05 or Q[:, 2].max() > 29.5 or np.abs(Q[:, 0]).max() > HX_ - 0.05:
                        why["outside"] += 1
                        continue
                    hh = hits(move_shape(ibod, pivot, th, pw), fixed)
                    if hh:
                        why["hit"] += 1
                        continue
                    best = (th_d, pw, th)
                    break
                if best is None and first_stow is None:
                    first_stow = (round(float(ypw), 1), float(th_d), [round(v, 1) for v in pw], why)
                if best:
                    break
            if best:
                break
        if best is not None:
            break
        if False:
            sys.exit(f"找不到同时满足展开和收起的 intake 姿态：{stats}\n  首个展开干涉：{first_hit}\n  首个收起失败：{first_stow}")

    if best is None:
        sys.exit(f"找不到同时满足展开和收起的 intake 姿态：{stats}\n  首个展开干涉：{first_hit}\n  首个收起失败：{first_stow}")
    floor_used = FLOOR
    th_d, pw, stow = best
    report["intake_lowest_point_above_floor_in"] = floor_used
    report["intake_pivot_world_yz"] = [round(float(v), 3) for v in pw]
    report["intake_deployed_deg"] = round(float(th_d), 1)
    report["intake_stowed_deg"] = None if stow is None else round(float(stow), 1)

    poses = {"deployed": th_d}
    if stow is not None:
        poses["stowed"] = stow
    checks, solids = [], {}
    for name, th in poses.items():
        ib = move_shape(ibod, pivot, th, pw)
        allb = fixed + ib
        solids[name] = allb
        checks += FR.check_pose([b for b in allb if not b[0].startswith("ENVELOPE")], HX_, HY_, name, stowed=(name == "stowed"),
                                skip=lambda n: n.startswith("PROXY"))
        for a, b, v in hits(ib, fixed):
            checks.append((False, f"[{name}] 干涉 {a} × {b}: {v} in3"))
        for a, b, v in hits(ib, [x for x in ib if False]):
            pass
    if stow is None:
        checks.append((False, "[stowed] 找不到完全收进周长内的姿态（intake 太长）"))
    # ---- 重量
    bom, total = [], 0.0
    for plan, label in ((iplan, "intake"), (splan, "shooter")):
        mat = {s["name"]: s.get("material", "") for s in plan["steps"] if s["type"] == "extrude"}
        bodies = ibod if plan is iplan else sbod
        w = sum((b.val() if hasattr(b, "val") else b).Volume() / K ** 3 * density(mat.get(n, "")) for n, b in bodies)
        c = sum(COTS_LB.get(i["key"], 0.0) for i in plan["assembly"]["cots"])
        bom += [(f"{label} custom parts (volume x density)", w), (f"{label} COTS (catalogue approx)", c)]
    fw = sum(w.val().Volume() / K ** 3 * DENS["6061"] for n, w in frame())
    bom.append(("frame 2x1x1/16 tubes", fw))
    bom += [(k, v) for k, v in ASSUMED_LB.items()]
    total = sum(v for _, v in bom)
    checks += FR.check_static(FRAME_X, FRAME_Y, total, BUMPER_LB)
    report["weight_lb"] = {k: round(v, 2) for k, v in bom}
    report["weight_total_no_bumpers_battery_lb"] = round(total, 2)
    report["weight_margin_lb"] = round(FR.RULES["R103_weight_lb"] - total, 2)
    report["checks"] = [{"ok": ok, "text": t} for ok, t in checks]

    out.mkdir(parents=True, exist_ok=True)
    for name, allb in solids.items():
        asm = cq.Assembly(name=f"biocore_robot_{name}")
        for n, s in allb:
            asm.add(cq.Workplane().add(s) if not hasattr(s, "val") else s, name=n)
        asm.save(str(out / f"robot_layout_{name}.step"))
    (out / "robot_layout_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    for ok, t in checks:
        print("PASS" if ok else "FAIL", t)
    print(f"重量（不含保险杠和电池）约 {total:.1f} lb，距 R103 上限 {report['weight_margin_lb']:.1f} lb")
    print(f"intake 枢轴世界坐标 (y,z) = {report['intake_pivot_world_yz']}，展开 {report['intake_deployed_deg']}°，收起 {report['intake_stowed_deg']}°")
    sys.exit(0 if all(ok for ok, _ in checks) else 1)


if __name__ == "__main__":
    main()
