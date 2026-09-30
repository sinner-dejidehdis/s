#!/usr/bin/env python3
"""Build a plan.json into an Onshape Part Studio.

  python build.py plan.json --dry-run
  python build.py plan.json --url <Part Studio URL> [--replace]
  python build.py plan.json --url <URL> --new-studio Elevator   # 在同一文档新建 Part Studio 再建
  python build.py --url <URL> --check        # 验证密钥/链接可用
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import features as F  # noqa: E402

M_TO_IN = 1 / 0.0254


def validate(plan):
    units = plan.get("units", "in")
    if units not in F.M_PER:
        raise SystemExit(f"units 只支持 {list(F.M_PER)}")
    seen, kinds = set(), {}
    for s in plan["steps"]:
        if s["id"] in seen:
            raise SystemExit(f"step id 重复: {s['id']}")
        seen.add(s["id"])
        kinds[s["id"]] = s["type"]
        if s["type"] == "extrude" and kinds.get(s["sketch"]) != "sketch":
            raise SystemExit(f"extrude {s['id']} 必须引用前面的 sketch 步骤")
        if s["type"] == "sketch" and s["plane"] not in F.DEFAULT_PLANES and kinds.get(s["plane"]) != "plane":
            raise SystemExit(f"sketch {s['id']} 的平面 '{s['plane']}' 不存在")
        if s["type"] not in ("plane", "sketch", "extrude"):
            raise SystemExit(f"未知 step type: {s['type']}")
    return units


def make_feature(step, tag, units, plane_fids, sketch_fids):
    t = step["type"]
    if t == "plane":
        return F.build_plane(step, tag, units, plane_fids)
    if t == "sketch":
        return F.build_sketch(step, tag, units, plane_fids)
    return F.build_extrude(step, tag, units, sketch_fids)


def dry_run(plan, units):
    tag = plan.get("tag", "ai")
    plane_fids, sketch_fids = {}, {}
    for s in plan["steps"]:
        feat = make_feature(s, tag, units, plane_fids, sketch_fids)
        if s["type"] == "plane":  # 占位 featureId，保证引用解析也被检查
            plane_fids[s["id"]] = f"DRY_{s['id']}"
        elif s["type"] == "sketch":
            sketch_fids[s["id"]] = f"DRY_{s['id']}"
        extra = f" depth={s['depth']}{units} op={s.get('op','new')} dir={s.get('direction','normal')}" \
            if s["type"] == "extrude" else ""
        print(f"  ok  {s['type']:8s} {feat['name']}{extra}")
    print(f"dry-run 通过：{len(plan['steps'])} 个特征")


def replace_old(c, tag):
    prefix = f"[{tag}] "
    old = [f for f in c.features().get("features", []) if f.get("name", "").startswith(prefix)]
    for f in reversed(old):  # 先删后建的依赖者
        c.delete_feature(f["featureId"])
    print(f"已删除旧特征 {len(old)} 个（tag={tag}）")


def name_parts(c, new_bodies):
    """把 op=new 拉伸出的零件改名为特征名（去掉 [tag] 前缀），失败不影响建模。"""
    if not new_bodies:
        return
    ids = ", ".join(f'makeId("{fid}")' for fid, _ in new_bodies)
    script = ("function(context is Context, queries) { var out = []; for (var id in [" + ids + "]) "
              "out = append(out, transientQueriesToStrings(evaluateQuery(context, qCreatedBy(id, EntityType.BODY)))); "
              "return out; }")
    try:
        res = c.featurescript(script)["value"]
        for (_, name), bodies in zip(new_bodies, res):
            for b in bodies["value"]:
                c.set_part_name(b["value"], name)
    except Exception as e:  # noqa: BLE001
        print(f"（零件改名跳过：{e}）")


def report(c, expect=None):
    parts = c.parts()
    print(f"\n零件数: {len(parts)}")
    for p in parts:
        print("  -", p.get("name"))
    b = c.bbox()
    dims = [(b[f"high{a}"] - b[f"low{a}"]) * M_TO_IN for a in "XYZ"]
    print("整体包围盒 (in): X(宽)=%.2f  Y(前后)=%.2f  Z(高)=%.2f" % tuple(dims))
    if expect:
        bad = [a for a, d, e in zip("XYZ", dims, expect) if abs(d - e) > 0.02]
        print("与预期一致" if not bad else f"⚠ 与预期 {expect} 不符的轴: {bad}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan", nargs="?")
    ap.add_argument("--url")
    ap.add_argument("--replace", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--new-studio", metavar="NAME", help="在 --url 所在文档新建一个 Part Studio 并建在里面")
    a = ap.parse_args()

    if a.check:
        from onshape_client import Client
        c = Client(a.url)
        print(f"连接正常，Part Studio 现有特征 {len(c.features().get('features', []))} 个")
        return
    if not a.plan:
        ap.error("需要 plan.json")
    plan = json.loads(Path(a.plan).read_text())
    units = validate(plan)
    if a.dry_run:
        return dry_run(plan, units)
    if not a.url:
        ap.error("需要 --url（或用 --dry-run）")

    from onshape_client import Client, OnshapeError, feature_status
    c = Client(a.url)
    if a.new_studio:
        url = c.create_part_studio(a.new_studio)
        print(f"新建 Part Studio「{a.new_studio}」: {url}")
        c = Client(url)
    tag = plan.get("tag", "ai")
    if a.replace:
        replace_old(c, tag)
    plane_fids, sketch_fids, new_bodies = {}, {}, []
    for s in plan["steps"]:
        feat = make_feature(s, tag, units, plane_fids, sketch_fids)
        try:
            resp = c.add_feature(feat)
        except OnshapeError as e:
            raise SystemExit(f"FAIL {feat['name']}: {e}")
        fid = resp["feature"]["featureId"]
        if s["type"] == "plane":
            plane_fids[s["id"]] = fid
        elif s["type"] == "sketch":
            sketch_fids[s["id"]] = fid
        elif s.get("op", "new") == "new":
            new_bodies.append((fid, s.get("name", s["id"])))
        status, msg = feature_status(resp)
        print(f"  {status:7s} {feat['name']} {msg}")
        if status not in ("OK", "WARNING"):
            raise SystemExit(f"停止：{feat['name']} 状态 {status}。见 SKILL.md 排查清单。")
    name_parts(c, new_bodies)
    report(c, plan.get("expect", {}).get("bbox_in"))


if __name__ == "__main__":
    main()
