"""S1 step 5 setup sketch: filled tank in a foam box, temperature logging and
time-lapse drift recording.

Run: python ferrofluid_tank/s1_setup.py  ->  ferrofluid_tank/s1_setup.png
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

from glass_panels import GLASS_EDGE, INNER, OUTER, T

LID_T = 1 / 4
GASKET = 1 / 16
TUBE_OD, TUBE_ID, TUBE_H = 16 / 25.4, 13 / 25.4, 4.0   # glass tube OD 16 mm, ID ~13 mm (assumed)
BLOB_D = 1.2
LIQUID = "#f6e9b8"
FOAM = "#e9e4f2"
FOAM_EDGE = "#8a7fa8"
LID_FILL = "#f1ece1"
FERRO = "#151515"
NOTE = "#444"

TANK_H = T + INNER                 # glass height
LID_Y = TANK_H + GASKET            # lid bottom
TOP_Y = LID_Y + LID_T              # lid top
LIQ_IN_TUBE = 1.0                  # liquid level above lid top


def tank_section(ax, x0, h1_at):
    """Glass tank section with lid, tube, probe and blob. x0 = left outer wall."""
    ax.add_patch(Rectangle((x0, 0), OUTER, T, facecolor="#d8eef5", edgecolor=GLASS_EDGE))
    ax.add_patch(Rectangle((x0, T), T, INNER, facecolor="#d8eef5", edgecolor=GLASS_EDGE))
    ax.add_patch(Rectangle((x0 + OUTER - T, T), T, INNER, facecolor="#d8eef5", edgecolor=GLASS_EDGE))
    ax.add_patch(Rectangle((x0 + T, T), INNER, INNER + GASKET, facecolor=LIQUID, edgecolor="none"))
    ax.add_patch(Rectangle((x0, TANK_H), OUTER, GASKET, facecolor="#bbb", edgecolor="#777", lw=0.6))
    ax.add_patch(Rectangle((x0, LID_Y), OUTER, LID_T, facecolor=LID_FILL, edgecolor="#6b5a3a", lw=1.2))
    # expansion tube with liquid column
    tx = x0 + h1_at
    ax.add_patch(Rectangle((tx - TUBE_ID / 2, LID_Y), TUBE_ID, LID_T + LIQ_IN_TUBE,
                           facecolor=LIQUID, edgecolor="none"))
    ax.add_patch(Rectangle((tx - TUBE_OD / 2, LID_Y), TUBE_OD, LID_T + TUBE_H, fill=False,
                           edgecolor=GLASS_EDGE, lw=1.3))
    ax.plot([tx - TUBE_ID / 2, tx + TUBE_ID / 2], [TOP_Y + LIQ_IN_TUBE] * 2, color="#b08900", lw=1.5)
    # temperature probe down the open top of the expansion tube
    px = tx
    probe_top = TOP_Y + TUBE_H + 0.4
    ax.add_patch(Rectangle((px - 0.06, T + INNER - 1.0), 0.12, probe_top - (T + INNER - 1.0),
                           facecolor="#9aa3ab", edgecolor="#555", lw=0.8))
    # ferrofluid blob at the centre
    cx, cy = x0 + OUTER / 2, T + INNER / 2
    ax.add_patch(Circle((cx, cy), BLOB_D / 2, facecolor=FERRO, edgecolor="black"))
    return (tx, TOP_Y + TUBE_H), (px, probe_top), (cx, cy)


def side_section(ax):
    # foam box: inner 7.5 W x 7 H, 1 in walls; front window on the left side
    bx0, by0, bw, bh, ft = -1.6, -1.0, 7.6, 7.0, 1.0
    ax.add_patch(Rectangle((bx0 - ft, by0 - ft), bw + 2 * ft, ft, facecolor=FOAM, edgecolor=FOAM_EDGE))
    ax.add_patch(Rectangle((bx0 - ft, by0 + bh), bw + 2 * ft, ft, facecolor=FOAM, edgecolor=FOAM_EDGE))
    ax.add_patch(Rectangle((bx0 + bw, by0), ft, bh, facecolor=FOAM, edgecolor=FOAM_EDGE))
    # front wall with a window
    win0, win1 = by0 + 0.8, by0 + 0.8 + 4.6
    ax.add_patch(Rectangle((bx0 - ft, by0), ft, win0 - by0, facecolor=FOAM, edgecolor=FOAM_EDGE))
    ax.add_patch(Rectangle((bx0 - ft, win1), ft, by0 + bh - win1, facecolor=FOAM, edgecolor=FOAM_EDGE))
    ax.add_patch(Rectangle((bx0 - 0.08, win0), 0.08, win1 - win0, facecolor="#cfe8ff", edgecolor="#5b8fc2"))
    # stand under the tank
    ax.add_patch(Rectangle((-0.2, by0), OUTER + 0.4, -by0, facecolor="#d9d9d9", edgecolor="#888"))

    # tank: left = front (camera side). H1 is at the back (y = OUTER - 3/4); the probe goes down H1
    (tube_x, tube_top), (probe_x, probe_top), (cx, cy) = tank_section(ax, 0, OUTER - 3 / 4)
    # grid paper on the back glass
    ax.add_patch(Rectangle((OUTER, T), 0.05, INNER, facecolor="#7fb36a", edgecolor="#4d7d3c"))

    # expansion tube passes through the foam top
    ax.add_patch(Rectangle((tube_x - TUBE_OD / 2, TOP_Y + TUBE_H - 0.01), TUBE_OD, 0.01, color=GLASS_EDGE))
    # probe cable out to the logger
    ax.plot([probe_x, probe_x, 7.3], [probe_top, 9.3, 9.3], color="#555", lw=1.4)
    ax.add_patch(FancyBboxPatch((7.3, 8.85), 1.4, 0.9, boxstyle="round,pad=0.05",
                                facecolor="#fff3d6", edgecolor="#b58b2a"))
    ax.text(8.0, 9.3, "温度\n记录器", ha="center", va="center", fontsize=9)

    # phone on a tripod in front of the window
    ax.add_patch(FancyBboxPatch((-4.4, 1.2), 0.35, 1.9, boxstyle="round,pad=0.05",
                                facecolor="#333", edgecolor="black"))
    ax.add_patch(Circle((-4.05, 2.15), 0.1, color="#8fd3ff"))
    ax.plot([-4.22, -4.22], [-1.0, 1.15], color="#555", lw=2)
    ax.plot([-4.22, -4.9], [-0.2, -2.0], color="#555", lw=1.5)
    ax.plot([-4.22, -3.55], [-0.2, -2.0], color="#555", lw=1.5)
    for y in (cy + 0.6, cy - 0.6):
        ax.plot([-4.0, OUTER], [2.15, y], color="#8fd3ff", lw=0.8, ls="--")

    labels = [
        ((-4.2, 3.3), (-4.2, 4.6), "手机延时摄影\n（固定在三脚架上）"),
        ((bx0 - 0.04, win1 - 0.4), (-5.1, 6.0), "保温箱正面窗口\n（透明亚克力或保鲜膜）"),
        ((cx, cy), (2.6, -2.6), "磁流体团 Ø1.2\"\n悬在容器中心"),
        ((0.8, 1.0), (-0.6, -2.6), "甘油水溶液\n灌满容器"),
        ((tube_x, TOP_Y + LIQ_IN_TUBE), (7.3, 4.8), "膨胀管（H1）\n液面高出盖板约 1\""),
        ((probe_x, 3.6), (-4.6, 7.4), "温度探头：从膨胀管顶部插入，\n尖端伸到盖板下约 1\""),
        ((OUTER + 0.05, 1.2), (7.3, 1.2), "后壁外侧贴\n1/8\" 网格纸"),
        ((1.6, TOP_Y), (7.3, 6.1), "Delrin 盖板 + 密封垫\n（由框架压紧，框架未画出）"),
        ((bx0 + bw + 0.5, 3.0), (7.3, 3.0), "泡沫保温箱\n壁厚约 1\""),
        ((OUTER / 2, -0.5), (7.3, -0.4), "垫块"),
    ]
    for xy, xytext, text in labels:
        ax.annotate(text, xy, xytext, fontsize=9, color=NOTE, ha="left", va="center",
                    arrowprops=dict(arrowstyle="-", color="#999", lw=0.7))

    ax.text(-4.6, 9.3, "← 正面（拍摄方向）", fontsize=9, color="#5b8fc2")
    ax.set_title("侧视剖面图", fontsize=13, fontweight="bold", pad=10)
    ax.set_xlim(-5.3, 10.6)
    ax.set_ylim(-3.2, 10.2)
    ax.set_aspect("equal")
    ax.axis("off")


def camera_view(ax):
    """What the phone sees through the window."""
    step = 1 / 8
    ax.add_patch(Rectangle((0, 0), OUTER, TANK_H, facecolor="#f4fbf1", edgecolor="none"))
    n = int(OUTER / step)
    for i in range(n + 1):
        lw = 0.9 if i % 8 == 0 else 0.3
        ax.plot([i * step] * 2, [0, TANK_H], color="#7fb36a", lw=lw)
    for j in range(int(TANK_H / step) + 1):
        lw = 0.9 if j % 8 == 0 else 0.3
        ax.plot([0, OUTER], [j * step] * 2, color="#7fb36a", lw=lw)
    ax.add_patch(Rectangle((0, T), OUTER, INNER, facecolor=LIQUID, alpha=0.35, edgecolor="none"))
    ax.add_patch(Rectangle((0, 0), OUTER, TANK_H, fill=False, edgecolor=GLASS_EDGE, lw=1.6))
    ax.add_patch(Rectangle((0, TANK_H + GASKET), OUTER, LID_T, facecolor=LID_FILL, edgecolor="#6b5a3a"))
    # probe runs down the expansion tube in the back-right corner
    ax.add_patch(Rectangle((OUTER - 3 / 4 - 0.06, T + INNER - 1.0), 0.12, 1.0 + GASKET + LID_T + 1.6,
                           facecolor="#9aa3ab", edgecolor="#555", lw=0.8))
    ax.add_patch(Rectangle((OUTER - 3 / 4 - TUBE_OD / 2, TOP_Y), TUBE_OD, 1.4, fill=False, edgecolor=GLASS_EDGE))
    cx, cy = OUTER / 2, T + INNER / 2
    ax.add_patch(Circle((cx, cy), BLOB_D / 2, facecolor=FERRO))
    ax.plot([cx - 0.9, cx + 0.9], [cy, cy], color="#c0392b", lw=0.8, ls="--")
    ax.text(cx + 0.95, cy, "初始中心线", color="#c0392b", fontsize=8, va="center")
    ax.annotate("", (cx - 1.3, cy + 0.6), (cx - 1.3, cy - 0.6),
                arrowprops=dict(arrowstyle="<|-|>", color="#c0392b", lw=0.9))
    ax.text(cx - 1.4, cy, "记录上下漂移", color="#c0392b", fontsize=8, va="center", ha="right", rotation=90)
    ax.text(OUTER / 2, -0.35, "网格：细线 1/8\"，粗线 1\"", ha="center", va="top", fontsize=9, color=NOTE)
    ax.set_title("手机画面（从正面看）", fontsize=13, fontweight="bold", pad=10)
    ax.set_xlim(-1.2, 5.6)
    ax.set_ylim(-1.0, 6.4)
    ax.set_aspect("equal")
    ax.axis("off")


def checklist(ax):
    text = (
        "第 5 步检查清单\n"
        "□ 容器灌满，盖板压紧，H2 螺塞拧紧，膨胀管内液面约 1\"\n"
        "□ 磁流体团在中心，没有接触任何壁面\n"
        "□ 后壁外侧贴好网格纸，手机对准容器中心并固定\n"
        "□ 温度探头从膨胀管顶部插入，尖端在盖板下约 1\"，记录器每分钟记录一次\n"
        "□ 保温箱盖好，远离窗户、暖气、空调出风口\n"
        "□ 拍摄 1 到 2 小时，开始时记下时间和温度\n\n"
        "合格标准：30 分钟内漂移 < 3/16\"，且没有碰壁\n"
        "持续下沉 → 加甘油；持续上浮 → 加水"
    )
    ax.text(0.02, 0.95, text, ha="left", va="top", fontsize=10.5, linespacing=1.75,
            transform=ax.transAxes)
    ax.axis("off")


def main():
    fig = plt.figure(figsize=(17, 11))
    gs = fig.add_gridspec(2, 2, width_ratios=[1.55, 1], height_ratios=[1.15, 1])
    side_section(fig.add_subplot(gs[:, 0]))
    camera_view(fig.add_subplot(gs[0, 1]))
    checklist(fig.add_subplot(gs[1, 1]))
    fig.suptitle("S1 第 5 步 · 漂移观察装置整体图（单位：英寸）", fontsize=17, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    out = Path(__file__).with_name("s1_setup.png")
    fig.savefig(out, dpi=150)
    print(out)


if __name__ == "__main__":
    main()
