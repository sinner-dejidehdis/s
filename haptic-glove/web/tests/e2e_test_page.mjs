// node tests/e2e_test_page.mjs  (NODE_PATH_DEPS 同 e2e.mjs)
import { createRequire } from "node:module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const require = createRequire(process.env.NODE_PATH_DEPS + "/"); const { chromium } = require("playwright-core");
const root = path.resolve(import.meta.dirname, ".."); const mime = { ".html": "text/html", ".js": "text/javascript" };
const srv = http.createServer((q, s) => { const f = path.join(root, q.url.split("?")[0]); fs.readFile(f, (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" }), s.end(d))); }).listen(0);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage(); const errors = []; page.on("pageerror", e => errors.push(e.message)); page.on("console", m => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:${srv.address().port}/test.html`);
await page.click("#start"); await page.waitForFunction(() => !document.getElementById("begin").disabled);
await page.fill("#reps", "2"); await page.click("#begin");
for (let i = 0; i < 8; i++) { await page.click("#play"); await page.waitForTimeout(3300); await page.click(".ans >> nth=0"); }
await page.waitForFunction(() => window.__trial.done);
const out = await page.evaluate(() => ({ n: window.__trial.results.length, sum: document.getElementById("sum").textContent }));
await page.screenshot({ path: process.env.SHOT || "test.png" });
console.log(JSON.stringify({ ...out, errors })); await browser.close(); srv.close();
process.exit(out.n === 8 && errors.length === 0 ? 0 : 1);
