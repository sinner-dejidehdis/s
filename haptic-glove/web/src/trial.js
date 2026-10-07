// 盲测逻辑（无 DOM，可在 Node 测试）。
export const DEFAULT_MATERIALS = ["silk", "wood", "stone", "metal"];
export const STROKE_SECONDS = 3;

export function makeTrials(materials, repsEach, rng = Math.random) {
  const t = [];
  for (const m of materials) for (let i = 0; i < repsEach; i++) t.push({ material: m });
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t.map((x, i) => ({ ...x, i }));
}

// 固定的刺激：开头一次碰撞，然后往复滑动（速度按正弦起伏，每 0.75s 换向一次）
export function stimulusAt(material, t, { vmax = 120, force = 0.6 } = {}) {
  if (t < 0 || t >= STROKE_SECONDS) return { touching: false, force: 0, vtan: 0, vnorm: 0, material };
  return { touching: true, force, vtan: vmax * Math.abs(Math.sin((Math.PI * t) / 0.75)), vnorm: t < 0.02 ? -150 : 0, material };
}

// P(X >= k)，X ~ Binomial(n, p)
export function binomialTail(n, k, p) {
  let s = 0;
  for (let i = k; i <= n; i++) s += Math.exp(lchoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
  return Math.min(1, s);
}
function lchoose(n, k) { let r = 0; for (let i = 1; i <= k; i++) r += Math.log((n - k + i) / i); return r; }

// results: [{material, answer}]
export function score(results, materials) {
  const n = results.length, correct = results.filter(r => r.material === r.answer).length;
  const confusion = {}; for (const a of materials) { confusion[a] = {}; for (const b of materials) confusion[a][b] = 0; }
  for (const r of results) confusion[r.material][r.answer]++;
  const chance = 1 / materials.length;
  return { n, correct, accuracy: n ? correct / n : 0, chance, pValue: n ? binomialTail(n, correct, chance) : 1, confusion };
}
