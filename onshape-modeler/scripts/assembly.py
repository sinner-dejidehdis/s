"""Build an Onshape Assembly from plan["assembly"]: insert the Part Studio's parts and COTS parts
(references/cots.json), place COTS by transform, group each stage, add slider mates, export a BOM.

plan["assembly"] = {
  "name": "Elevator Assembly",
  "groups": {"<part name>": "<group>"},                       # Part Studio 零件 → 刚性组
  "cots": [{"key", "group", "origin": [x,y,z] in, "axes": [[x],[y],[z]] 局部轴的世界方向, "name"}],
  "sliders": [{"name", "a": "<part name>", "b": "<part name>"}]   # 用 a、b 两个管件的底面建 slider
}
"""
import csv
import json
from pathlib import Path
from urllib.parse import quote

IN = 0.0254
COTS = json.loads((Path(__file__).resolve().parent.parent / "references" / "cots.json").read_text())


def q(s):
    return quote(s, safe="")


class Assembly:
    def __init__(self, c, name):
        self.c, self.name = c, name
        els = c._req("GET", f"{c.base}/documents/d/{c.did}/w/{c.wid}/elements")
        old = [e for e in els if e["elementType"] == "ASSEMBLY" and e["name"] == name]
        if old:
            self.eid = old[0]["id"]
            self.clear()
        else:
            self.eid = c._req("POST", f"{c.base}/assemblies/d/{c.did}/w/{c.wid}", json={"name": name})["id"]
        self.A = f"{c.base}/assemblies/d/{c.did}/w/{c.wid}/e/{self.eid}"
        host = c.base.rsplit("/api/", 1)[0]
        self.url = f"{host}/documents/{c.did}/w/{c.wid}/e/{self.eid}"

    def clear(self):
        A = f"{self.c.base}/assemblies/d/{self.c.did}/w/{self.c.wid}/e/{self.eid}"
        for f in reversed(self.c._req("GET", f"{A}/features")["features"]):   # 先删依赖者（mate 在连接器之后）
            r = self.c.s.delete(f"{A}/features/featureid/{q(f['featureId'])}")
            if r.status_code not in (200, 404):
                raise SystemExit(f"清空装配体失败: {r.status_code} {r.text[:200]}")
        for i in self.c._req("GET", A)["rootAssembly"]["instances"]:
            self.c._req("DELETE", f"{A}/instance/nodeid/{q(i['id'])}")

    def instances(self):
        return self.c._req("GET", self.A)["rootAssembly"]["instances"]

    def insert(self, body):
        self.c._req("POST", f"{self.A}/instances", json=body)

    def transform(self, iid, m):
        # 相对变换：实例刚插入时在原点，相对 = 绝对。子装配（如 WCP-0199）若用绝对变换，内部零件会被打乱
        self.c._req("POST", f"{self.A}/occurrencetransforms",
                    json={"occurrences": [{"path": [iid]}], "transform": m, "isRelative": True})

    def feature(self, feat):
        r = self.c._req("POST", f"{self.A}/features", json={"feature": feat})
        return r["feature"]["featureId"], r.get("featureState", {}).get("featureStatus")

    def group(self, name, iids):
        return self.feature({"btType": "BTMMateGroup-65", "featureType": "mateGroup", "name": name, "parameters": [
            {"btType": "BTMParameterQueryWithOccurrenceList-67", "parameterId": "occurrencesQuery",
             "queries": [{"btType": "BTMIndividualOccurrenceQuery-626", "path": [i]} for i in iids]}]})

    def mate_connector(self, name, iid, face_id, shift=None):
        params = [{"btType": "BTMParameterEnum-145", "enumName": "Origin type", "value": "ON_ENTITY",
                   "parameterId": "originType"},
                  {"btType": "BTMParameterQueryWithOccurrenceList-67", "parameterId": "originQuery",
                   "queries": [{"btType": "BTMInferenceQueryWithOccurrence-1083", "inferenceType": "CENTROID",
                                "path": [iid], "deterministicIds": [face_id]}]}]
        if shift:
            params += [{"btType": "BTMParameterBoolean-144", "parameterId": "transform", "value": True}] + [
                {"btType": "BTMParameterQuantity-147", "parameterId": f"translation{a}", "expression": f"{v:.6f} in",
                 "isInteger": False} for a, v in zip("XYZ", shift)]
        return self.feature({"btType": "BTMMateConnector-66", "featureType": "mateConnector", "name": name,
                             "parameters": params})

    def mate(self, name, kind, mc_a, mc_b):
        return self.feature({"btType": "BTMMate-64", "featureType": "mate", "name": name, "parameters": [
            {"btType": "BTMParameterEnum-145", "enumName": "Mate type", "value": kind, "parameterId": "mateType"},
            {"btType": "BTMParameterQueryWithOccurrenceList-67", "parameterId": "mateConnectorsQuery", "queries": [
                {"btType": "BTMFeatureQueryWithOccurrence-157", "path": [], "featureId": mc_a, "queryData": ""},
                {"btType": "BTMFeatureQueryWithOccurrence-157", "path": [], "featureId": mc_b, "queryData": ""}]}]})

    def bom(self, path):
        b = self.c._req("GET", f"{self.A}/bom", params={"indented": "false", "generateIfAbsent": "true"})
        heads = b.get("headers", [])
        want = ["Item", "Quantity", "Name", "Part number", "Description", "Vendor", "Material"]
        byname = {h["name"]: h["id"] for h in heads}
        cols = [(byname[n], n) for n in want if n in byname]
        rows = []
        for r in b.get("rows", []):
            vals = r.get("headerIdToValue", {})
            row = []
            for hid, _ in cols:
                v = vals.get(hid)
                if isinstance(v, dict):
                    v = v.get("name") or v.get("value") or ""
                row.append("" if v is None else v)
            rows.append(row)
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow([n for _, n in cols])
            w.writerows(rows)
        return len(rows)


