"""Small CAD helpers for the whole-robot subsystem scripts (cadquery, inches in / mm internal)."""
import math
from pathlib import Path

import cadquery as cq
import ezdxf

K = 25.4
DENS = {"6061": 0.0975, "7075": 0.101, "polycarbonate": 0.0433, "nylon": 0.0412, "plywood": 0.026, "steel": 0.283, "foam": 0.002}


def box(x0, x1, y0, y1, z0, z1):
    return cq.Workplane().add(cq.Solid.makeBox((x1 - x0) * K, (y1 - y0) * K, (z1 - z0) * K, cq.Vector(x0 * K, y0 * K, z0 * K)))


def cyl_x(x0, x1, y, z, r):
    return cq.Workplane().add(cq.Solid.makeCylinder(r * K, (x1 - x0) * K, cq.Vector(x0 * K, y * K, z * K), cq.Vector(1, 0, 0)))


def cyl_y(y0, y1, x, z, r):
    return cq.Workplane().add(cq.Solid.makeCylinder(r * K, (y1 - y0) * K, cq.Vector(x * K, y0 * K, z * K), cq.Vector(0, 1, 0)))


def cyl_z(z0, z1, x, y, r):
    return cq.Workplane().add(cq.Solid.makeCylinder(r * K, (z1 - z0) * K, cq.Vector(x * K, y * K, z0 * K), cq.Vector(0, 0, 1)))


def plate_z(x0, x1, y0, y1, z0, t, holes=(), cuts=(), round_r=0.0):
    """horizontal plate z0..z0+t; holes = [(x, y, r)] through; cuts = [(x0,x1,y0,y1)] rectangular cutouts"""
    p = box(x0, x1, y0, y1, z0, z0 + t)
    for x, y, r in holes:
        p = p.cut(cyl_z(z0 - 0.1, z0 + t + 0.1, x, y, r))
    for a, b, c, d in cuts:
        p = p.cut(box(a, b, c, d, z0 - 0.1, z0 + t + 0.1))
    return p


def plate_y(x0, x1, z0, z1, y0, t, holes=(), cuts=()):
    """vertical plate normal Y: y0..y0+t; holes = [(x, z, r)]; cuts = [(x0,x1,z0,z1)]"""
    p = box(x0, x1, y0, y0 + t, z0, z1)
    for x, z, r in holes:
        p = p.cut(cyl_y(y0 - 0.1, y0 + t + 0.1, x, z, r))
    for a, b, c, d in cuts:
        p = p.cut(box(a, b, y0 - 0.1, y0 + t + 0.1, c, d))
    return p


def volume_in3(w):
    return (w.val() if hasattr(w, "val") else w).Volume() / K ** 3


def mass_lb(w, mat):
    return volume_in3(w) * DENS[mat]


def centroid_in(w):
    c = (w.val() if hasattr(w, "val") else w).Center()
    return (c.x / K, c.y / K, c.z / K)


def save_step(parts, path):
    asm = cq.Assembly(name=Path(path).stem)
    for n, w in parts:
        asm.add(w if hasattr(w, "val") else cq.Workplane().add(w), name=n)
    asm.save(str(path))


def save_dxf(path, rects=(), circles=(), polys=(), layer="CUT", zones=()):
    """1:1 inches. rects=[(x0,y0,x1,y1)], circles=[(x,y,r)], polys=[[(x,y),...]], zones = [(label, x0,y0,x1,y1)] drawn on layer ZONE (not cut)"""
    doc = ezdxf.new("R2010", setup=True)
    doc.units = 1
    doc.layers.add("CUT", color=7)
    doc.layers.add("ZONE", color=1)
    msp = doc.modelspace()
    for x0, y0, x1, y1 in rects:
        msp.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True, dxfattribs={"layer": layer})
    for x, y, r in circles:
        msp.add_circle((x, y), r, dxfattribs={"layer": layer})
    for p in polys:
        msp.add_lwpolyline(list(p), close=True, dxfattribs={"layer": layer})
    for lab, x0, y0, x1, y1 in zones:
        msp.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True, dxfattribs={"layer": "ZONE"})
        msp.add_text(lab, dxfattribs={"layer": "ZONE", "height": 0.25}).set_placement((x0 + 0.1, y0 + 0.1))
    doc.saveas(str(path))
