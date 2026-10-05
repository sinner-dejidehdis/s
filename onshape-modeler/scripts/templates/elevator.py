#!/usr/bin/env python3
"""FRC 2-stage elevator, buildable version: Part Studio (custom parts with real holes) + Assembly
(WCP-0199 bearing blocks, 10-32 hardware, rivets, Kraken X60 drive, bearings, pulleys, belts).

  python elevator.py > plan.json
  python build.py plan.json --url <Part Studio URL> --replace       # 建零件 + 装配

参考 254 2025 Undertow（2 级 continuous、2x1x1/16" 管 + 轴承块、2×Kraken X60），改进见 SKILL.md。

World: X = left/right, Y = front(-)/back(+), Z = up. All tubes are 2x1x1/16" at y ∈ [0, 2] (2" along Y).
Stages nest inward in X with a 1/4" gap, which is what WCP-0199 (3/4" bearing config) sets.
Outer-stage top crossbars sit behind (y ≥ 2.875) on side gussets so the inner stage can pass;
bottom crossbars are in-plane with front/back gussets. Carriage plate is in front (y < 0).
"""
import argparse
import json
import math
import sys
from pathlib import Path

COTS = json.loads((Path(__file__).resolve().parents[2] / "references" / "cots.json").read_text())

DEFAULTS = {
    "tag": "elevator",
    "width": 18.0,              # stage 0 立柱外侧宽度
    "base_height": 38.5,        # stage 0 立柱长度
    "travel": 52.0,             # 总行程（254 2025 ≈ 52"）
    "carriage_length": 8.0,     # carriage 立管长度
    "min_overlap": 8.0,         # 满伸出时 stage0/stage1 最少重叠
    "extension": 0.0,           # 0=收起 1=全伸出（只影响装配体里各级的初始位置）
    "belt_teeth": 60,           # 电机→卷筒轴 HTD5 9mm 皮带齿数（12T:36T = 3:1）
}

T_W, T_D, WALL = 1.0, 2.0, 0.0625    # 2x1x1/16 管：X 向 1"，Y 向 2"
GAP = 0.25                           # 级间隙（WCP-0199 3/4" 轴承配置）
CLR = 0.25
BACK_Y = 2.875                       # 背面横梁前沿
GUSSET_T, PLATE_T = 0.125, 0.25
BOLT_D, RIVET_D, BORE_D = 0.201, 0.191, 1.125
HTD_P = 5 / 25.4                     # HTD 5mm 节距（in）


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


