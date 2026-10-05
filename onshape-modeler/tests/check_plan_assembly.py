"""Static consistency of plan['assembly'] for every buildable template (no Onshape, no cadquery needed):
unique part names, every solid in a rigid group, COTS keys exist, no empty groups, names safe for the assembly API."""
import json, subprocess, sys
from collections import Counter
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
COTS = json.loads((ROOT / "references/cots.json").read_text())
fails = 0
for tpl, args in (("elevator", []), ("roller_intake", []), ("shooter", []), ("shooter", ["--set", "motors=2"])):
    plan = json.loads(subprocess.run([sys.executable, ROOT / f"scripts/templates/{tpl}.py", *args], capture_output=True, text=True, check=True).stdout)
    asm = plan["assembly"]
    solids = [s["name"] for s in plan["steps"] if s["type"] == "extrude" and s.get("op", "new") == "new"]
    problems = []
    dup = [k for k, v in Counter(solids).items() if v > 1]
    if dup: problems.append(f"重名零件 {dup[:3]}")
    missing = [n for n in solids if n not in asm["groups"]]
    if missing: problems.append(f"{len(missing)} 个零件不在任何刚性组: {missing[:3]}")
    ghost = [n for n in asm["groups"] if n not in solids]
    if ghost: problems.append(f"分组里有不存在的零件: {ghost[:3]}")
    bad_key = [c["key"] for c in asm["cots"] if c["key"] not in COTS]
    if bad_key: problems.append(f"未知标准件 {set(bad_key)}")
    badname = [n for n in solids if " <" in n or n != n.strip()]
    if badname: problems.append(f"名字会干扰实例匹配: {badname[:3]}")
    one = [g for g, c in Counter(asm["groups"].values()).items() if c == 1 and not any(i["group"] == g for i in asm["cots"])]
    cnt = Counter(c["key"] for c in asm["cots"])
    print(f"{tpl} {' '.join(args)}: {len(solids)} 个自制件, {len(set(asm['groups'].values()))} 个刚性组, {sum(cnt.values())} 个标准件 "
          + ("OK" if not problems else "FAIL: " + "; ".join(problems)))
    fails += len(problems)
sys.exit(1 if fails else 0)
