"""把游戏里的接触事件渲染成每个触觉单元的状态。

每个单元有三种可叠加的"状态"：
  press : 0..1  静态压力/形变（气囊/微型推杆，负责"被按着"的感觉）
  amp   : 0..1  振动幅度（LRA/压电，负责纹理、滑动、碰撞）
  freq  : Hz    振动频率（受执行器带宽限制）

抚摸(stroking)的关键：接触点连续移动时，用相邻单元的能量分配做"幻象触觉"
(phantom sensation)，让 6mm 间距的阵列感觉像连续滑动，而不是一格一格跳。
"""
import math
from dataclasses import dataclass
from typing import Dict, List, Tuple

from .layout import Tactor, zone_tactors

F_MIN, F_MAX = 80.0, 300.0     # LRA 有效频带
GAIN = 2.0                    # 补偿能量分摊到多个单元后的幅度下降
AMP_SLEW = 0.35                # 每帧最大幅度变化，避免振铃/爆音


@dataclass
class Material:
    name: str
    roughness: float        # 0 光滑 .. 1 粗糙
    spatial_period: float   # 纹理空间周期 mm（频率 = 滑动速度 / 周期）
    softness: float         # 0 硬 .. 1 软（软 => 接触面更大、压力更平滑）


MATERIALS: Dict[str, Material] = {
    "silk":   Material("silk",   0.10, 1.0, 0.6),
    "fur":    Material("fur",    0.35, 0.8, 0.9),
    "wood":   Material("wood",   0.50, 2.0, 0.1),
    "stone":  Material("stone",  0.80, 1.5, 0.0),
    "skin":   Material("skin",   0.15, 1.2, 0.8),
}


@dataclass
class Contact:
    zone: str
    x: float            # 接触中心(局部mm)
    y: float
    force: float        # 法向力 0..1（已按游戏侧归一化）
    vx: float = 0.0     # 切向速度 mm/s
    vy: float = 0.0
    material: str = "skin"


@dataclass
class TactorState:
    press: float = 0.0
    amp: float = 0.0
    freq: float = 0.0


def _gauss_weights(layout: List[Tactor], zone: str, c: Contact, sigma: float):
    ws = []
    for t in zone_tactors(layout, zone):
        d2 = (t.x - c.x) ** 2 + (t.y - c.y) ** 2
        ws.append((t, math.exp(-d2 / (2 * sigma * sigma))))
    return ws


class Renderer:
    def __init__(self, layout: List[Tactor]):
        self.layout = layout
        self.state = [TactorState() for _ in layout]

    def step(self, contacts: List[Contact]) -> List[TactorState]:
        target = [TactorState() for _ in self.layout]
        for c in contacts:
            m = MATERIALS[c.material]
            # 接触斑大小：力越大、材质越软，越大
            sigma = 3.0 + 4.0 * c.force * (0.5 + m.softness)
            ws = _gauss_weights(self.layout, c.zone, c, sigma)
            total = sum(w for _, w in ws) or 1.0
            speed = math.hypot(c.vx, c.vy)
            # 纹理频率 = 速度/空间周期，夹到执行器带宽内；静止时不振动
            f = min(max(speed / m.spatial_period, F_MIN), F_MAX) if speed > 1.0 else 0.0
            slide = min(speed / 60.0, 1.0)
            for t, w in ws:
                share = w / total                 # 能量守恒的"幻象"分配
                p = c.force * (w ** 0.5)          # 压力用未归一化高斯，保持点按的形状
                a = GAIN * c.force * (0.3 + 0.7 * m.roughness) * slide * math.sqrt(share)
                s = target[t.idx]
                s.press = min(1.0, max(s.press, p))
                if a > s.amp:
                    s.amp, s.freq = min(1.0, a), f
        # 幅度限速（slew），压力做一阶低通
        for cur, tgt in zip(self.state, target):
            d = max(-AMP_SLEW, min(AMP_SLEW, tgt.amp - cur.amp))
            cur.amp = max(0.0, cur.amp + d)
            cur.freq = tgt.freq if cur.amp > 0.01 else 0.0
            cur.press += 0.5 * (tgt.press - cur.press)
        return self.state
