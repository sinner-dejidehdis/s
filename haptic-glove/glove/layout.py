"""手套触觉单元(tactor)布局：每个手指指腹/手掌是一块小格阵列，坐标单位 mm。"""
from dataclasses import dataclass
from typing import List, Tuple


@dataclass(frozen=True)
class Tactor:
    idx: int          # 全局编号 = 固件里的通道号
    zone: str         # 'thumb' 'index' ... 'palm'
    row: int
    col: int
    x: float          # 在该区域局部坐标中的位置(mm)，x 横向，y 沿指尖->指根方向
    y: float


@dataclass(frozen=True)
class Zone:
    name: str
    rows: int
    cols: int
    pitch_x: float
    pitch_y: float


# 指腹 3x4 @ 6mm（指腹约 14x20mm）；手掌 4x4 @ 14mm。共 5*12+16 = 76 个单元
DEFAULT_ZONES = [Zone(n, 4, 3, 6.0, 6.0) for n in ("thumb", "index", "middle", "ring", "pinky")]
DEFAULT_ZONES.append(Zone("palm", 4, 4, 14.0, 14.0))


def build_layout(zones: List[Zone] = None) -> List[Tactor]:
    zones = zones or DEFAULT_ZONES
    out, idx = [], 0
    for z in zones:
        for r in range(z.rows):
            for c in range(z.cols):
                x = (c - (z.cols - 1) / 2) * z.pitch_x
                y = r * z.pitch_y
                out.append(Tactor(idx, z.name, r, c, x, y))
                idx += 1
    return out


def zone_tactors(layout: List[Tactor], zone: str) -> List[Tactor]:
    return [t for t in layout if t.zone == zone]
