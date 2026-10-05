"""Offline checks for the roller intake: part interference, floating parts, and a ball resting on each adjacent
roller pair (must touch both rollers, hit nothing else).  python tests/check_intake.py [--set k=v ...]"""
import itertools, json, math, subprocess, sys
from pathlib import Path
import cadquery as cq
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import export_step as E

K, TOL = 25.4, 0.02 * 25.4
plan = json.loads(subprocess.run([sys.executable, ROOT / "scripts/templates/roller_intake.py", *sys.argv[1:]],
                                 capture_output=True, text=True, check=True).stdout)
bodies = E.build(plan)
names = [n for n, _ in bodies]
fails = 0

bad, adj = [], {n: set() for n in names}
for (n1, a), (n2, b) in itertools.combinations(bodies, 2):
    A, B = a.val().BoundingBox(), b.val().BoundingBox()
    if (A.xmax + TOL < B.xmin or B.xmax + TOL < A.xmin or A.ymax + TOL < B.ymin or B.ymax + TOL < A.ymin
            or A.zmax + TOL < B.zmin or B.zmax + TOL < A.zmin):
        continue
    v = a.intersect(b).val().Volume() / K ** 3
    if v > 1e-4:
        bad.append((round(v, 4), n1, n2))
    if a.val().distance(b.val()) <= TOL:
        adj[n1].add(n2); adj[n2].add(n1)
print(f"{len(bodies)} parts, {len(bad)} interferences", *bad[:8])
fails += len(bad)
float_ = [n for n in names if not adj[n] and "belt" not in n.lower() and "pivot" not in n.lower()]
print("floating custom parts:", float_ or "none")
fails += len(float_)

b = plan["ball"]; R = [tuple(r) for r in b["rollers"]]; rds = b["roller_radii_in"]; rb = b["diameter_in"] / 2
for i, ((r1, r2), (a1, a2)) in enumerate(zip(zip(R, R[1:]), zip(rds, rds[1:])), 1):
    d1, d2 = rb + a1, rb + a2                      # 球心到两个滚轮轴的距离（与两者都相切）
    dd = math.dist(r1, r2)
    if dd > d1 + d2:
        print(f"balls rest on pair {i}: FAIL (rollers {dd:.2f} in apart, ball cannot touch both)"); fails += 1; continue
    a = (d1 ** 2 - d2 ** 2 + dd ** 2) / (2 * dd); h = math.sqrt(max(d1 ** 2 - a ** 2, 0.0))
    ex = ((r2[0] - r1[0]) / dd, (r2[1] - r1[1]) / dd); nx = (-ex[1], ex[0])
    if nx[1] < 0:
        nx = (-nx[0], -nx[1])                       # 朝上的一侧
    c = (r1[0] + ex[0] * a + nx[0] * h, r1[1] + ex[1] * a + nx[1] * h)
    sph = cq.Workplane().add(cq.Solid.makeSphere(rb * K, cq.Vector(0, c[0] * K, c[1] * K), cq.Vector(0, 0, 1), -90, 90, 360))
    touch = {}; hit = {}
    for n, s in bodies:
        v = sph.intersect(s).val().Volume() / K ** 3 if sph.val().BoundingBox().xmax >= s.val().BoundingBox().xmin else 0
        dist = sph.val().distance(s.val()) / K
        if "tube" in n and dist < 0.01:
            touch[n] = round(dist, 4)
        if v > 1e-3:
            hit[n] = round(v, 4)
    ok = len(touch) >= 2 and not hit
    print(f"ball on rollers {i}-{i+1}: touches {sorted(touch)}  intrusions {hit or 'none'}  -> {'OK' if ok else 'FAIL'}")
    fails += 0 if ok else 1
print("info:", json.dumps(plan["info"], ensure_ascii=False))
sys.exit(1 if fails else 0)
