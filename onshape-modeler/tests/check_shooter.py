"""Offline checks for the shooter template: part interference, and a ball swept along the hood
(must squeeze into the flywheel only; no contact with hood, plates, feed roller).  python tests/check_shooter.py [--set k=v ...]"""
import itertools, json, math, subprocess, sys
from pathlib import Path
import cadquery as cq
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import export_step as E

K = 25.4
args = sys.argv[1:]
plan = json.loads(subprocess.run([sys.executable, ROOT / "scripts/templates/shooter.py", *args], capture_output=True, text=True, check=True).stdout)
bodies = E.build(plan)
fails = 0
bad = []
for (n1, a), (n2, b) in itertools.combinations(bodies, 2):
    v = a.intersect(b).val().Volume() / K ** 3 if a.val().BoundingBox().xmax >= b.val().BoundingBox().xmin else 0
    if v > 1e-4:
        bad.append((round(v, 4), n1, n2))
print(f"{len(bodies)} parts, {len(bad)} interferences", *bad[:10])
fails += len(bad)

ball = plan["ball"]
R = ball["diameter_in"] / 2
for ang in ball["angles_deg"]:
    cy, cz = (ball["center_radius_in"] * f(math.radians(ang)) for f in (math.cos, math.sin))
    sph = cq.Workplane().add(cq.Solid.makeSphere(R * K, cq.Vector(0, cy * K, cz * K), cq.Vector(0, 0, 1), -90, 90, 360))
    hits = {}
    for n, b in bodies:
        v = sph.intersect(b).val().Volume() / K ** 3 if sph.val().BoundingBox().xmax >= b.val().BoundingBox().xmin else 0
        if v > 1e-4:
            hits[n] = round(v, 4)
    wheels = {k: v for k, v in hits.items() if "Flywheel" in k and "shaft" not in k}
    others = {k: v for k, v in hits.items() if k not in wheels}
    ok = bool(wheels) and not others
    print(f"ball at {ang:.0f} deg: wheel squeeze {wheels or 'NONE'}  other contacts {others or 'none'}  -> {'OK' if ok else 'FAIL'}")
    fails += 0 if ok else 1
print("info:", plan["info"])
sys.exit(1 if fails else 0)
