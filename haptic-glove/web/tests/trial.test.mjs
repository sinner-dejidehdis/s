import test from "node:test"; import assert from "node:assert/strict";
import { makeTrials, stimulusAt, score, binomialTail, STROKE_SECONDS } from "../src/trial.js";

test("试次：每种材质次数相等并打乱", () => {
  const t = makeTrials(["a", "b", "c"], 5);
  assert.equal(t.length, 15);
  for (const m of ["a", "b", "c"]) assert.equal(t.filter(x => x.material === m).length, 5);
  assert.notDeepEqual(t.map(x => x.material), [..."aaaaabbbbbccccc"]);
});
test("刺激：开头碰撞、中间滑动、结束后静止", () => {
  assert.equal(stimulusAt("wood", 0.01).vnorm, -150);
  assert.ok(stimulusAt("wood", 0.375).vtan > 100);
  assert.equal(stimulusAt("wood", STROKE_SECONDS + 0.1).touching, false);
});
test("二项检验：精确值", () => {
  assert.ok(Math.abs(binomialTail(10, 10, 0.5) - 1 / 1024) < 1e-12);
  assert.ok(Math.abs(binomialTail(4, 0, 0.25) - 1) < 1e-12);
  assert.ok(binomialTail(20, 12, 0.25) < 0.001);
});
test("评分：全对/全随机", () => {
  const mats = ["a", "b"];
  const s = score([{ material: "a", answer: "a" }, { material: "b", answer: "b" }, { material: "a", answer: "b" }], mats);
  assert.equal(s.correct, 2); assert.equal(s.confusion.a.b, 1); assert.equal(s.chance, 0.5);
});
