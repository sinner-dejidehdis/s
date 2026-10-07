import test from "node:test";
import assert from "node:assert/strict";
import { FingerVoice, contactFromGeometry, materialFromName } from "../src/haptics.js";

const SR = 48000;
const run = (v, secs) => {
  const out = new Float32Array(Math.round(SR * secs));
  for (let i = 0; i < out.length; i += 128) v.process(out.subarray(i, Math.min(i + 128, out.length)), Math.min(128, out.length - i));
  return out;
};
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const zc = (a) => { let c = 0; for (let i = 1; i < a.length; i++) if (a[i - 1] < 0 && a[i] >= 0) c++; return c; };

test("几何：穿透才算接触，切向速度正确分解", () => {
  assert.equal(contactFromGeometry({ dist: 10, radius: 8, vel: [0, 0, 0], normal: [0, 1, 0] }).touching, false);
  const c = contactFromGeometry({ dist: 6, radius: 8, vel: [30, -40, 0], normal: [0, 1, 0] });
  assert.ok(c.touching && Math.abs(c.vtan - 30) < 1e-9 && Math.abs(c.vnorm + 40) < 1e-9);
  assert.ok(c.force > 0 && c.force < 1);
});

test("未接触时完全静音", () => {
  const v = new FingerVoice(SR);
  v.setParams({ touching: false, force: 0, vtan: 100, material: "stone" });
  assert.equal(rms(run(v, 0.2)), 0);
});

test("静止按压只有碰撞瞬态，之后归零", () => {
  const v = new FingerVoice(SR);
  v.setParams({ touching: true, force: 0.8, vtan: 0, vnorm: -200, material: "stone" });
  const a = run(v, 0.5);
  assert.ok(rms(a.subarray(0, 2400)) > 0.05, "起始有碰撞");
  assert.ok(rms(a.subarray(SR * 0.4)) < 1e-4, "之后无振动");
});

test("滑动频率 = 速度/纹理周期", () => {
  for (const speed of [100, 200]) {
    const v = new FingerVoice(SR);
    v.setParams({ touching: true, force: 0.7, vtan: speed, vnorm: 0, material: "wood" }); // period=2mm
    run(v, 0.3);
    const a = run(v, 1.0);
    const f = zc(a) / 1.0;
    assert.ok(Math.abs(f - speed / 2) < 4, `speed ${speed} -> ${f}Hz`);
  }
});

test("更硬的材质碰撞更强更短", () => {
  const imp = (mat) => { const v = new FingerVoice(SR); v.setParams({ touching: true, force: 0.5, vtan: 0, vnorm: -150, material: mat }); return run(v, 0.1); };
  const hard = imp("stone"), soft = imp("fur");
  assert.ok(rms(hard.subarray(0, 480)) > rms(soft.subarray(0, 480)));
});

test("材质名推断", () => {
  assert.equal(materialFromName("Wooden_Plank_01"), "wood");
  assert.equal(materialFromName("StoneWall"), "stone");
  assert.equal(materialFromName("unknown"), "skin");
});
