import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Fingertip } from "./sim.js";
import { AudioLink } from "./audio.js";

const $ = (id) => document.getElementById(id);
const FINGERS = ["index"];                          // 先 1 指；多指只需加入追踪源
const R = 8;                                         // 指尖球半径 mm（场景单位 = mm）

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: $("view") });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15181d);
const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
camera.position.set(0, 160, 260); camera.lookAt(0, 30, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x334, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(120, 300, 160); scene.add(sun);

// ---- 场景模型：默认演示 + 可加载网上 glTF ----
const modelRoot = new THREE.Group(); scene.add(modelRoot);
function demo() {
  const mk = (geo, color, name, x) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, name })); m.name = name; m.position.x = x; modelRoot.add(m); return m; };
  mk(new THREE.BoxGeometry(300, 10, 160), 0x8a6a45, "wood_plank", 0).position.y = -5;
  mk(new THREE.SphereGeometry(30, 48, 32), 0x777777, "stone_ball", -90).position.y = 30;
  mk(new THREE.BoxGeometry(55, 40, 55), 0xc9a27a, "fur_cube", -10).position.y = 20;
  mk(new THREE.CylinderGeometry(22, 22, 60, 40), 0xb03060, "silk_cylinder", 65).position.y = 30;
  mk(new THREE.TorusGeometry(24, 9, 24, 48), 0xcccccc, "metal_ring", 120).position.set(120, 33, 0);
}
function clearModels() { while (modelRoot.children.length) modelRoot.remove(modelRoot.children[0]); }
function frameModel(obj) {
  const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3());
  const s = 150 / Math.max(size.x, size.y, size.z);          // 最大边缩放到 150mm
  obj.scale.setScalar(s); obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj); const c = b2.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z)); obj.updateMatrixWorld(true);
}
async function loadGLTF(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  clearModels(); gltf.scene.traverse(o => { if (o.isMesh) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.side = THREE.DoubleSide); } });
  modelRoot.add(gltf.scene); frameModel(gltf.scene);
}
demo();
$("loadUrl").onclick = async () => { try { $("msg").textContent = "加载中…"; await loadGLTF($("url").value); $("msg").textContent = "已加载"; } catch (e) { $("msg").textContent = "加载失败：" + e.message + "（需要允许 CORS 的 .glb/.gltf 链接）"; } };
$("file").onchange = async (e) => { const f = e.target.files[0]; if (f) { await loadGLTF(URL.createObjectURL(f)); $("msg").textContent = "已加载 " + f.name; } };

// ---- 虚拟指尖：鼠标控制（接口与追踪源解耦，之后换成手部追踪即可）----
const tip = new Fingertip(R);
const tipMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshBasicMaterial({ color: 0x4cc9f0 }));
scene.add(tipMesh);
let depthZ = 0, mouse = new THREE.Vector2(0, 0), lift = 20;
const ray = new THREE.Raycaster();
function target() {                                     // 指尖目标：鼠标射线与水平面 y=lift 相交；滚轮改高度，Shift+移动改前后
  ray.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -lift);
  const p = new THREE.Vector3(); ray.ray.intersectPlane(plane, p);
  return p ? p.setZ(THREE.MathUtils.clamp(p.z + depthZ, -120, 120)) : new THREE.Vector3();
}
renderer.domElement.addEventListener("pointermove", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
});
renderer.domElement.addEventListener("wheel", (e) => { lift = THREE.MathUtils.clamp(lift - e.deltaY * 0.05, -5, 120); e.preventDefault(); }, { passive: false });
addEventListener("keydown", (e) => { if (e.key === "ArrowUp") depthZ -= 6; if (e.key === "ArrowDown") depthZ += 6; });

// ---- 触觉输出 ----
let link = null;
$("start").onclick = async () => {
  link = new AudioLink(FINGERS.length);
  try { const i = await link.start(); $("msg").textContent = `音频已启动：${i.channels} 声道(设备最多 ${i.maxCh})，基础延迟约 ${i.latency.toFixed(1)} ms`; }
  catch (e) { $("msg").textContent = "音频启动失败：" + e.message; link = null; }
};
$("test").onclick = () => { if (link) link.send(0, { touching: true, force: 0.8, vtan: 0, vnorm: -250, material: "stone" }); };

// ---- 主循环 ----
const scope = $("scope").getContext("2d");
const state = { contact: null, fps: 0 };
window.__haptic = state;                                // 供自动化测试读取
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const p = target(); tip.moveTo(p, dt); tipMesh.position.copy(tip.pos);
  const c = tip.sense([modelRoot]); state.contact = c;
  tipMesh.material.color.set(c.touching ? 0xff6b6b : 0x4cc9f0);
  if (link) link.send(0, c);
  $("stat").textContent = `接触:${c.touching ? "是" : "否"}  材质:${c.material}  力代理:${c.force.toFixed(2)}  切向速度:${c.vtan.toFixed(0)} mm/s  穿透:${c.pen.toFixed(1)} mm`;
  if (link && link.analyser) {
    const buf = new Float32Array(1024); link.analyser.getFloatTimeDomainData(buf);
    scope.clearRect(0, 0, 400, 70); scope.strokeStyle = "#4cc9f0"; scope.beginPath();
    for (let i = 0; i < 400; i++) { const y = 35 - buf[i * 2] * 33; i ? scope.lineTo(i, y) : scope.moveTo(i, y); }
    scope.stroke();
  }
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  if (renderer.domElement.width !== w || renderer.domElement.height !== h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
