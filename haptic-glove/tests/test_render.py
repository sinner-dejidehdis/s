import math, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from glove.layout import build_layout, zone_tactors
from glove.render import Renderer, Contact
from glove.protocol import encode, decode

L = build_layout()
idx = zone_tactors(L, "index")


def settle(r, c, n=10):
    for _ in range(n):
        st = r.step([c])
    return st


def centroid(st):
    w = sum(st[t.idx].amp for t in idx)
    return sum(st[t.idx].amp * t.y for t in idx) / w


def test_phantom_centroid_tracks_contact():
    # 接触点在两行之间连续移动，激活重心应单调跟随（不是格子间跳变）
    cs = []
    for y in [2.0, 4.0, 6.0, 8.0, 10.0]:
        r = Renderer(L)
        cs.append(centroid(settle(r, Contact("index", 0, y, 0.6, vy=40, material="fur"))))
    assert all(b > a for a, b in zip(cs, cs[1:])), cs


def test_static_press_has_no_vibration():
    st = settle(Renderer(L), Contact("index", 0, 6, 0.8, material="skin"))
    assert max(s.amp for s in st) == 0 and max(s.press for s in st) > 0.3


def test_freq_in_actuator_band_and_scales_with_speed():
    slow = settle(Renderer(L), Contact("index", 0, 6, 0.6, vy=20, material="stone"))
    fast = settle(Renderer(L), Contact("index", 0, 6, 0.6, vy=60, material="stone"))
    f = lambda st: max(s.freq for s in st)
    assert 80 <= f(slow) <= f(fast) <= 300


def test_other_zones_silent():
    st = settle(Renderer(L), Contact("index", 0, 6, 0.8, vy=40, material="wood"))
    assert all(st[t.idx].amp == 0 and st[t.idx].press == 0 for t in L if t.zone != "index")


def test_protocol_roundtrip():
    st = settle(Renderer(L), Contact("index", 0, 6, 0.8, vy=40, material="wood"))
    seq, out = decode(encode(7, st))
    assert seq == 7 and len(out) == len(st)
    assert all(abs(a.amp - b.amp) < 0.01 for a, b in zip(st, out))
