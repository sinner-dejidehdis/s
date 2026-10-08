#!/usr/bin/env python3
"""S1 frame + belly pan, S2 battery tray, S3 rear electronics panel: CAD (STEP), DXF, BOM.  python robot_frame.py [--out dir]"""
import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import cadkit as C
import robot_params as P

OUT = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else HERE.parent / "output" / "robot_subsys"
OUT.mkdir(parents=True, exist_ok=True)
W = P.TUBE_WALL


def tube(x0, x1, y0, y1, z0, z1, axis):
    o = C.box(x0, x1, y0, y1, z0, z1)
    i = C.box(x0 + (W if axis != "x" else 0), x1 - (W if axis != "x" else 0), y0 + (W if axis != "y" else 0), y1 - (W if axis != "y" else 0), z0 + W, z1 - W)
    return o.cut(i)


def plug_y(xc, y0, y1, zc, length=1.5):
    """plug inside a front/back tube (axis X): occupies x in [xc-length/2, xc+length/2], hole along Y at (xc, zc)"""
    p = C.box(xc - length / 2, xc + length / 2, y0 + W, y1 - W, P.TUBE_Z0 + W, P.TUBE_Z1 - W)
    return p.cut(C.cyl_y(y0 - 0.1, y1 + 0.1, xc, zc, 0.1005))


def plug_x(yc, x0, x1, zc, length=1.5):
    p = C.box(x0 + W, x1 - W, yc - length / 2, yc + length / 2, P.TUBE_Z0 + W, P.TUBE_Z1 - W)
    return p.cut(C.cyl_x(x0 - 0.1, x1 + 0.1, yc, zc, 0.1005))