def matrix(origin_in, axes):
    """axes = 局部 x/y/z 轴的世界方向 → Onshape 4x4 行优先（米）。"""
    R = [[axes[j][i] for j in range(3)] for i in range(3)]   # 列 = 局部轴
    o = [v * IN for v in origin_in]
    return [R[0][0], R[0][1], R[0][2], o[0], R[1][0], R[1][1], R[1][2], o[1],
            R[2][0], R[2][1], R[2][2], o[2], 0, 0, 0, 1]


def bottom_face(c, part_id):
    """管件最低的 -Z 平面（管底端面）→ (deterministicId, 质心 in)。"""
    bd = c._req("GET", f"{c.ps}/bodydetails")
    body = next(b for b in bd["bodies"] if b["id"] == part_id)
    best = None
    for f in body["faces"]:
        s = f["surface"]
        if s["type"] == "PLANE" and abs(s["normal"]["z"]) > 0.99:
            z = s["origin"]["z"]
            if best is None or z < best[0]:
                bx = f["box"]
                ctr = [(bx["minCorner"][k] + bx["maxCorner"][k]) / 2 / IN for k in "xyz"]
                best = (z, f["id"], ctr)
    return best[1], best[2]


def build_assembly(c, plan, log=print):
    spec = plan["assembly"]
    asm = Assembly(c, spec["name"])
    log(f"装配体「{spec['name']}」: {asm.url}")
    parts = {p["name"]: p["partId"] for p in c.parts()}
    missing = [n for n in spec["groups"] if n not in parts]
    if missing:
        raise SystemExit(f"Part Studio 里找不到零件: {missing[:5]}")
    for name in spec["groups"]:
        asm.insert({"documentId": c.did, "elementId": c.eid, "partId": parts[name], "includePartTypes": ["PARTS"]})
    log(f"  插入自制件 {len(spec['groups'])} 个")

    by_key = {}
    for item in spec["cots"]:
        by_key.setdefault(item["key"], []).append(item)
    for key, items in by_key.items():
        src = COTS[key]
        body = {"documentId": src["doc"], "versionId": src["version"], "elementId": src["element"]}
        body.update({"isAssembly": True} if src.get("assembly") else {"partId": src["partId"], "includePartTypes": ["PARTS"]})
        for _ in items:
            asm.insert(body)
    log(f"  插入标准件/厂商件 {len(spec['cots'])} 个")

    inst = asm.instances()
    iid_of_part = {}
    for i in inst:
        base = i["name"].rsplit(" <", 1)[0]
        if base in spec["groups"] and base not in iid_of_part:
            iid_of_part[base] = i["id"]
    pool = {}
    for key in by_key:
        nm = COTS[key]["name"]
        pool[key] = [i["id"] for i in inst if i["name"].rsplit(" <", 1)[0] == nm]
        if len(pool[key]) != len(by_key[key]):
            raise SystemExit(f"{key}: 插入 {len(by_key[key])} 个，装配体里找到 {len(pool[key])} 个")
    members = {}
    for name, g in spec["groups"].items():
        members.setdefault(g, []).append(iid_of_part[name])
    for key, items in by_key.items():
        for item, iid in zip(items, pool[key]):
            asm.transform(iid, matrix(item["origin"], item["axes"]))
            members.setdefault(item["group"], []).append(iid)
    log("  标准件已定位")

    bad = []
    for g, iids in members.items():
        _, st = asm.group(f"{g} (rigid)", iids)
        if st != "OK":
            bad.append(g)
    for s in spec.get("sliders", []):
        fa, ca = bottom_face(c, parts[s["a"]])
        fb, cb = bottom_face(c, parts[s["b"]])
        # 两个连接器都在 -Z 面上（局部 x=+X, y=-Y）；把 b 平移到 a 的轴线上
        ma, _ = asm.mate_connector(f"{s['name']} MC a", iid_of_part[s["a"]], fa)
        mb, _ = asm.mate_connector(f"{s['name']} MC b", iid_of_part[s["b"]], fb,
                                   shift=(ca[0] - cb[0], -(ca[1] - cb[1]), 0.0))
        _, st = asm.mate(s["name"], "SLIDER", ma, mb)
        if st != "OK":
            bad.append(s["name"])
    log(f"  配合：{len(members)} 个刚性组 + {len(spec.get('sliders', []))} 个 slider" +
        (f"（异常: {bad}）" if bad else "，全部 OK"))
    return asm