def circle_pts(c, r, n=36):
    return [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def unit(v):
    n = math.sqrt(sum(a * a for a in v))
    return [a / n for a in v]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def perp(v):
    a = [1, 0, 0] if abs(v[0]) < 0.9 else [0, 1, 0]
    return unit(cross(v, a))


class Plan:
    def __init__(self):
        self.steps, self.planes, self.groups, self.cots = [], {}, {}, []
        self.n = 0

    # ---------- part studio ----------
    def plane(self, base, offset):
        key = (base, round(offset, 4))
        if key not in self.planes:
            pid = f"pl{len(self.planes)}"
            self.steps.append({"type": "plane", "id": pid, "base": base, "offset": offset,
                               "name": f"{base} {offset:+.3f}"})
            self.planes[key] = pid
        return self.planes[key]

    def _sk(self, name, base, offset, entities, depth, **kw):
        self.n += 1
        sid, eid = f"sk{self.n}", f"ex{self.n}"
        self.steps += [{"type": "sketch", "id": sid, "plane": self.plane(base, offset), "name": f"{name} sketch",
                        "entities": entities},
                       {"type": "extrude", "id": eid, "sketch": sid, "depth": depth, "name": name, **kw}]

    def part(self, name, group, base, offset, entities, depth, hollow=True, **kw):
        self._sk(name, base, offset, entities, depth, **({"hollow": True} if hollow else {}), **kw)
        self.groups[name] = group

    def holes(self, name, base, offset, centers, dia, depth):
        """贯穿孔：以 plane 为中面对称切除。"""
        ents = [{"kind": "circle", "center": list(c), "radius": dia / 2} for c in centers]
        self._sk(name, base, offset, ents, depth, op="remove", direction="symmetric")

    def vtube(self, name, group, x0, z0, length):
        rects = [{"kind": "rect", "corner": [x0, 0], "size": [T_W, T_D]},
                 {"kind": "rect", "corner": [x0 + WALL, WALL], "size": [T_W - 2 * WALL, T_D - 2 * WALL]}]
        self.part(name, group, "Top", z0, rects, length)

    def xtube(self, name, group, x0, x1, y0, z0, dy, dz):
        rects = [{"kind": "rect", "corner": [y0, z0], "size": [dy, dz]},
                 {"kind": "rect", "corner": [y0 + WALL, z0 + WALL], "size": [dy - 2 * WALL, dz - 2 * WALL]}]
        self.part(name, group, "Right", x0, rects, x1 - x0)

    def xblock(self, name, group, x0, x1, y0, z0, dy, dz, holes=()):
        ents = [{"kind": "rect", "corner": [y0, z0], "size": [dy, dz]}] + list(holes)
        self.part(name, group, "Right", x0, ents, x1 - x0)

    # ---------- assembly ----------
    def place(self, key, group, origin, x=None, y=None, z=None, name=None):
        """COTS 实例：origin 为零件原点的世界坐标（in），x/y/z 为零件局部轴在世界中的方向（给两个即可）。"""
        if x is None:
            x = cross(y, z)
        if y is None:
            y = cross(z, x)
        if z is None:
            z = cross(x, y)
        R = [unit(x), unit(y), unit(z)]
        self.cots.append({"key": key, "group": group, "origin": [round(v, 5) for v in origin],
                          "axes": [[round(v, 6) for v in a] for a in R], "name": name or key})

    def bolt(self, length, group, head, d, nut=True, grip=None):
        """10-32 SHCS：head=螺帽下表面位置，d=拧入方向；nut 放在 head + d*grip 处。
        各长度螺栓在 MKCad 里的自身坐标系不同，按 cots.json 的 bolt.tip_dir / under_head 换算。"""
        key = f"shcs_10_32_{length:g}"
        d = unit(d)
        u, h = COTS[key]["bolt"]["tip_dir"], COTS[key]["bolt"]["under_head"]
        v = perp(u)
        w = perp(d)
        L_ = [u, v, cross(u, v)]            # 局部基
        W_ = [d, w, cross(d, w)]            # 对应的世界基
        R = [[sum(W_[k][i] * L_[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
        axes = [[R[i][j] for i in range(3)] for j in range(3)]   # 局部 x/y/z 轴的世界方向
        Rh = [sum(R[i][j] * h[j] for j in range(3)) for i in range(3)]
        self.place(key, group, [head[i] - Rh[i] for i in range(3)], *axes)
        if nut:
            p = [head[i] + d[i] * grip for i in range(3)]
            self.place("nylock_10_32", group, p, z=d, x=perp(d))

    def rivet(self, group, head, d):
        d = unit(d)
        self.place("rivet_3_16", group, head, z=d, x=perp(d))

    def block(self, group, host_x, tube_end_z, out_dir, stack_dir):
        """WCP-0199：by=管轴向外（out_dir=±Z），bz=朝相邻级（stack_dir=±X）。
        套筒（by∈[-1,0]）插进管端，块头（by∈[0,1]）露在管外；套筒上 3 个 #10-32 螺孔在距管端 1/4、1/2、3/4"。"""
        by, bz = [0, 0, out_dir], [stack_dir, 0, 0]
        o = [host_x, T_D / 2, tube_end_z]
        self.place("wcp_0199_bearing_block", group, o, y=by, z=bz)


def build(p):
    W, H0, T, Lc = p["width"], p["base_height"], p["travel"], p["carriage_length"]
    x0 = W / 2                      # stage0 外侧
    x1 = x0 - T_W - GAP             # stage1 外侧
    x2 = x1 - T_W - GAP             # carriage 外侧
    if x2 - T_W < 3:
        sys.exit(f"width={W} 太窄")
    c0, c1, c2 = x0 - T_W / 2, x1 - T_W / 2, x2 - T_W / 2   # 各级管中心 x

    BLK = 1.0                       # WCP-0199 块头伸出管端的高度
    zb1 = 2.0 + CLR + BLK           # stage1 底：S0 底角撑板顶(2) + 间隙 + 轴承块头
    zc = zb1 + 2.0 + CLR + BLK      # carriage 底：S1 底角撑板顶 + 间隙 + 轴承块头
    t1_max = H0 - zb1 - p["min_overlap"]
    t1 = t2 = T / 2                 # continuous 绳系：stage1 相对地面、carriage 相对 stage1 行程相等
    s1_top_min = H0 + BLK + CLR + 3.0                        # S1 顶部侧角撑板在 S0 顶轴承块之上
    H1 = max(s1_top_min - zb1, t2 + (zc - zb1) + Lc + BLK)   # carriage 顶轴承块不越过 S1 顶
    if t1 <= 0 or t1 > t1_max or H1 > H0 + 8.0:
        sys.exit(f"travel={T} 超出最大行程 {2 * t1_max:.2f}\"（stage1 会比 stage0 高太多），加大 base_height")
    s = max(0.0, min(1.0, p["extension"])) * T
    d1, dc = s / 2, s               # continuous：carriage 速度是 stage1 的 2 倍
    Z1, ZC = zb1 + d1, zc + dc      # 实际姿态下 S1 底、carriage 底
    S1T = Z1 + H1

    P = Plan()
    G0, G1, GC = "stage0", "stage1", "carriage"
    Y = T_D / 2

    # ================= stage 0 =================
    for sd, sfx in ((-1, "L"), (1, "R")):
        P.vtube(f"ELV-001 S0 upright {sfx}", G0, x0 - T_W if sd > 0 else -x0, 0.0, H0)
    P.xtube("ELV-002 S0 bottom crossbar", G0, -(x0 - T_W), x0 - T_W, 0.0, 0.0, T_D, 1.0)
    P.xtube("ELV-003 S0 top crossbar", G0, -x0, x0, BACK_Y, H0 - 2.0, 1.0, 2.0)
    for sd, sfx in ((-1, "L"), (1, "R")):
        # 底角撑板（前、后）：x 从外侧向内 3"
        xa, xb = sorted((sd * x0, sd * (x0 - 3.0)))
        for side, ya in (("front", -GUSSET_T), ("back", T_D)):
            P.part(f"ELV-004 S0 bottom gusset {sfx} {side}", G0, "Front", -ya - GUSSET_T if side == "front" else -ya,
                   [{"kind": "rect", "corner": [xa, 0.0], "size": [xb - xa, 2.0]}], GUSSET_T, hollow=False,
                   **({"direction": "flip"} if side == "back" else {}))
        # 顶侧角撑板：贴 S0 外侧面，向后伸到横梁
        gx = sd * x0 if sd > 0 else -x0 - GUSSET_T
        P.part(f"ELV-005 S0 top gusset {sfx}", G0, "Right", gx,
               [{"kind": "rect", "corner": [0.0, H0 - 3.0], "size": [BACK_Y + 2.75, 3.0]}], GUSSET_T, hollow=False)
        # 横梁端管堵
        px = (x0 - T_W, x0) if sd > 0 else (-x0, -x0 + T_W)
        P.xblock(f"ELV-040 tube plug S0 {sfx}", G0, px[0], px[1], BACK_Y + WALL, H0 - 2.0 + WALL, 1.0 - 2 * WALL,
                 2.0 - 2 * WALL)

    # ================= stage 1 =================
    for sd, sfx in ((-1, "L"), (1, "R")):
        P.vtube(f"ELV-010 S1 tube {sfx}", G1, x1 - T_W if sd > 0 else -x1, Z1, H1)
    P.xtube("ELV-011 S1 bottom crossbar", G1, -(x1 - T_W), x1 - T_W, 0.0, Z1, T_D, 1.0)
    P.xtube("ELV-012 S1 top crossbar", G1, -x1, x1, BACK_Y, S1T - 2.0, 1.0, 2.0)
    for sd, sfx in ((-1, "L"), (1, "R")):
        xa, xb = sorted((sd * x1, sd * (x1 - 3.0)))
        for side, ya in (("front", -GUSSET_T), ("back", T_D)):
            P.part(f"ELV-013 S1 bottom gusset {sfx} {side}", G1, "Front", -ya - GUSSET_T if side == "front" else -ya,
                   [{"kind": "rect", "corner": [xa, Z1], "size": [xb - xa, 2.0]}], GUSSET_T, hollow=False,
                   **({"direction": "flip"} if side == "back" else {}))
        gx = sd * x1 if sd > 0 else -x1 - GUSSET_T
        P.part(f"ELV-014 S1 top gusset {sfx}", G1, "Right", gx,
               [{"kind": "rect", "corner": [0.0, S1T - 3.0], "size": [BACK_Y + 1.5, 3.0]}], GUSSET_T, hollow=False)
        px = (x1 - T_W, x1) if sd > 0 else (-x1, -x1 + T_W)
        P.xblock(f"ELV-040 tube plug S1 {sfx}", G1, px[0], px[1], BACK_Y + WALL, S1T - 2.0 + WALL, 1.0 - 2 * WALL,
                 2.0 - 2 * WALL)

    # ================= carriage =================
    for sd, sfx in ((-1, "L"), (1, "R")):
        P.vtube(f"ELV-020 carriage tube {sfx}", GC, x2 - T_W if sd > 0 else -x2, ZC, Lc)
    cpw = x2 - 0.4                  # 前板半宽：避开 carriage 轴承块前伸部分
    P.part("ELV-021 carriage plate", GC, "Front", 0.0,
           [{"kind": "rect", "corner": [-cpw, ZC], "size": [2 * cpw, Lc]}], PLATE_T, hollow=False)

    # ================= drive（stage0 底部两侧） =================
    ys, zs = 5.0, 2.5                                        # 卷筒轴（后移，让绳车道躲开 S0/S1 顶部横梁）
    r12, r36 = pd(12) / 2, pd(36) / 2
    Lb = p["belt_teeth"] * HTD_P
    C = (Lb - math.pi * (r12 + r36)) / 2                     # 近似中心距，下面迭代修正
    for _ in range(20):
        C = (Lb - math.pi * (r12 + r36) - (r36 - r12) ** 2 / C) / 2
    ym = ys + C                                              # 电机在滚筒正后方（同高），绳从滚筒向上走不会穿过电机
    plate_h, plate_d = zs + 1.75, ym + 1.75
    kr_holes = [(ym - 1, zs), (ym + 1, zs), (ym, zs - 1), (ym, zs + 1)]
    for sd, sfx in ((-1, "L"), (1, "R")):
        gx = x0 if sd > 0 else -x0 - PLATE_T
        ents = [{"kind": "rect", "corner": [0.0, 0.0], "size": [plate_d, plate_h]},
                {"kind": "circle", "center": [ys, zs], "radius": BORE_D / 2},
                {"kind": "circle", "center": [ym, zs], "radius": 0.40}] + \
               [{"kind": "circle", "center": list(h), "radius": BOLT_D / 2} for h in kr_holes]
        P.part(f"ELV-030 drive plate {sfx}", G0, "Right", gx, ents, PLATE_T)
    sl = W + 2 * PLATE_T + 2 * 0.9
    hexr = 0.25 / math.cos(math.pi / 6)
    P.part("ELV-031 drum shaft 1/2in hex", G0, "Right", -sl / 2,
           [{"kind": "polygon", "points": [[ys + hexr * math.cos(math.pi / 3 * i), zs + hexr * math.sin(math.pi / 3 * i)]
                                           for i in range(6)]}], sl, hollow=False)
    px_c = x0 + PLATE_T + 0.063 + 0.05 + 0.285              # 36T/12T 皮带轮中心 x（外侧）
    bw = 9 / 25.4
    for sd, sfx in ((-1, "L"), (1, "R")):
        outer = hull(circle_pts((ys, zs), r36 + 0.09) + circle_pts((ym, zs), r12 + 0.09))
        inner = hull(circle_pts((ys, zs), r36 - 0.05) + circle_pts((ym, zs), r12 - 0.05))
        P.part(f"ELV-041 HTD5 9mm {p['belt_teeth']}T belt {sfx}", G0, "Right", sd * px_c - bw / 2,
               [{"kind": "polygon", "points": outer}, {"kind": "polygon", "points": inner}], bw)


    # ================= 绳系（continuous）：每侧 4 根绳，全部为直线段 + 滑轮 =================
    # S1 上行绳：S1 底部后tab → 上到 S0 顶后轴滑轮 → 回到滚筒背面（卷筒收绳 = S1 上升）
    # S1 下行绳：S1 顶部后tab → 直接下到滚筒正面（卷筒放绳 = S1 下降的反向）
    # Carriage 上行绳：S0 底前锚 → 上到 S1 顶滑轮 → 下到 carriage 底tab    （carriage 相对 S1 同速上升）
    # Carriage 下行绳：S0 顶前锚 → 下到 S1 底滑轮 → 上到 carriage 顶tab
    GR = "rigging"
    CR, RS, ST, BORE, AX = 0.0625, 0.5, 0.25, 0.13, 0.125     # 绳半径、滑轮半径/厚、轴孔、轴半径
    RE = RS + CR                                               # 绳中心到滑轮中心
    DR = 0.8                                                   # 滚筒绳半径（24T 带轮外缘，近似）
    xu, xd = c1 - 0.15, c1 + 0.15                              # 后部两条 stage1 绳的 x 车道
    y_b, y_f = ys + DR, ys - DR
    y_sh, z_sh = y_b - RE, H0 - 1.0                            # S0 后轴
    xcu, xcd = c1 - 0.25, c1 + 0.20                            # 前部 carriage 上/下行绳 x 车道
    yo_u, yo_d = -1.0, -0.5                                    # 靠 carriage 一侧的绳 y
    yc_u, yc_d = yo_u - RE, yo_d - RE                          # 滑轮中心 y
    yi_u, yi_d = yc_u - RE, yc_d - RE                          # 靠锚点一侧的绳 y
    zs2, zsd = S1T - 1.0, Z1 + 1.2                             # S1 顶滑轮 / S1 底滑轮 中心高度
    za_u, za_d = 1.125, H0 - 1.125                             # S0 底锚顶面 / S0 顶锚底面
    PT = 0.125                                                 # tab 板厚

    def span(a, b, sd):
        lo, hi = sorted((sd * a, sd * b))
        return lo, hi - lo

    def rod(name, x, y, za, zb):
        P.part(name, GR, "Top", min(za, zb), [{"kind": "circle", "center": [x, y], "radius": CR}], abs(zb - za),
               hollow=False)

    def sheave(name, grp, x, y, z):
        P.part(name, grp, "Right", x - ST / 2, [{"kind": "circle", "center": [y, z], "radius": RS},
                                               {"kind": "circle", "center": [y, z], "radius": BORE}], ST)

    def axle(name, grp, xa, xb, y, z):
        lo, ln = min(xa, xb), abs(xb - xa)
        P.part(name, grp, "Right", lo, [{"kind": "circle", "center": [y, z], "radius": AX}], ln, hollow=False)

    def clevis(name, grp, cx, yfront, ymax, z0, dz, yc, zc_):
        for k, sgn in (("a", -1), ("b", 1)):
            xm = cx + sgn * 0.19
            P.xblock(f"{name} {k}", grp, xm - PT / 2, xm + PT / 2, yfront, z0, ymax - yfront, dz,
                     holes=[{"kind": "circle", "center": [yc, zc_], "radius": BORE}])

    xs = x0 + GUSSET_T
    P.part("ELV-050 S0 rear shaft", G0, "Right", -xs, [{"kind": "circle", "center": [y_sh, z_sh], "radius": AX}],
           2 * xs, hollow=False)
    for sd, sfx in ((-1, "L"), (1, "R")):
        P.holes(f"holes X S0 rear shaft {sfx}", "Right", sd * (x0 + GUSSET_T / 2), [(y_sh, z_sh)], BORE * 2,
                GUSSET_T + 0.1)
        # --- 后部：S1 上行绳 / 下行绳
        sheave(f"ELV-051 S0 rear sheave {sfx}", G0, sd * xu, y_sh, z_sh)
        y_u1 = y_b - 2 * RE
        P.xblock(f"ELV-052 S1 up tab {sfx}", G1, sd * xu - PT / 2, sd * xu + PT / 2, T_D + GUSSET_T, Z1 + 1.0,
                 y_u1 + 0.2 - (T_D + GUSSET_T), 0.5)
        P.xblock(f"ELV-053 S1 down tab {sfx}", G1, sd * xd - PT / 2, sd * xd + PT / 2, BACK_Y + 1.0, S1T - 1.5,
                 y_f + 0.2 - (BACK_Y + 1.0), 0.5)
        rod(f"ELV-060 rope S1 up A {sfx}", sd * xu, y_u1, Z1 + 1.5, z_sh)
        rod(f"ELV-061 rope S1 up B {sfx}", sd * xu, y_b, zs, z_sh)
        rod(f"ELV-062 rope S1 down {sfx}", sd * xd, y_f, zs, S1T - 1.5)
        # --- 前部：carriage 上行绳（S1 顶滑轮）
        sheave(f"ELV-054 S1 top sheave {sfx}", G1, sd * xcu, yc_u, zs2)
        clevis(f"ELV-055 S1 top clevis {sfx}", G1, sd * xcu, yi_u - 0.15, 0.0, S1T - 2.0, 1.8, yc_u, zs2)
        axle(f"ELV-056 S1 top axle {sfx}", G1, sd * (xcu - 0.2525), sd * (xcu + 0.2525), yc_u, zs2)
        lo, ln = span(cpw, xcu + 0.15, sd)
        P.part(f"ELV-057 carriage bottom tab {sfx}", GC, "Top", ZC,
               [{"kind": "rect", "corner": [lo, yo_u - 0.1], "size": [ln, -(yo_u - 0.1)]}], PT, hollow=False)
        lo, ln = span(xcu - 0.1, x0 - 0.1, sd)
        P.part(f"ELV-058 S0 bottom anchor {sfx}", G0, "Top", za_u - PT,
               [{"kind": "rect", "corner": [lo, yi_u - 0.1], "size": [ln, -GUSSET_T - (yi_u - 0.1)]}], PT, hollow=False)
        rod(f"ELV-063 rope carriage up A {sfx}", sd * xcu, yi_u, za_u, zs2)
        rod(f"ELV-064 rope carriage up B {sfx}", sd * xcu, yo_u, ZC + PT, zs2)
        # --- 前部：carriage 下行绳（S1 底滑轮）
        sheave(f"ELV-070 S1 bottom sheave {sfx}", G1, sd * xcd, yc_d, zsd)
        clevis(f"ELV-071 S1 bottom clevis {sfx}", G1, sd * xcd, yi_d - 0.15, -GUSSET_T, Z1 + 0.95, 1.15, yc_d, zsd)
        axle(f"ELV-072 S1 bottom axle {sfx}", G1, sd * (xcd - 0.2525), sd * (xcd + 0.2525), yc_d, zsd)
        lo, ln = span(cpw, xcd + 0.15, sd)
        P.part(f"ELV-073 carriage top tab {sfx}", GC, "Top", ZC + Lc - PT,
               [{"kind": "rect", "corner": [lo, yo_d - 0.1], "size": [ln, -(yo_d - 0.1)]}], PT, hollow=False)
        lo, ln = span(xcd - 0.1, x0 - 0.1, sd)
        P.part(f"ELV-074 S0 top anchor {sfx}", G0, "Top", za_d,
               [{"kind": "rect", "corner": [lo, yi_d - 0.1], "size": [ln, -(yi_d - 0.1)]},
                {"kind": "circle", "center": [sd * xcd, yo_d], "radius": 0.15}], PT)   # carriage 绳从孔中穿过
        rod(f"ELV-065 rope carriage down A {sfx}", sd * xcd, yi_d, zsd, za_d)
        rod(f"ELV-066 rope carriage down B {sfx}", sd * xcd, yo_d, zsd, ZC + Lc - PT)
    rope = {"s1_up": (z_sh - (Z1 + 1.5)) + (z_sh - zs), "s1_down": (S1T - 1.5) - zs,
            "carriage_up": (zs2 - za_u) + (zs2 - (ZC + PT)),
            "carriage_down": (za_d - zsd) + ((ZC + Lc - PT) - zsd)}

    # ================= 孔（与下面的螺栓共用同一组坐标） =================
    BK = (0.25, 0.5, 0.75)          # WCP-0199 套筒螺孔距管端
    s0_bot = lambda sd: [(sd * c0, 0.5), (sd * c0, 1.5), (sd * (c0 - 1.0), 0.5), (sd * (c0 - 2.0), 0.5)]
    s1_bot = lambda sd: [(sd * c1, Z1 + k) for k in BK] + [(sd * (c1 - 1.0), Z1 + 0.5), (sd * (c1 - 2.0), Z1 + 0.5)]
    s0_blk = lambda sd: [(sd * c0, H0 - k) for k in BK]
    car = lambda sd: [(sd * c2, ZC + k) for k in BK] + [(sd * c2, ZC + Lc / 2)] + [(sd * c2, ZC + Lc - k) for k in BK]
    top_rivets = lambda top: [(0.5, top - 1.5), (1.5, top - 1.5), (0.5, top - 2.5), (1.5, top - 2.5)]
    P.holes("holes Y gussets", "Front", -Y, [h for sd in (-1, 1) for h in s0_bot(sd) + s1_bot(sd)], BOLT_D,
            T_D + 2 * GUSSET_T + 0.05)
    P.holes("holes Y S0 block", "Front", -Y, [h for sd in (-1, 1) for h in s0_blk(sd)], BOLT_D, T_D + 0.05)
    P.holes("holes Y carriage", "Front", -(T_D - PLATE_T) / 2, [h for sd in (-1, 1) for h in car(sd)],
            BOLT_D, T_D + PLATE_T + 0.05)
    grid = [(x / 2, ZC + 1.0 + k) for x in range(-9, 10, 3) for k in range(int(Lc) - 1)]
    P.holes("holes carriage plate grid", "Front", PLATE_T / 2, grid, BOLT_D, PLATE_T + 0.02)
    P.holes("holes Z base mount", "Top", 0.5, [(sd * a, Y) for sd in (-1, 1) for a in (2.0, 5.0)], BOLT_D, 1.1)
    for sd in (-1, 1):
        P.holes("holes X drive plate", "Right", sd * (c0 + PLATE_T / 2), [(0.5, 1.0), (1.5, 1.0)], BOLT_D,
                T_W + PLATE_T + 0.05)
    for sd, (xo, top, xz) in ((sd, v) for sd in (-1, 1) for v in ((x0, H0, c0 - 0.15), (x1, S1T, c1 - 0.15))):
        # 角撑板→管堵（X 向）、管堵固定（Z 向）、角撑板→立管铆钉（X 向，避开管端轴承块套筒）
        P.holes("holes X plug", "Right", sd * (xo - 0.13), [(BACK_Y + 0.5, top - 1.5), (BACK_Y + 0.5, top - 0.5)],
                BOLT_D, 0.56)
        P.holes("holes Z plug", "Top", top - 1.0, [(sd * xz, BACK_Y + 0.5)], BOLT_D, 2.1)
        P.holes("holes X rivet", "Right", sd * (xo + 0.03), top_rivets(top), RIVET_D, 0.25)

    # ================= 装配：标准件 =================
    for sd in (-1, 1):
        # --- 轴承块（WCP-0199）
        P.block(G0, sd * c0, H0, +1, -sd)          # S0 顶：导向 S1
        P.block(G1, sd * c1, Z1, -1, +sd)          # S1 底：在 S0 内侧面上滚
        P.block(GC, sd * c2, ZC, -1, +sd)          # carriage 底：在 S1 内侧面上滚
        P.block(GC, sd * c2, ZC + Lc, +1, +sd)     # carriage 顶
        # --- 螺栓（Y 向，前→后），螺母在背面；S1 底和 carriage 的螺栓同时穿过轴承块套筒
        for (x, z) in s0_bot(sd):
            P.bolt(2.5, G0, [x, -GUSSET_T, z], [0, 1, 0], grip=T_D + 2 * GUSSET_T)
        for (x, z) in s1_bot(sd):
            P.bolt(2.5, G1, [x, -GUSSET_T, z], [0, 1, 0], grip=T_D + 2 * GUSSET_T)
        for (x, z) in s0_blk(sd):
            P.bolt(2.25, G0, [x, 0.0, z], [0, 1, 0], grip=T_D)
        for (x, z) in car(sd):
            P.bolt(2.5, GC, [x, -PLATE_T, z], [0, 1, 0], grip=T_D + PLATE_T)
        # --- 顶部角撑板：铆钉 + 管堵螺栓
        for grp, xo, top, xz in ((G0, x0, H0, c0 - 0.15), (G1, x1, S1T, c1 - 0.15)):
            for (yy, zz) in top_rivets(top):
                P.rivet(grp, [sd * (xo + GUSSET_T), yy, zz], [-sd, 0, 0])
            for zz in (top - 1.5, top - 0.5):
                P.bolt(0.5, grp, [sd * (xo + GUSSET_T), BACK_Y + 0.5, zz], [-sd, 0, 0], nut=False)
            P.bolt(2.25, grp, [sd * xz, BACK_Y + 0.5, top], [0, 0, -1], grip=2.0)
        # --- 电机板→立管螺栓（X 向，由外向内）
        for yy in (0.5, 1.5):
            P.bolt(1.5, G0, [sd * (x0 + PLATE_T), yy, 1.0], [-sd, 0, 0], grip=T_W + PLATE_T)
        # --- 驱动：法兰轴承、Kraken、皮带轮
        P.place("bearing_flanged_half_hex", G0, [sd * x0, ys, zs], z=[sd, 0, 0], x=[0, 1, 0])
        P.place("kraken_x60", G0, [sd * (x0 - 1.23), ym, zs], y=[-sd, 0, 0], z=[0, 0, 1])
        P.place("pulley_12t_9mm_falcon", G0, [sd * px_c, ym, zs], z=[sd, 0, 0], x=[0, 1, 0])
        P.place("pulley_36t_9mm_half_hex", G0, [sd * px_c, ys, zs], y=[sd, 0, 0], z=[0, 0, 1])
        P.place("pulley_24t_9mm_half_hex", G0, [sd * c1, ys, zs], y=[sd, 0, 0], z=[0, 0, 1], name="drum 24T")
        for (yy, zz) in kr_holes:
            P.bolt(0.5, G0, [sd * (x0 + PLATE_T), yy, zz], [-sd, 0, 0], nut=False)

    info = {"stage1_travel": round(t1, 3), "carriage_travel": round(t2, 3),
            "max_travel": round(2 * t1_max, 3), "rope_length_in": {k: round(v, 4) for k, v in rope.items()},
            "overlap_at_full": round(H0 - (zb1 + t1), 3), "stowed_height": round(zb1 + H1, 3),
            "drive": f"Kraken X60 ×2 → 12T:36T ({p['belt_teeth']}T belt, C={C:.3f}\") → 24T drum → continuous 绳系",
            "free_speed_in_s": round(6000 / 3 / 60 * math.pi * pd(24), 1)}
    asm = {"name": "Elevator Assembly", "groups": P.groups, "cots": P.cots,
           "sliders": [{"name": "Stage 1 slider", "a": "ELV-001 S0 upright L", "b": "ELV-010 S1 tube L"},
                       {"name": "Carriage slider", "a": "ELV-010 S1 tube L", "b": "ELV-020 carriage tube L"}]}
    return {"name": "elevator", "tag": p["tag"], "units": "in", "steps": P.steps, "info": info, "assembly": asm}


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
