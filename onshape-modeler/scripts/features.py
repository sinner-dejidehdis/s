"""Turn plan steps into Onshape feature JSON. All lengths in plan are in plan['units'] (in|mm)."""
import math

M_PER = {"in": 0.0254, "mm": 0.001}
DEFAULT_PLANES = {"Top", "Front", "Right"}


def _q(query_string):
    return {"btType": "BTMIndividualQuery-138", "queryStatement": None,
            "queryString": query_string, "deterministicIds": []}


def _qlist(pid, *query_strings):
    return {"btType": "BTMParameterQueryList-148", "parameterId": pid,
            "queries": [_q(s) for s in query_strings]}


def _enum(pid, name, value):
    return {"btType": "BTMParameterEnum-145", "parameterId": pid, "enumName": name, "value": value}


def _bool(pid, v):
    return {"btType": "BTMParameterBoolean-144", "parameterId": pid, "value": bool(v)}


def _qty(pid, expr):
    return {"btType": "BTMParameterQuantity-147", "parameterId": pid, "expression": expr, "isInteger": False}


def _expr(v, units):
    return f"{v:g} {units}"


def plane_query(ref, plane_fids):
    """ref is Top/Front/Right or the id of an earlier 'plane' step."""
    if ref in DEFAULT_PLANES:
        return f'query=qCreatedBy(makeId("{ref}"), EntityType.FACE);'
    if ref in plane_fids:
        return f'query=qCreatedBy(makeId("{plane_fids[ref]}"), EntityType.FACE);'
    raise ValueError(f"找不到平面 '{ref}'（必须是 Top/Front/Right 或前面 plane 步骤的 id）")


def build_plane(step, tag, units, plane_fids):
    return {
        "btType": "BTMFeature-134", "featureType": "cPlane", "suppressed": False,
        "name": f"[{tag}] {step.get('name', step['id'])}",
        "parameters": [
            _qlist("entities", plane_query(step["base"], plane_fids)),
            _enum("cplaneType", "CPlaneType", "OFFSET"),
            # Onshape 的 offset 不接受负值：取绝对值并用 oppositeDirection 表示方向
            _qty("offset", _expr(abs(step["offset"]), units)),
            _bool("oppositeDirection", step["offset"] < 0),
        ],
    }


def _poly_points(ent):
    if ent["kind"] == "rect":
        x, y = ent["corner"]
        w, h = ent["size"]
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
    return ent["points"]


def sketch_entities(step, units):
    k = M_PER[units]
    out = []
    for i, ent in enumerate(step["entities"]):
        eid = f"{step['id']}_{i}"
        if ent["kind"] == "circle":
            cx, cy = ent["center"]
            out.append({
                "btType": "BTMSketchCurve-4", "entityId": eid, "centerId": f"{eid}.center",
                "geometry": {"btType": "BTCurveGeometryCircle-115", "radius": ent["radius"] * k,
                             "xCenter": cx * k, "yCenter": cy * k, "xDir": 1.0, "yDir": 0.0,
                             "clockwise": False},
            })
        elif ent["kind"] in ("polygon", "rect"):
            pts = _poly_points(ent)
            if len(pts) < 3:
                raise ValueError(f"草图 {step['id']} 第 {i} 个轮廓少于 3 个点")
            for j, (a, b) in enumerate(zip(pts, pts[1:] + pts[:1])):
                dx, dy = b[0] - a[0], b[1] - a[1]
                n = math.hypot(dx, dy)
                if n < 1e-9:
                    raise ValueError(f"草图 {step['id']} 有零长度线段（重复点）")
                lid = f"{eid}_l{j}"
                out.append({
                    "btType": "BTMSketchCurveSegment-155", "entityId": lid, "centerId": f"{lid}.center",
                    "startPointId": f"{lid}.start", "endPointId": f"{lid}.end",
                    "startParam": 0.0, "endParam": n * k, "internalIds": [], "isConstruction": False,
                    "geometry": {"btType": "BTCurveGeometryLine-117",
                                 "pntX": a[0] * k, "pntY": a[1] * k, "dirX": dx / n, "dirY": dy / n},
                })
        else:
            raise ValueError(f"未知草图元素 kind={ent['kind']}（支持 polygon/rect/circle）")
    return out


def build_sketch(step, tag, units, plane_fids):
    return {
        "btType": "BTMSketch-151", "featureType": "newSketch", "suppressed": False,
        "name": f"[{tag}] {step.get('name', step['id'])}",
        "parameters": [_qlist("sketchPlane", plane_query(step["plane"], plane_fids))],
        "entities": sketch_entities(step, units), "constraints": [],
    }


OPS = {"new": "NEW", "add": "ADD", "remove": "REMOVE", "intersect": "INTERSECT"}
DIRS = {"normal": False, "flip": True, "symmetric": False}


def build_extrude(step, tag, units, sketch_fids):
    if step["sketch"] not in sketch_fids:
        raise ValueError(f"extrude {step['id']} 引用的草图 '{step['sketch']}' 不存在")
    direction = step.get("direction", "normal")
    op = OPS[step.get("op", "new")]
    return {
        "btType": "BTMFeature-134", "featureType": "extrude", "suppressed": False,
        "name": f"[{tag}] {step.get('name', step['id'])}",
        "parameters": [
            _enum("bodyType", "ExtendedToolBodyType", "SOLID"),
            _enum("operationType", "NewBodyOperationType", op),
            # hollow=true：只拉伸环形区域（方管、带孔的板），内轮廓保持空心，不用再单独切除
            _qlist("entities", f'query=qSketchRegion(makeId("{sketch_fids[step["sketch"]]}"), '
                               f'{"true" if step.get("hollow") else "false"});'),
            _enum("endBound", "BoundingType", "BLIND"),
            _qty("depth", _expr(step["depth"], units)),
            _bool("oppositeDirection", DIRS[direction]),
            _bool("symmetric", direction == "symmetric"),
            # 默认 defaultScope=false，不设为 true 时 remove/add 找不到要合并/切除的零件
            _bool("defaultScope", op != "NEW"),
        ],
    }
