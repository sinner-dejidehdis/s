import { AudioLink } from "./audio.js";
import { MATERIALS } from "./haptics.js";
import { DEFAULT_MATERIALS, STROKE_SECONDS, makeTrials, stimulusAt, score } from "./trial.js";

const $ = (id) => document.getElementById(id);
const NAMES = { silk: "丝绸", fur: "毛皮", skin: "皮肤", wood: "木头", stone: "石头", metal: "金属" };
let link = null, trials = [], idx = 0, results = [], played = 0, playing = false, mats = [];
const state = window.__trial = { results, done: false };

for (const m of Object.keys(MATERIALS)) {
  const l = document.createElement("label"); l.style.marginRight = "10px";
  l.innerHTML = `<input type="checkbox" value="${m}" ${DEFAULT_MATERIALS.includes(m) ? "checked" : ""}> ${NAMES[m]}`;
  $("mats").appendChild(l);
}

$("start").onclick = async () => {
  link = new AudioLink(1);
  try { const i = await link.start(); link.setLevel(+$("level").value); $("msg").textContent = `已启动，${i.channels} 声道`; $("begin").disabled = false; }
  catch (e) { $("msg").textContent = "失败：" + e.message; link = null; }
};
$("level").oninput = () => { $("lv").textContent = (+$("level").value).toFixed(2); link && link.setLevel(+$("level").value); };
$("ping").onclick = () => link && link.send(0, { touching: true, force: 0.8, vtan: 0, vnorm: -250, material: "stone" });

function playStimulus(material) {            // 把固定刺激按时间推给声部
  playing = true; $("play").disabled = true; $("replay").disabled = true;
  const t0 = performance.now();
  const timer = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    link.send(0, stimulusAt(material, t));
    if (t >= STROKE_SECONDS) { clearInterval(timer); link.send(0, stimulusAt(material, t)); playing = false; played++; $("replay").disabled = played >= 2; }
  }, 8);
}

$("begin").onclick = () => {
  mats = [...document.querySelectorAll("#mats input:checked")].map(i => i.value);
  if (mats.length < 2) { $("msg").textContent = "至少选 2 种材质"; return; }
  trials = makeTrials(mats, +$("reps").value); idx = 0; results.length = 0; state.done = false;
  $("setup").hidden = true; $("run").hidden = false; $("res").hidden = true; $("total").textContent = trials.length;
  $("answers").innerHTML = ""; for (const m of mats) { const b = document.createElement("button"); b.className = "ans"; b.textContent = NAMES[m]; b.dataset.m = m; b.disabled = true; b.onclick = () => answer(m); $("answers").appendChild(b); }
  nextTrial();
};
function nextTrial() {
  played = 0; $("no").textContent = idx + 1; $("play").disabled = false; $("replay").disabled = true;
  document.querySelectorAll(".ans").forEach(b => b.disabled = true);
}
$("play").onclick = () => { if (playing) return; playStimulus(trials[idx].material); document.querySelectorAll(".ans").forEach(b => b.disabled = false); $("play").disabled = true; };
$("replay").onclick = () => { if (!playing && played < 2) playStimulus(trials[idx].material); };
function answer(m) {
  if (playing) return;
  results.push({ i: idx, material: trials[idx].material, answer: m, replays: Math.max(0, played - 1) });
  idx++;
  if (idx >= trials.length) return finish();
  nextTrial();
}
function finish() {
  $("run").hidden = true; $("res").hidden = false; state.done = true;
  const s = score(results, mats); state.score = s;
  $("sum").textContent = `正确 ${s.correct}/${s.n} = ${(s.accuracy * 100).toFixed(0)}%（随机猜测 ${(s.chance * 100).toFixed(0)}%，p = ${s.pValue.toExponential(1)}）`;
  let h = "<table><tr><th>真实＼回答</th>" + mats.map(m => `<th>${NAMES[m]}</th>`).join("") + "</tr>";
  for (const a of mats) h += `<tr><th>${NAMES[a]}</th>` + mats.map(b => `<td>${s.confusion[a][b]}</td>`).join("") + "</tr>";
  $("conf").innerHTML = h + "</table>";
  const good = s.accuracy >= 0.6 && s.pValue < 0.01;
  $("verdict").innerHTML = good ? "这位受试者：<b>能区分</b>（正确率 ≥ 60% 且 p &lt; 0.01）。需要 ≥ 8 人都如此才算通过。" : "这位受试者：<b>区分不明显</b>。看混淆矩阵里哪两种材质被混淆，调它们的纹理参数后重测。";
}
$("dl").onclick = () => {
  const blob = new Blob([JSON.stringify({ pid: $("pid").value, date: new Date().toISOString(), materials: mats, results, score: state.score }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `haptic-test-${$("pid").value}.json`; a.click();
};
