"""Shared geometry helpers for the buildable intake / shooter templates (HTD5 belt math, hulls, hex points)."""
import math

HTD_P = 5 / 25.4          # HTD 5mm 节距（in）


def pd(teeth):
    """HTD 节圆直径（in）"""
    return teeth * HTD_P / math.pi


def hull(points):
    pts = sorted(set((round(x, 6), round(y, 6)) for x, y in points))

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and ((out[-1][0] - out[-2][0]) * (p[1] - out[-2][1])
                                     - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0])) <= 0:
                out.pop()
            out.append(p)
        return out
    lo, hi = half(pts), half(reversed(pts))
    return [list(p) for p in lo[:-1] + hi[:-1]]


def ring_pts(c, r, n=36):
    """圆的外切正 n 边形顶点（顶点半径放大 1/cos(pi/n)），折线面不会侵入真圆"""
    r = r / math.cos(math.pi / n)
    return [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def hexpts(c, r):
    return [[round(c[0] + r * math.cos(math.pi / 3 * i), 5), round(c[1] + r * math.sin(math.pi / 3 * i), 5)]
            for i in range(6)]


def belt_len(C, D, d):
    """开口皮带节线长（in）：两个节圆直径 D、d，中心距 C"""
    D, d = max(D, d), min(D, d)
    phi = math.asin((D - d) / (2 * C))
    return 2 * C * math.cos(phi) + math.pi / 2 * (D + d) + phi * (D - d)


def belt_teeth(C, D, d):
    return belt_len(C, D, d) / HTD_P


def center_for_teeth(T, D, d):
    """使皮带正好 T 齿的中心距（二分法）"""
    lo, hi = (D + d) / 2 + 0.05, 200.0
    if belt_len(lo, D, d) / HTD_P > T:
        raise ValueError("齿数太少，两个带轮会重叠")
    for _ in range(80):
        mid = (lo + hi) / 2
        if belt_len(mid, D, d) / HTD_P < T:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2
