#!/usr/bin/env python3
"""BOM from a plan.json (no Onshape needed): custom parts (stock/material, approximate size) + COTS (counts).

  python plan_bom.py plan.json [out.csv]
"""
import csv
import json
import math
import sys
from collections import Counter
from pathlib import Path

COTS = json.loads((Path(__file__).resolve().parent.parent / "references" / "cots.json").read_text())


def extent(ent):
    if ent["kind"] == "circle":
        r = ent["radius"]
        return [2 * r, 2 * r]
    pts = ent["points"] if ent["kind"] == "polygon" else [ent["corner"], [ent["corner"][0] + ent["size"][0], ent["corner"][1] + ent["size"][1]]]
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    return [max(xs) - min(xs), max(ys) - min(ys)]


def main():
    plan = json.loads(Path(sys.argv[1]).read_text())
    out = sys.argv[2] if len(sys.argv) > 2 else f"bom_{plan.get('name', 'model')}.csv"
    sk = {s["id"]: s for s in plan["steps"] if s["type"] == "sketch"}
    rows = []
    for s in plan["steps"]:
        if s["type"] != "extrude" or s.get("op", "new") != "new":
            continue
        e = sk[s["sketch"]]["entities"][0]
        a, b = extent(e)
        rows.append(["custom", s["name"], 1, s.get("material", ""), f'{a:.3f} x {b:.3f} x {s["depth"]:.3f} in'])
    cnt = Counter(c["key"] for c in (plan.get("assembly") or {}).get("cots", []))
    for k, q in sorted(cnt.items()):
        rows.append(["cots", COTS[k]["name"], q, "COTS", k])
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["type", "name", "qty", "material/stock", "size / key"])
        w.writerows(rows)
    print(f"{sum(1 for r in rows if r[0] == 'custom')} 种自制件，{sum(cnt.values())} 个标准件（{len(cnt)} 种）-> {out}")


if __name__ == "__main__":
    main()
