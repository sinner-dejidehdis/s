"""Offline checks for the elevator template (needs cadquery): part-part interference at several
extensions, and rope-length invariants of the continuous rigging.  python tests/check_elevator.py"""
import itertools, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import export_step as E  # noqa: E402

CUBIC_IN = 25.4 ** 3
res, fails = {}, 0
for ext in (0, 0.5, 1):
    plan = json.loads(subprocess.run([sys.executable, ROOT / "scripts/templates/elevator.py", "--set", f"extension={ext}"],
                                     capture_output=True, text=True, check=True).stdout)
    res[ext] = plan["info"]["rope_length_in"]
    bodies = E.build(plan)
    bad = []
    for (n1, a), (n2, b) in itertools.combinations(bodies, 2):
        A, B = a.val().BoundingBox(), b.val().BoundingBox()
        if A.xmax < B.xmin or B.xmax < A.xmin or A.ymax < B.ymin or B.ymax < A.ymin or A.zmax < B.zmin or B.zmax < A.zmin:
            continue
        v = a.intersect(b).val().Volume() / CUBIC_IN
        if v > 1e-4:
            bad.append((round(v, 4), n1, n2))
    print(f"extension={ext}: {len(bodies)} parts, {len(bad)} interferences")
    for x in sorted(bad, reverse=True)[:15]:
        print("   ", x)
    fails += len(bad)

T = 52.0
for k in ("s1_up", "s1_down", "carriage_up", "carriage_down"):
    print(k, [res[e][k] for e in (0, 0.5, 1)])
inv = lambda e: res[e]["s1_up"] + res[e]["s1_down"]
ok = abs(inv(0) - inv(1)) < 1e-3 and abs(res[0]["carriage_up"] - res[1]["carriage_up"]) < 1e-3 \
    and abs(res[0]["carriage_down"] - res[1]["carriage_down"]) < 1e-3 \
    and abs((res[0]["s1_up"] - res[1]["s1_up"]) - T / 2) < 1e-3
print("rope invariants:", "OK" if ok else "FAIL")
sys.exit(1 if fails or not ok else 0)
