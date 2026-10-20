"""Glass panel shop drawing for the ferrofluid tank (scheme 2A, S1 container).

Inner volume 4 x 4 x 4 in, 3/16 in low-iron glass. Bottom panel sits under all
walls; front/back walls overlap the left/right walls.

Run: python ferrofluid_tank/glass_panels.py  ->  ferrofluid_tank/glass_panels.png
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

plt.rcParams["font.family"] = ["WenQuanYi Zen Hei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

INNER = 4.0          # inner size, in
T = 3 / 16           # glass thickness, in
OUTER = INNER + 2 * T  # 4 3/8 in

GLASS_FILL = "#d8eef5"
GLASS_EDGE = "#2b6f8a"
DIM = "#c0392b"


def frac(x):
    """Inches as a mixed fraction to 1/16, plus mm."""
    sixteenths = round(x * 16)
    whole, rem = divmod(sixteenths, 16)
    if rem:
        num, den = rem, 16
        while num % 2 == 0:
            num, den = num // 2, den // 2
        s = f"{whole} {num}/{den}" if whole else f"{num}/{den}"
    else:
        s = f"{whole}"
    return f'{s}"  ({x * 25.4:.1f} mm)'


def dim_h(ax, x0, x1, y, text, ext_from=None):
    """Horizontal dimension line at height y between x0 and x1."""
    if ext_from is not None:
        for x in (x0, x1):
            ax.plot([x, x], [ext_from, y], color=DIM, lw=0.6)
    ax.annotate("", (x0, y), (x1, y),
                arrowprops=dict(arrowstyle="<|-|>", color=DIM, lw=0.9, mutation_scale=9))
    ax.text((x0 + x1) / 2, y + 0.08, text, ha="center", va="bottom", color=DIM, fontsize=9)


def dim_v(ax, y0, y1, x, text, ext_from=None):
    """Vertical dimension line at x between y0 and y1."""
    if ext_from is not None:
        for y in (y0, y1):
            ax.plot([ext_from, x], [y, y], color=DIM, lw=0.6)
    ax.annotate("", (x, y0), (x, y1),
                arrowprops=dict(arrowstyle="<|-|>", color=DIM, lw=0.9, mutation_scale=9))
    ax.text(x - 0.08, (y0 + y1) / 2, text, ha="right", va="center", color=DIM,
            fontsize=9, rotation=90)


def glass(ax, x, y, w, h, **kw):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=kw.get("fc", GLASS_FILL),
                           edgecolor=GLASS_EDGE, lw=1.4))


def panel(ax, title, w, h, qty, note):
    glass(ax, 0, 0, w, h)
    dim_h(ax, 0, w, -0.45, frac(w), ext_from=0)
    dim_v(ax, 0, h, -0.45, frac(h), ext_from=0)
    ax.text(w / 2, h / 2, f"厚 {frac(T)}\n数量 {qty}", ha="center", va="center", fontsize=10)
    ax.set_title(title, fontsize=13, fontweight="bold", pad=8)
    ax.text(w / 2, -1.05, note, ha="center", va="top", fontsize=9, color="#444")
    ax.set_xlim(-1.4, 5.0)
    ax.set_ylim(-1.6, 5.0)
    ax.set_aspect("equal")
    ax.axis("off")


def plan_view(ax):
    """Top view of the wall layout on the bottom panel."""
    glass(ax, 0, 0, OUTER, OUTER, fc="#eef6f9")                 # bottom panel
    glass(ax, 0, 0, OUTER, T, fc="#9ccfe0")                      # front
    glass(ax, 0, OUTER - T, OUTER, T, fc="#9ccfe0")              # back
    glass(ax, 0, T, T, INNER, fc="#c4e3ee")                      # left
    glass(ax, OUTER - T, T, T, INNER, fc="#c4e3ee")              # right
    ax.text(OUTER / 2, T / 2, "B 前壁", ha="center", va="center", fontsize=8)
    ax.text(OUTER / 2, OUTER - T / 2, "B 后壁", ha="center", va="center", fontsize=8)
    ax.text(T / 2, OUTER / 2, "C 左壁", ha="center", va="center", fontsize=8, rotation=90)
    ax.text(OUTER - T / 2, OUTER / 2, "C 右壁", ha="center", va="center", fontsize=8, rotation=90)
    ax.text(OUTER / 2, OUTER / 2, "内腔\n4\" × 4\"", ha="center", va="center", fontsize=10)
    dim_h(ax, 0, OUTER, -0.45, frac(OUTER), ext_from=0)
    dim_h(ax, T, OUTER - T, OUTER + 0.25, frac(INNER), ext_from=OUTER - T)
    dim_v(ax, 0, OUTER, -0.45, frac(OUTER), ext_from=0)
    ax.set_title("俯视装配图（前后壁夹住左右壁）", fontsize=13, fontweight="bold", pad=8)
    ax.set_xlim(-1.4, 5.0)
    ax.set_ylim(-1.0, 5.4)
    ax.set_aspect("equal")
    ax.axis("off")


def section_view(ax):
    """Front section: walls stand on the bottom panel."""
    glass(ax, 0, 0, OUTER, T)                         # bottom
    glass(ax, 0, T, T, INNER)                         # left wall (section)
    glass(ax, OUTER - T, T, T, INNER)                 # right wall (section)
    ax.text(OUTER / 2, T / 2, "A 底板", ha="center", va="center", fontsize=8)
    ax.text(OUTER / 2, T + INNER / 2, "内腔\n4\" × 4\"", ha="center", va="center", fontsize=10)
    ax.plot([0, OUTER], [OUTER, OUTER], ls="--", color="#888", lw=0.8)
    ax.text(OUTER / 2, OUTER + 0.08, "盖板 + 密封垫（非玻璃件）", ha="center", va="bottom",
            fontsize=8, color="#666")
    dim_h(ax, T, OUTER - T, T + INNER - 0.5, frac(INNER))
    dim_v(ax, T, T + INNER, -0.45, frac(INNER), ext_from=0)
    ax.annotate(f"玻璃厚 {frac(T)}", (OUTER, T / 2), (OUTER + 0.2, -0.45),
                color=DIM, fontsize=9, ha="left", va="center",
                arrowprops=dict(arrowstyle="-|>", color=DIM, lw=0.8, mutation_scale=9))
    ax.set_title("正面剖视图（四壁立在底板上）", fontsize=13, fontweight="bold", pad=8)
    ax.set_xlim(-1.4, 5.6)
    ax.set_ylim(-0.6, 5.4)
    ax.set_aspect("equal")
    ax.axis("off")


def notes(ax):
    rows = [
        ("件号", "名称", "尺寸（英寸）", "数量"),
        ("A", "底板", "4 3/8 × 4 3/8 × 3/16", "1"),
        ("B", "前壁 / 后壁", "4 3/8 × 4 × 3/16", "2"),
        ("C", "左壁 / 右壁", "4 × 4 × 3/16", "2"),
    ]
    table = ax.table(cellText=rows[1:], colLabels=rows[0], loc="upper center",
                     cellLoc="center", colWidths=[0.12, 0.25, 0.43, 0.12])
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 1.6)
    text = (
        "加工要求\n"
        "1. 材料：3/16\" 低铁超白玻璃（Starphire / Optiwhite 等）\n"
        "2. 尺寸公差：±1/32\"（±0.8 mm），对角线差 ≤ 1/32\"\n"
        "3. 所有边缘精磨（seamed / polished），无崩边\n"
        "4. 四壁的高度方向（4\"）切边必须平直，保证与底板贴合\n"
        "5. 粘接：鱼缸专用硅酮胶，外侧打胶，内缝尽量小\n"
        "6. 内腔：4\" × 4\" × 4\"，容积约 64 in³（≈1.05 L）\n"
        "7. 盖板用 1/4\" Delrin，另行加工，不在本图范围"
    )
    ax.text(0.02, 0.42, text, ha="left", va="top", fontsize=10, linespacing=1.6,
            transform=ax.transAxes)
    ax.axis("off")


def main():
    fig, axes = plt.subplots(2, 3, figsize=(17, 11))
    panel(axes[0, 0], "A  底板", OUTER, OUTER, 1, "四壁全部立在底板上")
    panel(axes[0, 1], "B  前壁 / 后壁", OUTER, INNER, 2, "宽度包住左右壁的厚度")
    panel(axes[0, 2], "C  左壁 / 右壁", INNER, INNER, 2, "夹在前后壁之间")
    plan_view(axes[1, 0])
    section_view(axes[1, 1])
    notes(axes[1, 2])
    fig.suptitle("磁流体悬浮容器 · 玻璃板加工图（单位：英寸）", fontsize=17, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    out = Path(__file__).with_name("glass_panels.png")
    fig.savefig(out, dpi=150)
    print(out)


if __name__ == "__main__":
    main()
