"""Concept render of the finished Scheme 2A system (stage S5): the glass tank with
a floating apple-shaped ferrofluid blob, 26 coils, frame, cameras, IR backlights
and electronics, with numbered parts for a bill-of-materials review.

Run: python ferrofluid_tank/final_system_render.py  ->  ferrofluid_tank/final_system_render.png
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from glass_panels import INNER, OUTER, T
from tank_render import (GASKET, GLASS, GLASS_EDGE, LID, LID_T, LIQUID, TUBE_H, TUBE_ID, TUBE_OD,
                         add_box, add_cylinder, nz)

H1 = (OUTER - 3 / 4, OUTER - 3 / 4)
TOP = T + INNER
LID_TOP = TOP + GASKET + LID_T
C = np.array([OUTER / 2, OUTER / 2, T + INNER / 2])   # tank centre

ALU = (0.75, 0.77, 0.80, 1.0)
ALU_EDGE = (0.45, 0.47, 0.50, 1.0)
COPPER = "#b5651d"
IRPANEL = (0.55, 0.15, 0.20, 0.35)
DARK = (0.18, 0.18, 0.2, 1.0)

COIL_R, COIL_L = 0.42, 1.25
PITCH = 1.05
GRID = [OUTER / 2 + PITCH * k for k in (-1, 0, 1)]


def oriented_cylinder(ax, p0, p1, r, color, n=28):
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    axis = p1 - p0
    a = axis / np.linalg.norm(axis)
    ref = np.array([0, 0, 1.0]) if abs(a[2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(a, ref)
    u /= np.linalg.norm(u)
    v = np.cross(a, u)
    th = np.linspace(0, 2 * np.pi, n)
    s = np.array([0.0, 1.0])
    TH, S = np.meshgrid(th, s)
    X = p0[0] + axis[0] * S + r * (np.cos(TH) * u[0] + np.sin(TH) * v[0])
    Y = p0[1] + axis[1] * S + r * (np.cos(TH) * u[1] + np.sin(TH) * v[1])
    Z = p0[2] + axis[2] * S + r * (np.cos(TH) * u[2] + np.sin(TH) * v[2])
    ax.plot_surface(X, Y, Z, color=color, linewidth=0, shade=True, zorder=nz())
    # pole face toward the tank
    Xc = p1[0] + 0.55 * r * (np.cos(th) * u[0] + np.sin(th) * v[0])
    Yc = p1[1] + 0.55 * r * (np.cos(th) * u[1] + np.sin(th) * v[1])
    Zc = p1[2] + 0.55 * r * (np.cos(th) * u[2] + np.sin(th) * v[2])
    ax.plot(Xc, Yc, Zc, color="#555", lw=0.8, zorder=nz())


def coil_vertical(ax, x, y, z0, z1):
    add_cylinder(ax, x, y, z0, z1, COIL_R, COPPER)
    add_cylinder(ax, x, y, z1 if z1 > z0 else z0, (z1 if z1 > z0 else z0) + 0.08, 0.16, "#888")


def apple(ax, c, R=0.62):
    t, p = np.mgrid[0:np.pi:40j, 0:2 * np.pi:48j]
    r = R * (1 + 0.10 * np.sin(t) ** 2) * (1 - 0.30 * np.exp(-(t / 0.42) ** 2)
                                           - 0.18 * np.exp(-((np.pi - t) / 0.45) ** 2))
    X = c[0] + r * np.sin(t) * np.cos(p)
    Y = c[1] + r * np.sin(t) * np.sin(p)
    Z = c[2] + 0.92 * r * np.cos(t)
    ax.plot_surface(X, Y, Z, color="#050505", linewidth=0, shade=True, zorder=nz())
    add_cylinder(ax, c[0], c[1], c[2] + 0.92 * R * 0.72, c[2] + 0.92 * R * 1.05, 0.035, "#111")  # stem spike


def corner_coils(ax, which):
    pts = []
    for cx in (0, OUTER):
        for cy in (0, OUTER):
            for cz in (0, TOP + GASKET):
                corner = np.array([cx, cy, cz], float)
                d = (C - corner) / np.linalg.norm(C - corner)
                p1 = corner - d * 0.25
                p0 = p1 - d * COIL_L
                far = cy > OUTER / 2 or cx < OUTER / 2
                if far == (which == "far"):
                    oriented_cylinder(ax, p0, p1, COIL_R, COPPER)
                pts.append(p0)
    return pts


def frame_post(ax, x, y):
    add_box(ax, (x - 0.25, x + 0.25, y - 0.25, y + 0.25, -2.4, 7.0), ALU, ALU_EDGE, lw=0.5)


def build(ax):
    ax.computed_zorder = False
    # base plate
    add_box(ax, (-2.6, 13.0, -2.6, 7.0, -2.75, -2.5), (0.30, 0.30, 0.32, 1), (0.2, 0.2, 0.2, 1))
    # far frame posts and IR backlights (back wall and left wall)
    for x, y in [(-1.9, OUTER + 1.9), (OUTER + 1.9, OUTER + 1.9), (-1.9, -1.9)]:
        frame_post(ax, x, y)
    add_box(ax, (-0.3, OUTER + 0.3, OUTER + 1.35, OUTER + 1.5, -0.2, TOP + 0.3), IRPANEL, (0.5, 0.1, 0.1, 1))
    add_box(ax, (-1.5, -1.35, -0.3, OUTER + 0.3, -0.2, TOP + 0.3), IRPANEL, (0.5, 0.1, 0.1, 1))
    corner_coils(ax, "far")
    # bottom coil array on its aluminium heat-sink plate, with fan
    add_box(ax, (-0.4, OUTER + 0.4, -0.4, OUTER + 0.4, -2.1, -1.85), ALU, ALU_EDGE)
    add_box(ax, (1.2, 3.2, 1.2, 3.2, -2.45, -2.1), DARK, DARK)
    for gx in GRID:
        for gy in GRID:
            coil_vertical(ax, gx, gy, -1.85, -1.85 + COIL_L)
    # tank
    add_box(ax, (0, OUTER, 0, OUTER, 0, T), GLASS, GLASS_EDGE)
    add_box(ax, (0, OUTER, OUTER - T, OUTER, T, TOP), GLASS, GLASS_EDGE)
    add_box(ax, (0, T, T, OUTER - T, T, TOP), GLASS, GLASS_EDGE)
    add_box(ax, (T, OUTER - T, T, OUTER - T, T, TOP), LIQUID, (0, 0, 0, 0), lw=0)
    add_cylinder(ax, *H1, TOP - 1.0, TOP, 1 / 16, "#9aa3ab")
    apple(ax, C)
    add_box(ax, (OUTER - T, OUTER, T, OUTER - T, T, TOP), GLASS, GLASS_EDGE)
    add_box(ax, (0, OUTER, 0, T, T, TOP), GLASS, GLASS_EDGE)
    add_box(ax, (0, OUTER, 0, OUTER, TOP, TOP + GASKET), (0.55, 0.55, 0.55, 1), (0.35, 0.35, 0.35, 1), lw=0.3)
    add_box(ax, (0, OUTER, 0, OUTER, TOP + GASKET, LID_TOP), LID, (0.42, 0.35, 0.23, 1), lw=0.8)
    # top coil array (corner position next to the expansion tube left out) and its plate
    zc0 = LID_TOP + 0.1
    for gx in GRID:
        for gy in GRID:
            if gx > OUTER / 2 and gy > OUTER / 2:
                continue
            add_cylinder(ax, gx, gy, zc0, zc0 + COIL_L, COIL_R, COPPER)
    add_box(ax, (-0.4, OUTER + 0.4, -0.4, OUTER + 0.4, zc0 + COIL_L, zc0 + COIL_L + 0.25), ALU, ALU_EDGE)
    add_box(ax, (1.2, 3.2, 1.2, 3.2, zc0 + COIL_L + 0.25, zc0 + COIL_L + 0.6), DARK, DARK)
    # expansion tube + probe through the top plate
    add_cylinder(ax, *H1, LID_TOP, LID_TOP + 1.0, TUBE_ID / 2, "#e8c66a", alpha=0.8)
    add_cylinder(ax, *H1, LID_TOP, LID_TOP + TUBE_H, TUBE_OD / 2, "#9fd3e6", alpha=0.35)
    add_cylinder(ax, *H1, LID_TOP, LID_TOP + TUBE_H + 0.8, 1 / 16, "#9aa3ab")
    corner_coils(ax, "near")
    frame_post(ax, OUTER + 1.9, -1.9)
    # cameras: front (looks at back backlight) and right side (looks at left backlight)
    add_box(ax, (1.6, 2.8, -4.4, -3.4, 1.4, 2.6), DARK, DARK)
    add_cylinder(ax, 2.2, -3.4, 1.9, 2.1, 0.3, "#333")
    add_box(ax, (OUTER + 3.4, OUTER + 4.4, 1.6, 2.8, 1.4, 2.6), DARK, DARK)
    for x, y in [(2.2, -3.9), (OUTER + 3.9, 2.2)]:
        add_box(ax, (x - 0.1, x + 0.1, y - 0.1, y + 0.1, -2.5, 1.4), (0.4, 0.4, 0.4, 1), (0.3, 0.3, 0.3, 1))
    # electronics bay
    add_box(ax, (8.0, 12.4, 0.0, 2.6, -2.5, -1.3), (0.15, 0.35, 0.18, 1), (0.1, 0.2, 0.1, 1))   # driver board
    for i in range(9):
        add_box(ax, (8.2 + i * 0.46, 8.5 + i * 0.46, 0.3, 0.9, -1.3, -1.1), DARK, DARK)
    add_box(ax, (8.0, 12.4, 3.2, 6.2, -2.5, -0.9), (0.55, 0.57, 0.6, 1), (0.3, 0.3, 0.3, 1))    # PSU
    add_box(ax, (11.0, 12.4, 0.2, 1.4, -1.3, -0.9), (0.1, 0.3, 0.6, 1), (0.1, 0.1, 0.3, 1))     # MCU
    add_box(ax, (8.4, 9.8, 1.4, 2.4, -1.3, -0.8), (0.95, 0.85, 0.55, 1), (0.5, 0.4, 0.2, 1))    # temp logger


PARTS = [
    # (number, label, anchor xyz, text offset xyz)
    (1, "玻璃缸 + 甘油溶液", (OUTER, 0.3, 1.0), (2.2, -3.0, -1.6)),
    (2, "苹果形磁流体（EFH1）", (C[0] + 0.5, C[1] - 0.5, C[2]), (5.5, -5.0, 1.2)),
    (3, "Delrin 盖板 + 密封垫", (OUTER, 0, LID_TOP), (4.0, -4.0, 1.6)),
    (4, "膨胀管 + 温度探头", (*H1, LID_TOP + TUBE_H), (1.2, 1.0, 1.2)),
    (5, "顶部线圈阵列（8 个）", (0.3, 0.3, LID_TOP + 0.8), (-2.0, -1.2, 1.6)),
    (6, "底部线圈阵列（9 个）", (0.3, 0.3, -1.2), (-4.5, -2.5, -1.2)),
    (7, "角线圈（8 个）", (-0.6, -0.6, -0.6), (-1.0, -1.4, -0.9)),
    (8, "铝散热板 + 风扇", (OUTER + 0.4, 0, -2.0), (1.8, -1.2, -0.3)),
    (9, "铝框架", (-1.9, -1.9, 6.5), (0.0, -0.4, 0.7)),
    (10, "红外背光板（2 块）", (-1.4, OUTER, TOP), (-3.0, 2.0, 1.8)),
    (11, "红外摄像头（2 个）", (2.2, -3.9, 2.6), (-2.5, -2.5, 1.5)),
    (12, "H 桥驱动板（26 路）", (10.0, 0.0, -1.3), (1.5, -3.5, 1.5)),
    (13, "主控（Teensy 4.1）", (11.7, 0.8, -0.9), (1.5, -2.5, 2.4)),
    (14, "24 V 电源", (10.2, 6.2, -0.9), (1.5, 1.0, 1.6)),
    (15, "温度记录器", (9.1, 1.9, -0.8), (0.0, 1.2, 2.4)),
]


def main():
    plt.rcParams["font.family"] = ["WenQuanYi Zen Hei", "DejaVu Sans"]
    fig = plt.figure(figsize=(20, 12))
    ax = fig.add_axes([0.0, 0.02, 0.70, 0.90], projection="3d")
    build(ax)
    for n, _, (x, y, z), (dx, dy, dz) in PARTS:
        ax.plot([x, x + dx], [y, y + dy], [z, z + dz], color="#666", lw=0.7, zorder=nz())
        ax.text(x + dx, y + dy, z + dz, f" {n} ", fontsize=12, fontweight="bold", color="white",
                bbox=dict(boxstyle="circle,pad=0.25", fc="#1f4e79", ec="none"), zorder=nz())
    ax.set_box_aspect((15.6, 9.6, 10.5))
    ax.set_xlim(-2.6, 13.0)
    ax.set_ylim(-2.6, 7.0)
    ax.set_zlim(-2.8, 7.7)
    ax.view_init(elev=20, azim=-60)
    ax.set_axis_off()

    side = fig.add_axes([0.70, 0.05, 0.29, 0.85])
    side.axis("off")
    side.text(0, 1.0, "零件编号", fontsize=15, fontweight="bold", va="top")
    for i, (n, label, _, _) in enumerate(PARTS):
        side.text(0.0, 0.94 - i * 0.052, f"{n:>2}", fontsize=12, fontweight="bold", color="#1f4e79", va="top")
        side.text(0.09, 0.94 - i * 0.052, label, fontsize=12, va="top")
    side.text(0, 0.12, "注：\n· 顶部阵列靠膨胀管的那个角位与膨胀管冲突，图中去掉了\n"
              "· 框架为示意，具体结构按你已做好的框架\n· 线圈、风扇、走线均为示意尺寸",
              fontsize=10, color="#555", va="top", linespacing=1.6)
    fig.suptitle("磁流体悬浮平台 · 最终成品效果图（S5 阶段，单位：英寸）", fontsize=18, fontweight="bold", y=0.97)
    out = Path(__file__).with_name("final_system_render.png")
    fig.savefig(out, dpi=130)
    print(out)


if __name__ == "__main__":
    main()
