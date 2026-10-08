#!/usr/bin/env python3
"""S4 wiring + CAN plan, packaging figures and centre of gravity, from robot_params.py.  python robot_wiring.py [--out dir]
Device list, breaker ratings and mechanism anchor points are PROPOSALS for the team to confirm; wire gauge minimums are from R622."""
import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import robot_params as P

OUT = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else HERE.parent / "output" / "robot_subsys"
OUT.mkdir(parents=True, exist_ok=True)
ELEC = json.loads((HERE.parent / "references" / "frc_electrical_2026.json").read_text())

# R622 minimum AWG by breaker/fuse rating (verified table); copper bare weight lb per 1000 ft (standard table), x1.35 insulation
R622 = [(40, 12), (30, 14), (20, 18), (10, 22)]
LB_PER_KFT = {6: 122.0, 12: 19.8, 14: 12.4, 18: 4.9, 22: 1.9, 24: 1.2}
INS = 1.35
yf = P.PANEL["y"][1]


def min_awg(amps):
    for a, g in R622:
        if amps >= a - 0 and amps > (R622[R622.index((a, g)) + 1][0] if R622.index((a, g)) + 1 < len(R622) else 0):
            return g
    return 22


def man(*pts):
    return sum(abs(b[i] - a[i]) for a, b in zip(pts, pts[1:]) for i in range(3))


pdh_out = lambda k: (-4.0 + k * 1.0, yf + 0.8, P.PDH["z"][0] + 0.2)          # PDH 低压端子大致位置（占位，按 PDH 实物确认）
PDH_IN_R = (P.PDH["x"][1] - 0.2, yf + 0.8, 11.0)                                # 主电源输入（假设在右端）
PDH_IN_L = (P.PDH["x"][1] - 0.2, yf + 0.8, 10.0)
BATT_P = (3.1, (P.BATT["y"][0] + P.BATT["y"][1]) / 2, P.BATT["z"][1] + 0.3)
BATT_N = (-3.1, BATT_P[1], P.BATT["z"][1] + 0.3)
BRK = (sum(P.BREAKER["x"]) / 2, yf + 0.6, sum(P.BREAKER["z"]) / 2)
pdh_c = (0.0, yf + 0.8, 9.0)

# device anchor points (x, y, z). Swerve modules at the 4 corners; mechanism points are placeholders inside the bay
DEV = {
    "drive Kraken FL": (-10.0, 10.0, 4.5), "drive Kraken FR": (10.0, 10.0, 4.5), "drive Kraken RL": (-10.0, -10.0, 4.5), "drive Kraken RR": (10.0, -10.0, 4.5),
    "intake roller Kraken": (9.0, 6.0, 9.0), "intake pivot motor": (0.0, 11.0, 12.0), "scoring motor": (9.0, -2.0, 10.0),
}
AMPS = {"drive": 40, "steer": 30, "intake roller": 40, "intake pivot": 30, "scoring": 40}


def route(dst):
    """PDH -> (down through the panel slot) -> pan corridor near the side tubes -> device. returns length in inches before slack"""
    x, y, z = dst
    sx = 1 if x >= 0 else -1
    start = pdh_c
    slot = (sx * 8.0 if abs(x) > 4 else 0.0, yf + 0.4, 8.5)
    corridor_in = (sx * 11.8, -12.0, 4.8) if y > -8 else (sx * 8.0, -12.0, 4.8)
    if y > -8:
        return man(start, slot, (slot[0], -12.0, 4.8), corridor_in, (sx * 11.8, y, 4.8), (x, y, z))
    return man(start, slot, (slot[0], -12.0, 4.8), (x, y, z))


