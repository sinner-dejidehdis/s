"""Contact graph of the elevator's custom parts: floating parts, connected components, rope ends.
python tests/check_connectivity.py [extension]"""
import itertools, json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import export_step as E

TOL = 0.02 * 25.4  # mm
ext = sys.argv[1] if len(sys.argv) > 1 else "0"
plan = json.loads(subprocess.run([sys.executable, ROOT / "scripts/templates/elevator.py", "--set", f"extension={ext}"],
                                 capture_output=True, text=True, check=True).stdout)
bodies = E.build(plan)
groups = plan["assembly"]["groups"]
names = [n for n, _ in bodies]
adj = {n: set() for n in names}
for (n1, a), (n2, b) in itertools.combinations(bodies, 2):
    A, B = a.val().BoundingBox(), b.val().BoundingBox()
    if (A.xmax + TOL < B.xmin or B.xmax + TOL < A.xmin or A.ymax + TOL < B.ymin or B.ymax + TOL < A.ymin
            or A.zmax + TOL < B.zmin or B.zmax + TOL < A.zmin):
        continue
    if a.val().distance(b.val()) <= TOL:
        adj[n1].add(n2); adj[n2].add(n1)

print(f"extension={ext}: {len(names)} parts")
print("\n悬空零件（不接触任何自制零件）:")
for n in names:
    if not adj[n]:
        print("  ", n, f"[{groups.get(n)}]")
print("\n绳的两端接触情况（应各接触 2 个零件；通向滚筒的 3 根只能接触 1 个，因为滚筒带轮是标准件）:")
for n in names:
    if "rope" in n:
        print(f"   {n}: {sorted(adj[n])}")
# connected components per group (rigid group should be one piece, otherwise it is bolted together via COTS)
print("\n各刚性组内的连通块数（>1 表示组内零件要靠标准件/螺栓连接）:")
for g in sorted(set(groups.values())):
    mem = [n for n in names if groups.get(n) == g]
    seen, comps = set(), 0
    for n in mem:
        if n in seen: continue
        comps += 1; st = [n]
        while st:
            x = st.pop()
            if x in seen: continue
            seen.add(x); st += [y for y in adj[x] if groups.get(y) == g and y not in seen]
    print(f"   {g}: {len(mem)} 个零件, {comps} 个连通块")

if "--detail" in sys.argv:
    for g in ("stage0", "stage1", "carriage"):
        mem = [n for n in names if groups.get(n) == g]; seen = set()
        for n in mem:
            if n in seen: continue
            comp, st = [], [n]
            while st:
                x = st.pop()
                if x in seen: continue
                seen.add(x); comp.append(x); st += [y for y in adj[x] if groups.get(y) == g and y not in seen]
            print(f"\n[{g}] 连通块 ({len(comp)}):", sorted(comp))
