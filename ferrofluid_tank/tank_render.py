"""3D render of the assembled ferrofluid tank (assembled + exploded views).

Run: python ferrofluid_tank/tank_render.py  ->  ferrofluid_tank/tank_render.png
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

from glass_panels import INNER, OUTER, T

LID_T = 1 / 4
GASKET = 1 / 16
TUBE_OD, TUBE_ID, TUBE_H = 1 / 2, 3 / 8, 4.0
LIQ_IN_TUBE = 1.0
BLOB_R = 0.6
H1 = (OUTER - 5 / 8, OUTER - 5 / 8)
H2 = (5 / 8, OUTER - 5 / 8)
H3 = (OUTER - 5 / 8, 5 / 8)

GLASS = (0.72, 0.88, 0.95, 0.22)
GLASS_EDGE = (0.17, 0.44, 0.54, 0.9)
LIQUID = (0.96, 0.86, 0.55, 0.28)
LID = (0.95, 0.93, 0.88, 1.0)
GASKET_C = (0.55, 0.55, 0.55, 1.0)


def box_faces(x0, x1, y0, y1, z0, z1):
    p = np.array([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
                  [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])
    idx = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]]
    return [p[i] for i in idx]


_Z = [0]


def nz():
    """Next zorder: parts are drawn back-to-front for the fixed camera."""
    _Z[0] += 1
    return _Z[0]


def add_box(ax, bounds, face, edge=None, lw=0.6):
    ax.add_collection3d(Poly3DCollection(box_faces(*bounds), facecolors=face,
                                         edgecolors=edge or face, linewidths=lw, zorder=nz()))


def add_cylinder(ax, cx, cy, z0, z1, r, color, alpha=1.0, n=40):
    th = np.linspace(0, 2 * np.pi, n)
    z = np.array([z0, z1])
    TH, Z = np.meshgrid(th, z)
    ax.plot_surface(cx + r * np.cos(TH), cy + r * np.sin(TH), Z, color=color, alpha=alpha,
                    linewidth=0, shade=True, zorder=nz())
    top = [list(zip(cx + r * np.cos(th), cy + r * np.sin(th), np.full(n, z1)))]
    ax.add_collection3d(Poly3DCollection(top, facecolors=color, alpha=alpha, linewidths=0, zorder=nz()))


def add_disc(ax, cx, cy, z, r, color, n=40):
    th = np.linspace(0, 2 * np.pi, n)
    ax.add_collection3d(Poly3DCollection([list(zip(cx + r * np.cos(th), cy + r * np.sin(th),
                                                   np.full(n, z)))], facecolors=color, linewidths=0,
                                         zorder=nz()))


def add_sphere(ax, c, r, color):
    u, v = np.mgrid[0:2 * np.pi:40j, 0:np.pi:20j]
    ax.plot_surface(c[0] + r * np.cos(u) * np.sin(v), c[1] + r * np.sin(u) * np.sin(v),
                    c[2] + r * np.cos(v), color=color, linewidth=0, shade=True, zorder=nz())


def draw_tank(ax, explode=0.0, filled=True):
    """explode > 0 pulls the parts apart (inches). Drawn back-to-front."""
    ax.computed_zorder = False
    e = explode
    top = T + INNER
    gz = top + 1.0 * e
    lz = top + GASKET + 2.0 * e
    lid_top = lz + LID_T
    tz = lid_top + 1.2 * e

    add_box(ax, (0, OUTER, 0, OUTER, -e, T - e), GLASS, GLASS_EDGE)                      # A bottom
    add_box(ax, (0, OUTER, OUTER - T + e, OUTER + e, T, top), GLASS, GLASS_EDGE)          # B back
    add_box(ax, (-e, T - e, T, OUTER - T, T, top), GLASS, GLASS_EDGE)                     # C left
    if filled:
        add_box(ax, (T, OUTER - T, T, OUTER - T, T, top), LIQUID, (0, 0, 0, 0), lw=0)
        add_cylinder(ax, *H3, top - 1.5, top, 1 / 16, "#9aa3ab")                          # probe, wet part
        add_sphere(ax, (OUTER / 2, OUTER / 2, T + INNER / 2), BLOB_R, "#141414")
    add_box(ax, (OUTER - T + e, OUTER + e, T, OUTER - T, T, top), GLASS, GLASS_EDGE)      # C right
    add_box(ax, (0, OUTER, -e, T - e, T, top), GLASS, GLASS_EDGE)                         # B front

    for b in [(0, OUTER, OUTER - T, OUTER, gz, gz + GASKET), (0, T, T, OUTER - T, gz, gz + GASKET),
              (OUTER - T, OUTER, T, OUTER - T, gz, gz + GASKET), (0, OUTER, 0, T, gz, gz + GASKET)]:
        add_box(ax, b, GASKET_C, (0.35, 0.35, 0.35, 1), lw=0.3)                          # gasket
    add_box(ax, (0, OUTER, 0, OUTER, lz, lid_top), LID, (0.42, 0.35, 0.23, 1), lw=0.8)   # lid
    for (hx, hy), r in [(H1, TUBE_OD / 2), (H2, 0.1), (H3, 3 / 32)]:
        add_disc(ax, hx, hy, lid_top + 0.002, r, "#3a3a3a")

    base = tz if e else lid_top
    if filled:
        add_cylinder(ax, *H1, lid_top, lid_top + LIQ_IN_TUBE, TUBE_ID / 2, "#e8c66a", alpha=0.8)
    add_cylinder(ax, *H1, base, base + TUBE_H, TUBE_OD / 2, "#9fd3e6", alpha=0.3)        # tube
    add_cylinder(ax, *H2, base, base + 0.12, 0.22, "#f7f7f2")                             # plug
    add_cylinder(ax, *H3, base, base + (0.5 if not e else 2.0), 1 / 16, "#9aa3ab")         # probe, dry part
    return lid_top, tz


def style(ax, title, zmax):
    ax.set_box_aspect((OUTER + 2, OUTER + 2, zmax + 0.5))
    ax.set_xlim(-1, OUTER + 1)
    ax.set_ylim(-1, OUTER + 1)
    ax.set_zlim(-1.2 if "爆炸" in title else -0.2, zmax)
    ax.view_init(elev=22, azim=-58)
    ax.set_axis_off()
    ax.set_title(title, fontsize=15, fontweight="bold", pad=0)


def label(ax, xyz, text, dx=0.0, dz=0.0, color="#333"):
    x, y, z = xyz
    ax.plot([x, x + dx], [y, y], [z, z + dz], color="#888", lw=0.7)
    ax.text(x + dx, y, z + dz, text, fontsize=10, color=color)


def main():
    plt.rcParams["font.family"] = ["WenQuanYi Zen Hei", "DejaVu Sans"]
    fig = plt.figure(figsize=(17, 10))

    ax1 = fig.add_subplot(1, 2, 1, projection="3d")
    lid_top, _ = draw_tank(ax1, explode=0.0, filled=True)
    style(ax1, "装配完成（灌液后）", 9.0)
    label(ax1, (*H1, lid_top + TUBE_H), "H1 膨胀管 Ø1/2\"", dx=0.6, dz=0.3)
    label(ax1, (*H1, lid_top + LIQ_IN_TUBE), "液面约高出盖板 1\"", dx=1.4, dz=0.6)
    label(ax1, (*H2, lid_top + 0.12), "H2 注液口螺塞", dx=-1.6, dz=1.0)
    label(ax1, (*H3, lid_top + 0.5), "H3 温度探头", dx=1.2, dz=0.5)
    label(ax1, (0, 0, lid_top), "1/4\" Delrin 盖板", dx=-2.2, dz=0.4)
    label(ax1, (OUTER / 2, OUTER / 2, T + INNER / 2 - BLOB_R), "磁流体团 Ø1.2\"", dx=2.6, dz=-1.6)
    label(ax1, (OUTER, 0, 1.0), "甘油水溶液", dx=1.0, dz=-0.6)
    label(ax1, (0, 0, 2.0), "3/16\" 超白玻璃", dx=-2.0, dz=-1.0)

    ax2 = fig.add_subplot(1, 2, 2, projection="3d")
    lid_top, tz = draw_tank(ax2, explode=0.9, filled=False)
    style(ax2, "爆炸图（零件关系）", 10.5)
    e = 0.9
    label(ax2, (OUTER / 2, OUTER / 2, -e), "A 底板", dx=2.6, dz=-0.4)
    label(ax2, (OUTER / 2, -e, T + INNER), "B 前壁 / 后壁", dx=-3.2, dz=0.3)
    label(ax2, (-e, OUTER / 2, T + 0.6), "C 左壁 / 右壁", dx=-2.4, dz=-1.4)
    label(ax2, (0, 0, T + INNER + e), "1/16\" 硅胶密封垫", dx=-2.6, dz=0.2)
    label(ax2, (0, 0, lid_top), "Delrin 盖板（框架压紧）", dx=-3.0, dz=0.6)
    label(ax2, (*H1, tz + TUBE_H), "玻璃膨胀管", dx=0.6, dz=0.2)
    label(ax2, (*H2, tz + 0.12), "尼龙螺塞 + O 形圈", dx=-2.4, dz=0.8)
    label(ax2, (*H3, tz + 2.0), "温度探头", dx=1.0, dz=0.3)

    fig.suptitle("磁流体悬浮容器 · 搭建效果图", fontsize=18, fontweight="bold", y=0.97)
    fig.text(0.5, 0.03, "内腔 4\" × 4\" × 4\"  ·  外形约 4 3/8\" × 4 3/8\" × 4 1/2\"（不含膨胀管）  ·  "
             "前后壁夹住左右壁，四壁立在底板上  ·  框架未画出", ha="center", fontsize=11, color="#555")
    fig.subplots_adjust(left=0.0, right=1.0, top=0.92, bottom=0.06, wspace=0.0)
    out = Path(__file__).with_name("tank_render.png")
    fig.savefig(out, dpi=150)
    print(out)


if __name__ == "__main__":
    main()