rows = []
def add(name, src, dst, amps, awg_choice, length, note="", n=1, kind="power"):
    lib = ELEC["wire_gauge_R622"]
    rows.append({"circuit": name, "from": src, "to": dst, "breaker_A": amps, "min_AWG_R622": awg_choice[0], "chosen_AWG": awg_choice[1], "length_in_each": round(length, 1),
                 "qty": n, "wire_lb": round(length / 12 * n * 2 * LB_PER_KFT.get(awg_choice[1], 4.9) / 1000 * INS, 3) if kind == "power" else 0.0, "note": note})


# main power (R609: 6 AWG)
add("main +: battery(+) -> 120A breaker", "battery +", "main breaker", "120A", (6, 6), man(BATT_P, BRK) * 1.2 + 2.0, "R609 6 AWG; ring lugs; breaker reachable from behind (R612) through the panel window")
add("main +: breaker -> PDH", "main breaker", "PDH +", "-", (6, 6), man(BRK, PDH_IN_R) * 1.2 + 2.0, "R609")
add("main -: battery(-) -> PDH", "battery -", "PDH -", "-", (6, 6), man(BATT_N, PDH_IN_L) * 1.2 + 2.0, "R609")
# swerve (assumed Kraken drive + 30A steer motors); lengths by route
for k, nm in enumerate(("FL", "FR", "RL", "RR")):
    d = DEV[f"drive Kraken {nm}"]
    L = route(d) * 1.15 + 6.0
    add(f"swerve {nm} drive power", "PDH", f"module {nm}", "40A", (12, 12), L, "R622: 31-40A -> 12 AWG min")
    add(f"swerve {nm} steer power (ASSUMED 30A)", "PDH", f"module {nm}", "30A", (14, 14), L, "R622: 21-30A -> 14 AWG min; depends on the module/steer motor chosen")
add("intake roller Kraken", "PDH", "intake", "40A", (12, 12), route(DEV["intake roller Kraken"]) * 1.15 + 6.0, "placeholder anchor point inside the bay")
add("intake pivot motor (ASSUMED 30A)", "PDH", "intake", "30A", (14, 14), route(DEV["intake pivot motor"]) * 1.15 + 6.0, "placeholder; motor not chosen")
add("scoring motor (shooter)", "PDH", "scoring", "40A", (12, 12), route(DEV["scoring motor"]) * 1.15 + 6.0, "placeholder anchor point")
# control power: roboRIO 10A fuse, radio 10A fuse (R615/R616/R617); R622: <=10A fuse -> 22 AWG min, 18 AWG recommended
add("roboRIO power", "PDH (non-switched pair, R615)", "roboRIO", "10A fuse", (22, 18), man(pdh_c, (sum(P.RIO["x"]) / 2, yf + 0.6, 10.0)) * 1.2 + 4.0, "recommended 18 AWG (min 22 AWG per R622)")
add("radio power (VH-109 via PoE injector/12V, R616)", "PDH", "radio", "10A fuse", (22, 18), man(pdh_c, (sum(P.RADIO["x"]) / 2, yf + 0.6, 13.0)) * 1.2 + 4.0, "R616/R617; non-switched pair")
add("robot signal light (R709)", "PDH/roboRIO per R709", "RSL", "-", (28, 22), 24.0, "1-2 RSL required; mounted on the panel top edge, visible from several sides", kind="signal")

# CAN daisy chain (22 AWG twisted pair): roboRIO -> PDH -> Pigeon -> modules -> mechanisms -> terminator
can_order = [("roboRIO", (sum(P.RIO["x"]) / 2, yf, 11.0)), ("PDH", pdh_c), ("Pigeon 2 (IMU)", (0.0, -4.0, 4.9)), ("module RL (drive+steer+encoder)", DEV["drive Kraken RL"]),
             ("module RR", DEV["drive Kraken RR"]), ("scoring motor", DEV["scoring motor"]), ("intake roller", DEV["intake roller Kraken"]),
             ("module FR", DEV["drive Kraken FR"]), ("intake pivot", DEV["intake pivot motor"]), ("module FL", DEV["drive Kraken FL"])]
