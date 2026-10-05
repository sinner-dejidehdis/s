"""FRC robot-envelope checks against references/frc_rules_2026.json (override with --rules other.json).

Library: check_pose(bodies, perimeter_half_in, rules, name) -> list of (ok, text)
  bodies: [(name, cq.Workplane|Shape)] in mm, robot frame: X lateral, Y forward, Z up, origin at floor centre.
Rules checked per pose: R104/R107 height, R104 perimeter, R105 extension <= 12 in, R106 extension in one direction only.
The starting configuration (stowed pose) must not extend beyond the perimeter at all (minor protrusions: tol_in).
"""
import json
from pathlib import Path

K = 25.4
RULES = json.loads((Path(__file__).resolve().parent.parent / "references" / "frc_rules_2026.json").read_text())


def _bb(b):
    return (b.val() if hasattr(b, "val") else b).BoundingBox()


def extents(bodies, skip=lambda n: False):
    """world-frame extent in inches per direction: dict(front, back, left, right, height)"""
    ymax = xmax = zmax = -1e9
    ymin = xmin = 1e9
    for n, b in bodies:
        if skip(n):
            continue
        bb = _bb(b)
        ymax, ymin = max(ymax, bb.ymax), min(ymin, bb.ymin)
        xmax, xmin = max(xmax, bb.xmax), min(xmin, bb.xmin)
        zmax = max(zmax, bb.zmax)
    return {"front": ymax / K, "back": -ymin / K, "right": xmax / K, "left": -xmin / K, "height": zmax / K}


def check_pose(bodies, half_x, half_y, name, rules=RULES, stowed=False, tol_in=0.0, skip=lambda n: False):
    """half_x/half_y: half of the frame perimeter in inches."""
    e = extents(bodies, skip)
    out = []
    ext = {"front": e["front"] - half_y, "back": e["back"] - half_y, "right": e["right"] - half_x, "left": e["left"] - half_x}
    over = {k: v for k, v in ext.items() if v > tol_in}
    out.append((e["height"] <= rules["R107_max_height_in"], f"[{name}] R107 height {e['height']:.2f} in <= {rules['R107_max_height_in']} in"))
    if stowed:
        out.append((not over, f"[{name}] R104 starting configuration inside perimeter: " + (", ".join(f"{k} +{v:.2f}in" for k, v in over.items()) or "OK")))
        out.append((e["height"] <= rules["R104_max_start_height_in"], f"[{name}] R104 start height {e['height']:.2f} in <= {rules['R104_max_start_height_in']} in"))
    else:
        mx = max(ext.values())
        out.append((mx <= rules["R105_max_horizontal_extension_in"], f"[{name}] R105 max extension {mx:+.2f} in <= {rules['R105_max_horizontal_extension_in']} in ({max(ext, key=ext.get)})"))
        out.append((len(over) <= 1, f"[{name}] R106 extends in {len(over)} direction(s): {', '.join(over) or 'none'}"))
    return out


def check_static(perimeter_x_in, perimeter_y_in, weight_lb, bumper_lb, rules=RULES):
    per = 2 * (perimeter_x_in + perimeter_y_in)
    return [(per <= rules["R104_max_start_perimeter_in"], f"R104 perimeter {per:.1f} in <= {rules['R104_max_start_perimeter_in']} in"),
            (weight_lb <= rules["R103_weight_lb"], f"R103 weight (no bumpers/battery) {weight_lb:.1f} lb <= {rules['R103_weight_lb']} lb"),
            (weight_lb + bumper_lb <= rules["R408_weight_with_bumpers_lb"], f"R408 weight with bumpers {weight_lb + bumper_lb:.1f} lb <= {rules['R408_weight_with_bumpers_lb']} lb")]
