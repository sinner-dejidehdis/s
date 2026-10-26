"""Lid hole drawing for the ferrofluid tank (1/4 in Delrin, 4 3/8 in square).

Two ports in the back corners; the temperature probe goes down the expansion
tube, so the front corners and the center stay clear.

Run: python ferrofluid_tank/lid_holes.py  ->  ferrofluid_tank/lid_holes.png
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Rectangle

from glass_panels import DIM, GLASS_EDGE, INNER, OUTER, T, dim_h, dim_v, frac

LID_T = 1 / 4
LID_FILL = "#f1ece1"
EDGE_OFFSET = 3 / 4   # hole center distance from lid edges

# (label, name, x, y, diameter, spec)
HOLES = [
    ("H1", "膨胀管", OUTER - EDGE_OFFSET, OUTER - EDGE_OFFSET, 21 / 32,
     "Ø21/32\"（16.7 mm）通孔，配外径 16 mm 玻璃管，硅酮胶密封"),
    ("H2", "注液口", EDGE_OFFSET, OUTER - EDGE_OFFSET, 0.201,
     "#7 钻（0.201\"）攻 1/4\"-20 UNC 通丝，配尼龙螺塞 + O 形圈"),
]


def top_view(ax):
    ax.add_patch(Rectangle((0, 0), OUTER, OUTER, facecolor=LID_FILL, edgecolor="#6b5a3a", lw=1.6))
    # glass wall footprint under the lid (gasket band)
    ax.add_patch(Rectangle((T, T), INNER, INNER, fill=False, edgecolor=GLASS_EDGE, lw=1, ls="--"))
    ax.text(OUTER / 2, T + 0.12, "虚线：玻璃内壁 / 密封垫内框 4\" × 4\"", ha="center", va="bottom",
            fontsize=8, color=GLASS_EDGE)
    # keep-out zone for the top coil array
    ax.add_patch(Circle((OUTER / 2, OUTER / 2), 1.2, fill=False, edgecolor="#999", lw=0.8, ls=":"))
    ax.text(OUTER / 2, OUTER / 2, "中心区域保持空白\n（之后安装顶部线圈阵列）", ha="center",
            va="center", fontsize=9, color="#777")
    for label, name, x, y, d, _ in HOLES:
        ax.add_patch(Circle((x, y), d / 2, facecolor="white", edgecolor="black", lw=1.2))
        ax.plot([x - 0.35, x + 0.35], [y, y], color="#555", lw=0.5, ls="-.")
        ax.plot([x, x], [y - 0.35, y + 0.35], color="#555", lw=0.5, ls="-.")
        below = y > OUTER / 2
        ax.text(x, y - 0.42 if below else y + 0.42, f"{label} {name}", ha="center",
                va="top" if below else "bottom", fontsize=9, fontweight="bold")
    for x in (EDGE_OFFSET, OUTER - EDGE_OFFSET):
        ax.text(x, EDGE_OFFSET + 0.15, "预留\n（不开孔）", ha="center", va="center", fontsize=8, color="#999")

    dim_h(ax, 0, OUTER, -0.5, frac(OUTER), ext_from=0)
    dim_v(ax, 0, OUTER, -0.5, frac(OUTER), ext_from=0)
    dim_h(ax, OUTER - EDGE_OFFSET, OUTER, OUTER + 0.3, frac(EDGE_OFFSET), ext_from=OUTER)
    dim_h(ax, 0, EDGE_OFFSET, OUTER + 0.3, frac(EDGE_OFFSET), ext_from=OUTER)
    ax.annotate("", (OUTER + 0.35, OUTER), (OUTER + 0.35, OUTER - EDGE_OFFSET),
                arrowprops=dict(arrowstyle="<|-|>", color=DIM, lw=0.9, mutation_scale=9))
    ax.text(OUTER + 0.45, OUTER - EDGE_OFFSET / 2, frac(EDGE_OFFSET), color=DIM, fontsize=9,
            va="center", rotation=90)

    ax.set_title("俯视图（从上往下看）", fontsize=13, fontweight="bold", pad=10)
    ax.set_xlim(-1.4, 5.6)
    ax.set_ylim(-1.2, 5.4)
    ax.set_aspect("equal")
    ax.axis("off")


def section_view(ax):
    """Section through H1 and H2 (back edge), lid on the glass walls."""
    s = 1.0
    y0 = 1.2
    ax.add_patch(Rectangle((0, y0), OUTER, LID_T, facecolor=LID_FILL, edgecolor="#6b5a3a", lw=1.4))
    ax.add_patch(Rectangle((0, y0 - 1 / 16), OUTER, 1 / 16, facecolor="#bbb", edgecolor="#777", lw=0.8))
    ax.add_patch(Rectangle((0, y0 - 1 / 16 - 0.9), T, 0.9, facecolor="#d8eef5", edgecolor=GLASS_EDGE))
    ax.add_patch(Rectangle((OUTER - T, y0 - 1 / 16 - 0.9), T, 0.9, facecolor="#d8eef5", edgecolor=GLASS_EDGE))
    for label, _, x, y, d, _ in HOLES[:2]:
        ax.add_patch(Rectangle((x - d / 2, y0), d, LID_T, facecolor="white", edgecolor="black", lw=1))
        ax.text(x - (0.45 if label == "H1" else 0), y0 + LID_T + 0.1, label, ha="center", va="bottom",
                fontsize=9, fontweight="bold")
    # expansion tube in H1
    x1, d1 = HOLES[0][2], HOLES[0][4]
    ax.add_patch(Rectangle((x1 - d1 / 2, y0), d1, 1.6, fill=False, edgecolor="#2b6f8a", lw=1.2))
    ax.text(x1 + 0.35, y0 + 1.2, "玻璃膨胀管\n高 4\"（图中截断）", fontsize=8, va="center")
    # temperature probe down the tube into the liquid
    ax.add_patch(Rectangle((x1 - 1 / 16, y0 - 0.85), 1 / 8, 2.6, facecolor="#9aa3ab", edgecolor="#555", lw=0.8))
    ax.annotate("温度探头 Ø1/8\"\n从膨胀管顶部插入，\n探头尖端伸到盖板下约 1\"", (x1, y0 - 0.7), (x1 - 2.6, y0 - 0.75),
                fontsize=8, va="center", arrowprops=dict(arrowstyle="-", color="#999", lw=0.7))
    ax.text(0.6, y0 - 0.5, "玻璃壁", fontsize=8, color=GLASS_EDGE)
    ax.text(OUTER / 2, y0 - 0.2, "硅胶密封垫 1/16\"", fontsize=8, ha="center", va="top", color="#555")

    dim_v(ax, y0, y0 + LID_T, -0.3, "", ext_from=0)
    ax.text(-0.45, y0 + LID_T / 2, frac(LID_T), color=DIM, fontsize=9, ha="right", va="center")
    ax.set_title("剖视图（沿后侧两孔）", fontsize=13, fontweight="bold", pad=10)
    ax.set_xlim(-2.0, 5.4)
    ax.set_ylim(-0.2, 3.4)
    ax.set_aspect("equal")
    ax.axis("off")


def notes(ax):
    rows = [(label, name, f"({x:.3f}, {y:.3f})", spec) for label, name, x, y, _, spec in HOLES]
    table = ax.table(cellText=rows, colLabels=("孔号", "用途", "中心坐标 X, Y（英寸）", "加工说明"),
                     loc="upper center", cellLoc="center", colWidths=[0.07, 0.11, 0.2, 0.62])
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.8)
    text = (
        "加工要求\n"
        "1. 材料：1/4\" Delrin（POM）板，尺寸 4 3/8\" × 4 3/8\"，公差 ±1/64\"\n"
        "2. 坐标原点：俯视图左下角，X 向右、Y 向上\n"
        "3. 底面（接触液体的一面）必须平整光滑，孔口去毛刺\n"
        "4. 盖板不粘死，由外框架压紧在密封垫上，方便拆卸\n"
        "5. 灌液时把容器稍微倾斜，让 H1 膨胀管所在的角最高，最后的气泡从这里排出\n"
        "6. 不再单独开温度探头孔：探头从 H1 膨胀管顶部插入\n"
        "7. 前侧两个角预留，之后可以加传感器口"
    )
    ax.text(0.0, 0.55, text, ha="left", va="top", fontsize=10, linespacing=1.7, transform=ax.transAxes)
    ax.axis("off")


def main():
    fig = plt.figure(figsize=(17, 11))
    gs = fig.add_gridspec(2, 2, width_ratios=[1.1, 1], height_ratios=[1.3, 1])
    top_view(fig.add_subplot(gs[:, 0]))
    section_view(fig.add_subplot(gs[0, 1]))
    notes(fig.add_subplot(gs[1, 1]))
    fig.suptitle("磁流体悬浮容器 · 盖板开孔图（单位：英寸）", fontsize=17, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    out = Path(__file__).with_name("lid_holes.png")
    fig.savefig(out, dpi=150)
    print(out)


if __name__ == "__main__":
    main()
