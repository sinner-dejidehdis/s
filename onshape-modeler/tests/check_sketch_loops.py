"""Every "hollow" extrude: number of inner loops in the solid's end face must equal the number of hole entities in its
sketch (fewer loops than sketched means holes overlap each other or the outline -> invalid sketch regions in Onshape).
python tests/check_sketch_loops.py"""
import json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import export_step as E

bad = 0
CASES = (("roller_intake", []), ("roller_intake", ["--set", "rollers=[[12,1.5],[8,3],[4,4.5],[0,6]]", "--set", "inner_width=20"]),
         ("shooter", []), ("shooter", ["--set", "motors=2"]),
         ("shooter", ["--set", "ball_diameter=9.5", "--set", "width=12", "--set", "wheel_pitch=3.5"]), ("elevator", []))
for tpl, args in CASES:
    plan = json.loads(subprocess.run([sys.executable, ROOT / f"scripts/templates/{tpl}.py", *args], capture_output=True, text=True, check=True).stdout)
    sk = {s["id"]: s for s in plan["steps"] if s["type"] == "sketch"}
    bodies = dict(E.build(plan)); n = 0
    for s in plan["steps"]:
        if s["type"] != "extrude" or not s.get("hollow") or s["name"] not in bodies:
            continue
        want = len(sk[s["sketch"]]["entities"]) - 1
        faces = [f for f in bodies[s["name"]].val().Faces() if abs(f.normalAt().x) > 0.99 or abs(f.normalAt().z) > 0.99]
        got = max(len(f.innerWires()) for f in faces) if faces else -1
        n += 1
        if got < want:                       # 实体上的孔比草图少 = 孔合并/变成缺口（多出来的是后续钻的孔）
            bad += 1; print(f"MISMATCH {tpl} {' '.join(args)} | {s['name']}: sketch {want} inner loops, face {got}")
    print(f"{tpl} {' '.join(args)[:50]}: {n} hollow parts checked")
sys.exit(1 if bad else 0)
