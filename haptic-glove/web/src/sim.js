// 指尖与任意网格(含网上加载的 glTF)的位置关系 -> 接触量。
// 做法：从指尖球心向 14 个方向发射线，取"最近的表面距离估计"。
// 不依赖 BVH，任何 three.js 网格都能用；代价是对很薄的物体/尖角不精确。
import * as THREE from "three";
import { contactFromGeometry, materialFromName } from "./haptics.js";

const DIRS = (() => {
  const d = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) d.push([x, y, z]);
  return d.map(v => new THREE.Vector3(...v).normalize());
})();

export function hapticMaterialOf(mesh) {
  if (mesh.userData && mesh.userData.haptic) return mesh.userData.haptic;
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return materialFromName(`${(mat && mat.name) || ""} ${mesh.name || ""}`);
}

export class Fingertip {
  constructor(radius = 8) {
    this.radius = radius;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();       // mm/s，低通后
    this._last = null;
    this._ray = new THREE.Raycaster();
  }

  // 更新位置并估计速度（dt 秒）
  moveTo(p, dt) {
    if (this._last && dt > 0) {
      const inst = p.clone().sub(this._last).divideScalar(dt);
      this.vel.lerp(inst, 0.5);
    }
    this._last = p.clone();
    this.pos.copy(p);
  }

  // targets: 要探测的 Object3D 数组（场景中的模型根节点）
  sense(targets) {
    this._ray.near = 0;
    this._ray.far = this.radius * 2;
    let best = null;
    for (const d of DIRS) {
      this._ray.set(this.pos, d);
      const hits = this._ray.intersectObjects(targets, true);
      if (!hits.length) continue;
      const h = hits[0];
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.dot(d) > 0) n.negate();                   // 法线朝向指尖
      const dist = h.distance * Math.abs(n.dot(d));   // 到切平面的垂直距离估计
      if (!best || dist < best.dist) best = { dist, n, obj: h.object };
    }
    if (!best) return { touching: false, force: 0, vtan: 0, vnorm: 0, pen: 0, material: "skin" };
    const c = contactFromGeometry({
      dist: best.dist, radius: this.radius,
      vel: [this.vel.x, this.vel.y, this.vel.z], normal: [best.n.x, best.n.y, best.n.z],
    });
    c.material = hapticMaterialOf(best.obj);
    return c;
  }
}