can_rows, can_total = [], 0.0
for (a, pa), (b, pb) in zip(can_order, can_order[1:]):
    L = man(pa, pb) * 1.15 + 4.0
    can_total += L
    can_rows.append({"from": a, "to": b, "length_in": round(L, 1)})
can_rows.append({"from": "module FL (last device)", "to": "120 ohm terminator", "length_in": 0})

with open(OUT / "S4_wiring_schedule.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
with open(OUT / "S4_can_plan.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["from", "to", "length_in"])
    w.writeheader()
    w.writerows(can_rows)
wire_lb = sum(r["wire_lb"] for r in rows) + can_total / 12 * 2 * LB_PER_KFT[22] / 1000 * INS + 1.5      # +1.5 lb: lugs, connectors, sleeving, zip ties
# ---------------- weight + CG (assumptions are labelled)
S = json.loads((OUT / "S1_S2_S3_info.json").read_text())["mass_lb"]
cg_items = [
    ("modules x4 (ASSUMED)", P.MASS["modules x4 (ASSUMED 7.0 each)"], (0, 0, 3.0)),
    ("frame + pan + gussets + plugs", S["S1_frame"], (0, 0, 3.6)),
    ("battery (12.5 lb typical, R601 11-14.5)", P.BATT["lb"], ((P.BATT["x"][0] + P.BATT["x"][1]) / 2, sum(P.BATT["y"]) / 2, sum(P.BATT["z"]) / 2)),
    ("battery tray + hold-down", S["S2_battery"], (0, sum(P.BATT["y"]) / 2, 7.5)),
    ("panel + uprights", S["S3_electronics_panel"], (0, yf, 11.0)),
    ("PDH", P.PDH["lb"], (0, yf + 0.8, 11.0)), ("roboRIO (PLACEHOLDER)", P.RIO["lb"], (-9.2, yf + 0.8, 11.3)), ("radio (PLACEHOLDER)", P.RADIO["lb"], (8.1, yf + 0.5, 13.0)),
    ("main breaker (PLACEHOLDER)", P.BREAKER["lb"], (10.4, yf + 0.6, 9.6)),
    ("wiring (computed + 1.5 lb connectors)", wire_lb, (0, -4.0, 6.0)),
    ("mechanism bay (ASSUMED 25 lb: intake + scoring)", P.MASS["mechanism bay content (ASSUMED, intake+scoring)"], (0, 3.0, 10.0)),
]
mass = sum(m for _, m, _ in cg_items)
cg = [sum(m * p[i] for _, m, p in cg_items) / mass for i in range(3)]
mass_no_batt = mass - P.BATT["lb"]
rep = {"items": [{"name": n, "lb": round(m, 2), "pos_xyz_in": [round(v, 2) for v in p]} for n, m, p in cg_items],
       "total_lb_with_battery_no_bumpers": round(mass, 2), "R103_robot_weight_lb_(no battery, no bumpers)": round(mass_no_batt, 2), "R103_limit_lb": 115.0,
       "with_bumpers_no_battery_lb": round(mass_no_batt + P.MASS["bumpers (S5 computed + assumed cover/hardware)"], 2), "R408_limit_lb": 135.0,
       "cg_in": {"x": round(cg[0], 2), "y": round(cg[1], 2), "z": round(cg[2], 2)}, "wire_lb": round(wire_lb, 2), "can_total_in": round(can_total, 1)}
(OUT / "S0_weight_cg.json").write_text(json.dumps(rep, indent=1, ensure_ascii=False))

# ---------------- figures
def draw(ax, plane):
    ix, iy = (0, 1) if plane == "top" else (0, 2)
    def rect(c0, c1, **kw):
        ax.add_patch(Rectangle((c0[ix][0], c0[iy][0]) if False else (0, 0), 0, 0))
    def R(xr, yr, zr, **kw):
        a = {0: xr, 1: yr, 2: zr}
        ax.add_patch(Rectangle((a[ix][0], a[iy][0]), a[ix][1] - a[ix][0], a[iy][1] - a[iy][0], **kw))
    h = P.HX
    R((-h, h), (-h, h), (P.TUBE_Z0, P.TUBE_Z1), fill=False, ec="k", lw=1.5)
    for sx in (-1, 1):
        for sy in (-1, 1):
            R(tuple(sorted((sx * (h - 5.5), sx * h))), tuple(sorted((sy * (h - 5.5), sy * h))), P.MODULE_Z, fc="lightgray", ec="gray", alpha=0.6)
    R(P.BATT["x"], P.BATT["y"], P.BATT["z"], fc="gold", ec="k", alpha=0.8)
    R(P.TRAY_BASE["x"], P.TRAY_BASE["y"], (4.625, 4.75), fc="gray")
    R(P.PANEL["x"], P.PANEL["y"], P.PANEL["z"], fc="lightblue", ec="b", alpha=0.5)
    for d, c in ((P.PDH, "tab:red"), (P.RIO, "tab:green"), (P.RADIO, "tab:purple"), (P.BREAKER, "tab:orange")):
        R(d["x"], (yf, yf + d["y_thick"]), d["z"], fc=c, ec="k", alpha=0.8)
    if plane == "top":
        ax.axhspan(P.ELEC_Y_MAX, h, color="green", alpha=0.05); ax.text(-12.5, 0.0, "mechanism bay (y >= -5.5)", color="green")
        ax.text(-12.5, -5.2, "electronics + battery zone", color="b")
    if plane == "side":
        pass


fig, axs = plt.subplots(1, 2, figsize=(15, 7))
draw(axs[0], "top")
for nm, p in DEV.items():
    axs[0].plot(p[0], p[1], "kx")
axs[0].plot(cg[0], cg[1], "r*", ms=14); axs[0].set_xlim(-16, 16); axs[0].set_ylim(-16, 16); axs[0].set_aspect("equal"); axs[0].set_title("S0 packaging: top view (X right, Y forward); red star = CG")
ax = axs[1]
h = P.HX
ax.add_patch(Rectangle((-h, 0), 2 * h, P.TUBE_Z0, fc="none")); ax.axhspan(2.5, 5.75, color="blue", alpha=0.07); ax.axhspan(5.75, 7.5, color="blue", alpha=0.03)
for (xr, zr, c, a) in ((P.BATT["x"], P.BATT["z"], "gold", 0.8), (P.PANEL["x"], P.PANEL["z"], "lightblue", 0.5), (P.PDH["x"], P.PDH["z"], "tab:red", 0.8), (P.RIO["x"], P.RIO["z"], "tab:green", 0.8),
                       (P.RADIO["x"], P.RADIO["z"], "tab:purple", 0.8), (P.BREAKER["x"], P.BREAKER["z"], "tab:orange", 0.8)):
    ax.add_patch(Rectangle((xr[0], zr[0]), xr[1] - xr[0], zr[1] - zr[0], fc=c, ec="k", alpha=a))
ax.add_patch(Rectangle((-h, P.TUBE_Z0), 2 * h, 2, fc="lightgray", ec="k"))
ax.axhline(7.5, color="gray", ls=":"); ax.text(-13, 7.7, "bumper top (assumed 7.5 in)", color="gray")
ax.plot(cg[0], cg[2], "r*", ms=14); ax.set_xlim(-16, 16); ax.set_ylim(0, 17); ax.set_aspect("equal"); ax.set_title("S0 packaging: rear view (X right, Z up) - panel above the bumper, battery in front of it")
plt.tight_layout(); plt.savefig(OUT / "S0_packaging.png", dpi=100)
print(json.dumps({k: rep[k] for k in ("total_lb_with_battery_no_bumpers", "R103_robot_weight_lb_(no battery, no bumpers)", "with_bumpers_no_battery_lb", "cg_in", "wire_lb", "can_total_in")}, ensure_ascii=False))
