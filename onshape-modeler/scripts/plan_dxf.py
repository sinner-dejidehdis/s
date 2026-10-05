#!/usr/bin/env python3
"""Export every extrude marked "flat": true (side plates, motor plates, ...) as a 1:1 DXF in inches (needs ezdxf).

  python plan_dxf.py plan.json out_dir/
Sketch x/y of a Right-plane part is (Y, Z) of the model; the left plate is the mirror image when flipped over.
"""
import json
import re
import sys
from pathlib import Path

import ezdxf


def main():
    plan = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    sk = {s["id"]: s for s in plan["steps"] if s["type"] == "sketch"}
    n = 0
    for s in plan["steps"]:
        if s["type"] != "extrude" or not s.get("flat"):
            continue
        doc = ezdxf.new("R2010", setup=True); doc.units = 1          # inches
        msp = doc.modelspace()
        for e in sk[s["sketch"]]["entities"]:
            if e["kind"] == "circle":
                msp.add_circle(tuple(e["center"]), e["radius"])
            elif e["kind"] == "polygon":
                msp.add_lwpolyline([tuple(q) for q in e["points"]], close=True)
            else:
                x, y = e["corner"]; w, h = e["size"]
                msp.add_lwpolyline([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], close=True)
        name = re.sub(r"[^A-Za-z0-9_.-]+", "_", s["name"]) + ".dxf"
        doc.saveas(out / name); n += 1
        print(f"  {name}  (厚 {s['depth']} in, {s.get('material', '')})")
    print(f"{n} 个 DXF -> {out}")


if __name__ == "__main__":
    main()
