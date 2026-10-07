// 端到端：node tests/e2e.mjs  (需要 playwright-core 与 three：见 README 的开发说明)
// 环境变量：NODE_PATH_DEPS=含 node_modules/{three,playwright-core} 的目录
import { createRequire } from "node:module";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const deps = process.env.NODE_PATH_DEPS; const require = createRequire(deps + "/");
const { chromium } = require("playwright-core");
const root = path.resolve(import.meta.dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript" };
const srv = http.createServer((q, s) => { const f = path.join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]);
  fs.readFile(f, (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" }), s.end(d))); }).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = []; page.on("pageerror", e => errors.push(e.message)); page.on("console", m => m.type() === "error" && errors.push(m.text()));
await page.route("https://cdn.jsdelivr.net/npm/three@0.170.0/**", r => { const rel = r.request().url().split("three@0.170.0/")[1];
  r.fulfill({ body: fs.readFileSync(path.join(deps, "node_modules/three", rel)), contentType: "text/javascript" }); });
await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__haptic);
await page.click("#start"); await page.waitForTimeout(500);
const msg = await page.textContent("#msg");
// 指尖在空中：不应接触
await page.mouse.move(550, 120); await page.waitForTimeout(200);
const air = await page.evaluate(() => window.__haptic.contact);
// 向下滚轮降低高度并来回滑动，压进木板
await page.mouse.move(550, 400); for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 120);
let seen = null, maxV = 0;
for (let i = 0; i < 40; i++) { await page.mouse.move(400 + i * 8, 420, { steps: 2 }); await page.waitForTimeout(16);
  const c = await page.evaluate(() => window.__haptic.contact); if (c.touching) { seen = c; maxV = Math.max(maxV, c.vtan); } }
await page.screenshot({ path: process.env.SHOT || "shot.png" });
console.log(JSON.stringify({ msg, air_touching: air.touching, touched: !!seen, material: seen && seen.material, maxVtan: Math.round(maxV), errors }, null, 1));
// 阶段二：加载 glb（GLB 环境变量给本地副本，模拟线上链接），指尖扫过模型应产生接触
let glbTouched = null;
if (process.env.GLB) {
  await page.route("**/*.glb", r => r.fulfill({ body: fs.readFileSync(process.env.GLB), contentType: "model/gltf-binary", headers: { "access-control-allow-origin": "*" } }));
  await page.click("#loadUrl"); await page.waitForFunction(() => document.getElementById("msg").textContent.includes("已加载") || document.getElementById("msg").textContent.includes("失败"), null, { timeout: 60000 });
  glbTouched = { msg: await page.textContent("#msg"), hit: false, material: null };
  for (let y = 250; y < 520 && !glbTouched.hit; y += 10) for (let x = 400; x < 700; x += 10) { await page.mouse.move(x, y); await page.waitForTimeout(6);
    const c = await page.evaluate(() => window.__haptic.contact); if (c.touching) { glbTouched.hit = true; glbTouched.material = c.material; break; } }
  await page.screenshot({ path: (process.env.SHOT || "shot.png").replace(".png", "-glb.png") });
}
console.log(JSON.stringify({ glbTouched }));
await browser.close(); srv.close();
const ok = !air.touching && seen && maxV > 20 && errors.length === 0 && (!process.env.GLB || (glbTouched && glbTouched.hit));
console.log(ok ? "E2E PASS" : "E2E FAIL"); process.exit(ok ? 0 : 1);
