"""Runs build.py against a local mock Onshape server to check request flow (not geometry)."""
import json, os, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
feats, log = [], []

class H(BaseHTTPRequestHandler):
    def _send(self, obj):
        b = json.dumps(obj).encode(); self.send_response(200)
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        log.append(("GET", self.path))
        if self.path.endswith("/features"): self._send({"features": feats})
        elif "/parts/" in self.path: self._send([{"name": "Part 1"}])
        else: self._send({f"{m}{a}": v for m, v in (("low", 0), ("high", 0.6)) for a in "XYZ"})
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if "feature" not in body:  # featurescript / metadata：零件改名在 mock 里跳过
            log.append(("POST", self.path)); return self._send({"value": []})
        f = body["feature"]; f["featureId"] = f"F{len(feats)}"; feats.append(f)
        log.append(("POST", f["featureType"], f["name"])); self._send({"feature": f, "featureState": {"featureStatus": "OK"}})
    def do_DELETE(self):
        fid = self.path.rsplit("/", 1)[1]; feats[:] = [x for x in feats if x["featureId"] != fid]; log.append(("DEL", fid)); self._send({})
    def log_message(self, *a): pass

srv = HTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
env = dict(os.environ, ONSHAPE_ACCESS_KEY="a", ONSHAPE_SECRET_KEY="b", ONSHAPE_BASE_URL=f"http://127.0.0.1:{srv.server_port}")
plan = subprocess.run([sys.executable, ROOT/"scripts/templates/roller_intake.py"], capture_output=True, text=True, check=True).stdout
Path("/tmp/mock_plan.json").write_text(plan)
url = "https://cad.onshape.com/documents/aa/w/bb/e/cc"
for i in range(2):  # second run must replace the first
    r = subprocess.run([sys.executable, ROOT/"scripts/build.py", "/tmp/mock_plan.json", "--url", url, "--replace"], env=env, capture_output=True, text=True)
    print(r.stdout[-300:], r.stderr)
    assert r.returncode == 0
assert len(feats) == 30, len(feats)
assert sum(1 for l in log if l[0] == "DEL") == 30
# references resolve to server-assigned ids
ex = next(f for f in feats if f["featureType"] == "extrude")
assert 'makeId("F' in ex["parameters"][2]["queries"][0]["queryString"]
# elevator 模板：默认、全伸出、非法行程
for args, ok in (([], True), (["--set", "extension=1"], True), (["--set", "travel=80"], False)):
    r = subprocess.run([sys.executable, ROOT/"scripts/templates/elevator.py", *args], capture_output=True, text=True)
    assert (r.returncode == 0) == ok, (args, r.stderr)
    if ok:
        Path("/tmp/mock_elev.json").write_text(r.stdout)
        d = subprocess.run([sys.executable, ROOT/"scripts/build.py", "/tmp/mock_elev.json", "--dry-run"],
                           capture_output=True, text=True)
        assert d.returncode == 0 and "dry-run 通过" in d.stdout, d.stdout + d.stderr
print("mock test OK")