def build():
    zc = (P.TUBE_Z0 + P.TUBE_Z1) / 2
    hx, hy = P.HX, P.HY
    parts, bom, mass = {"S1_frame": [], "S2_battery": [], "S3_electronics_panel": []}, [], {}

    def add(sub, name, w, mat, stock):
        parts[sub].append((name, w))
        m = C.mass_lb(w, mat)
        mass[name] = (sub, m)
        bom.append([sub, name, 1, mat, stock, round(m, 3)])

    # ---------------- S1 frame
    add("S1_frame", "F-001 front tube", tube(-hx, hx, hy - P.TUBE_W, hy, P.TUBE_Z0, P.TUBE_Z1, "x"), "6061", "tube 1x2x0.0625, 27.0 in")
    add("S1_frame", "F-001 back tube", tube(-hx, hx, -hy, -hy + P.TUBE_W, P.TUBE_Z0, P.TUBE_Z1, "x"), "6061", "tube 1x2x0.0625, 27.0 in")
    add("S1_frame", "F-002 left tube", tube(-hx, -hx + P.TUBE_W, -hy + P.TUBE_W, hy - P.TUBE_W, P.TUBE_Z0, P.TUBE_Z1, "y"), "6061", "tube 1x2x0.0625, 25.0 in")
    add("S1_frame", "F-002 right tube", tube(hx - P.TUBE_W, hx, -hy + P.TUBE_W, hy - P.TUBE_W, P.TUBE_Z0, P.TUBE_Z1, "y"), "6061", "tube 1x2x0.0625, 25.0 in")
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1)), 1):          # 底部角撑板 3.5x3.5x1/8，铆钉连接管的下表面
        x0, x1 = sorted((sx * hx, sx * (hx - 3.5)))
        y0, y1 = sorted((sy * hy, sy * (hy - 3.5)))
        add("S1_frame", f"F-003 corner gusset {i}", C.plate_z(x0, x1, y0, y1, P.TUBE_Z0 - 0.125, 0.125), "6061", "plate 1/8 in, 3.5x3.5")
    # 保险杠安装塞子：每边 3 个（见 S5）；后管额外 4 个电子板立柱塞子
    n_plug = 0
    for xc in (-8.0, 0.0, 8.0):
        add("S1_frame", f"F-004 bumper plug front {xc:+.0f}", plug_y(xc, hy - P.TUBE_W, hy, zc), "6061", "bar 0.875x1.875x1.5, drill 0.201")
        add("S1_frame", f"F-004 bumper plug back {xc:+.0f}", plug_y(xc, -hy, -hy + P.TUBE_W, zc), "6061", "bar 0.875x1.875x1.5, drill 0.201")
    for yc in (-8.0, 0.0, 8.0):
        add("S1_frame", f"F-004 bumper plug left {yc:+.0f}", plug_x(yc, -hx, -hx + P.TUBE_W, zc), "6061", "bar 0.875x1.875x1.5, drill 0.201")
        add("S1_frame", f"F-004 bumper plug right {yc:+.0f}", plug_x(yc, hx - P.TUBE_W, hx, zc), "6061", "bar 0.875x1.875x1.5, drill 0.201")
    # 底板（1/8 铝）：角部留模块避让缺口，开孔：铆钉孔、托架/立柱螺栓孔、过线槽、减重孔
    ph = P.PAN_HALF
    ko = ph - P.MODULE_KEEPOUT
    pan_cuts = [(sx * ko if sx > 0 else -ph - 0.1, ph + 0.1 if sx > 0 else -ko, sy * ko if sy > 0 else -ph - 0.1, ph + 0.1 if sy > 0 else -ko) for sx in (-1, 1) for sy in (-1, 1)]
    pan_cuts = [(a, b, c, d) for a, b, c, d in pan_cuts]
    rivets = []                                              # 每 4 in 一颗 3/16 铆钉，距管外边 0.5 in
    for t in (-12.0, -8.0, -4.0, 0.0, 4.0, 8.0, 12.0):
        rivets += [(t, hy - 0.5), (t, -hy + 0.5)]
        if abs(t) <= 8:
            rivets += [(hx - 0.5, t), (-hx + 0.5, t)]
    tray_holes = [(sx * 3.7, sy) for sx in (-1, 1) for sy in (-9.5, -6.5)]
    post_holes = [(x + dx, -12.2) for x in P.UPRIGHT_X for dx in (-0.4, 0.4)]
    slots = [(-12.4, -11.2, y - 0.25, y + 0.25) for y in (-4.0, 2.0, 8.0)] + [(11.2, 12.4, y - 0.25, y + 0.25) for y in (-4.0, 2.0, 8.0)]
    light = [(x, y, 0.9) for x in (-6.0, 0.0, 6.0) for y in (-1.0, 3.0, 7.0)]            # 减重孔（避开托架、立柱、过线槽）
    holes = [(x, y, 0.0953) for x, y in rivets] + [(x, y, 0.1005) for x, y in tray_holes + post_holes] + light
    pan = C.plate_z(-ph, ph, -ph, ph, P.PAN_Z0, P.PAN_T, holes=holes, cuts=pan_cuts + slots)
    add("S1_frame", "F-005 belly pan", pan, "6061", "plate 1/8 in, 26.5x26.5 (corner notches)")

    # ---------------- S2 battery
    bx, by, bz = P.BATT["x"], P.BATT["y"], P.BATT["z"]
    tx, ty = P.TRAY_BASE["x"], P.TRAY_BASE["y"]
    z0 = P.PAN_Z0 + P.PAN_T
    add("S2_battery", "B-001 tray base", C.plate_z(tx[0], tx[1], ty[0], ty[1], z0, P.TRAY_BASE_T, holes=[(sx * 3.7, sy, 0.1005) for sx in (-1, 1) for sy in (-9.5, -6.5)]), "6061", "plate 1/8 in, 8.1x4.0")
    ring = C.box(-3.85, 3.85, -9.8, -6.2, z0 + P.TRAY_BASE_T, z0 + P.TRAY_BASE_T + 2.0).cut(C.box(-3.65, 3.65, -9.6, -6.4, z0, z0 + 3.0))
    add("S2_battery", "B-002 tray walls (2.0 in)", ring, "6061", "6061 bar milled / bent")
    for k, (ya, yb) in enumerate(((-9.95, -9.8), (-6.2, -6.05)), 1):
        add("S2_battery", f"B-003 hold-down upright {k}", C.box(-1.0, 1.0, ya, yb, z0 + P.TRAY_BASE_T, bz[1] + 0.05), "6061", "plate 1/8 in, 2.0 wide")
    add("S2_battery", "B-004 hold-down bar", C.box(-0.75, 0.75, -9.95, -6.05, bz[1] + 0.05, bz[1] + 0.175), "6061", "plate 1/8 in, 1.5 x 3.9")
    parts["S2_battery"].append(("ENVELOPE battery 7.1x3.0x6.6 (R601)", C.box(bx[0], bx[1], by[0], by[1], bz[0], bz[1])))

    # ---------------- S3 electronics panel
    px, pz, py = P.PANEL["x"], P.PANEL["z"], P.PANEL["y"]
    grid = [(x * 0.5, z * 0.5, 0.1) for x in range(int(-4.0 / 0.5), int(4.0 / 0.5) + 1) for z in range(int(9.0 / 0.5), int(13.0 / 0.5) + 1)]   # PDH：0.5 in 栅格 #10 孔
    cuts = [(P.BREAKER["x"][0], P.BREAKER["x"][1], P.BREAKER["z"][0], P.BREAKER["z"][1])] + [(x - 1.0, x + 1.0, 8.3, 8.8) for x in (-8.0, 0.0, 8.0)]
    panel = C.plate_y(px[0], px[1], pz[0], pz[1], py[0], py[1] - py[0], holes=[(x, z, r) for x, z, r in grid] + [(x, 8.5 + 0.0, 0.0) for x in ()], cuts=cuts)
    for x in P.UPRIGHT_X:                                    # 立柱螺栓孔（穿过电子板，z=8.3）
        for dx in (-0.4, 0.4):
            panel = panel.cut(C.cyl_y(py[0] - 0.1, py[1] + 0.1, x + dx, 8.3, 0.1005))
    add("S3_electronics_panel", "E-001 panel 1/4in polycarbonate", panel, "polycarbonate", "polycarbonate 0.25 in, 24x6.5")
    for k, x in enumerate(P.UPRIGHT_X, 1):
        up = C.box(x - 0.75, x + 0.75, py[1], py[1] + 0.125, P.PAN_Z0 + P.PAN_T, P.UPRIGHT_Z_TOP)
        foot = C.box(x - 0.75, x + 0.75, py[1], py[1] + 1.0, P.PAN_Z0 + P.PAN_T, P.PAN_Z0 + P.PAN_T + 0.125)
        up = up.union(foot)
        for dx in (-0.4, 0.4):
            up = up.cut(C.cyl_y(py[1] - 0.1, py[1] + 0.3, x + dx, 8.3, 0.1005)).cut(C.cyl_z(P.PAN_Z0, P.PAN_Z0 + 0.5, x + dx, -12.2, 0.1005))
        add("S3_electronics_panel", f"E-002 upright {k}", up, "6061", "plate 1/8 in bent L, 1.5 wide")
    y_front = py[1]
    for nm, d in (("PDH REV-11-1850 (verified size)", P.PDH), ("roboRIO 2.0 (PLACEHOLDER size)", P.RIO), ("VH-109 radio (PLACEHOLDER size)", P.RADIO), ("120A main breaker (PLACEHOLDER size)", P.BREAKER)):
        parts["S3_electronics_panel"].append((f"ENVELOPE {nm}", C.box(d["x"][0], d["x"][1], y_front, y_front + d["y_thick"], d["z"][0], d["z"][1])))

    for sub, ps in parts.items():
        C.save_step(ps, OUT / f"{sub}.step")

    # DXF（1:1，英寸）：底板、托架底板、电子板、角撑板
    corner = lambda sx, sy: [(sx * (hx - 3.5), sy * hy), (sx * hx, sy * hy), (sx * hx, sy * (hy - 3.5)), (sx * (hx - 3.5), sy * (hy - 3.5))]
    pan_poly = [(-ph, -ph), (ph, -ph), (ph, ph), (-ph, ph)]
    pan_rects = [(a, c, b, d) for a, b, c, d in pan_cuts] + [(a, c, b, d) for a, b, c, d in slots]
    pan_poly = [(-ph + ko, -ph), (ph - ko, -ph), (ph - ko, -ph + P.MODULE_KEEPOUT), (ph, -ph + P.MODULE_KEEPOUT), (ph, ph - P.MODULE_KEEPOUT), (ph - ko, ph - P.MODULE_KEEPOUT),
                (ph - ko, ph), (-ph + ko, ph), (-ph + ko, ph - P.MODULE_KEEPOUT), (-ph, ph - P.MODULE_KEEPOUT), (-ph, -ph + P.MODULE_KEEPOUT), (-ph + ko, -ph + P.MODULE_KEEPOUT)]
    pan_poly = [(-ph + P.MODULE_KEEPOUT, -ph), (ph - P.MODULE_KEEPOUT, -ph), (ph - P.MODULE_KEEPOUT, -ph + P.MODULE_KEEPOUT), (ph, -ph + P.MODULE_KEEPOUT), (ph, ph - P.MODULE_KEEPOUT),
                (ph - P.MODULE_KEEPOUT, ph - P.MODULE_KEEPOUT), (ph - P.MODULE_KEEPOUT, ph), (-ph + P.MODULE_KEEPOUT, ph), (-ph + P.MODULE_KEEPOUT, ph - P.MODULE_KEEPOUT),
                (-ph, ph - P.MODULE_KEEPOUT), (-ph, -ph + P.MODULE_KEEPOUT), (-ph + P.MODULE_KEEPOUT, -ph + P.MODULE_KEEPOUT)]
    C.save_dxf(OUT / "F-005_belly_pan.dxf", rects=[(a, c, b, d) for a, b, c, d in slots], circles=holes, polys=[pan_poly])
    C.save_dxf(OUT / "B-001_tray_base.dxf", rects=[(tx[0], ty[0], tx[1], ty[1])], circles=[(sx * 3.7, sy, 0.1005) for sx in (-1, 1) for sy in (-9.5, -6.5)])
    C.save_dxf(OUT / "E-001_electronics_panel.dxf", rects=[(px[0], pz[0], px[1], pz[1])] + [(c[0], c[2], c[1], c[3]) for c in cuts], circles=grid,
               zones=[("roboRIO 2.0 zone (hole pattern TBD from NI drawing)", P.RIO["x"][0], P.RIO["z"][0], P.RIO["x"][1], P.RIO["z"][1]),
                      ("VH-109 zone (hole pattern TBD)", P.RADIO["x"][0], P.RADIO["z"][0], P.RADIO["x"][1], P.RADIO["z"][1]),
                      ("PDH REV-11-1850 8.875x4.375", P.PDH["x"][0], P.PDH["z"][0], P.PDH["x"][1], P.PDH["z"][1])])
    C.save_dxf(OUT / "F-003_corner_gusset.dxf", rects=[(0, 0, 3.5, 3.5)], circles=[(0.75, 0.75, 0.0953), (2.75, 0.75, 0.0953), (0.75, 2.75, 0.0953), (2.75, 2.75, 0.0953)])

    with open(OUT / "bom_S1_S2_S3.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["subsystem", "part", "qty", "material", "stock / note", "mass_lb(calc)"])
        w.writerows(bom)
        w.writerow([])
        w.writerow(["hardware (count)", "3/16 rivets (pan to tubes + gusset to tubes)", len(rivets) + 16, "", "", ""])
        w.writerow(["hardware (count)", "10-32 hardware (tray, standoffs, hold-down)", 16, "", "", ""])
    tot = {s: sum(m for n, (ss, m) in mass.items() if ss == s) for s in parts}
    info = {"mass_lb": {k: round(v, 2) for k, v in tot.items()}, "rivets": len(rivets), "pan_holes": len(holes)}
    (OUT / "S1_S2_S3_info.json").write_text(json.dumps(info, indent=1))
    print(json.dumps(info))


if __name__ == "__main__":
    build()
