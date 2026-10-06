"""主机(PC/头显) -> 手套 MCU 的二进制帧。每个单元 3 字节：press, amp, freq/2(Hz)。
帧头 0xA5 + 序号 + 单元数 + 数据 + CRC8。76 个单元 ≈ 235 字节，BLE/UDP 1kHz 足够。"""
import struct
from typing import List
from .render import TactorState


def crc8(data: bytes) -> int:
    c = 0
    for b in data:
        c ^= b
        for _ in range(8):
            c = ((c << 1) ^ 0x07) & 0xFF if c & 0x80 else (c << 1) & 0xFF
    return c


def encode(seq: int, states: List[TactorState]) -> bytes:
    body = bytearray()
    for s in states:
        body += struct.pack("BBB", round(s.press * 255), round(s.amp * 255), min(255, round(s.freq / 2)))
    head = struct.pack("BBB", 0xA5, seq & 0xFF, len(states))
    return head + bytes(body) + bytes([crc8(head + bytes(body))])


def decode(frame: bytes):
    assert frame[0] == 0xA5 and crc8(frame[:-1]) == frame[-1], "bad frame"
    n = frame[2]
    out = []
    for i in range(n):
        p, a, f = frame[3 + 3 * i: 6 + 3 * i]
        out.append(TactorState(p / 255, a / 255, f * 2.0))
    return frame[1], out
