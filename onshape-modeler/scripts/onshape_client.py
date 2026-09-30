"""Thin Onshape REST client (Basic auth with API keys)."""
import os
import re
import sys
from pathlib import Path

import requests

SKILL_DIR = Path(__file__).resolve().parent.parent
URL_RE = re.compile(r"documents/([0-9a-f]+)/([wvm])/([0-9a-f]+)/e/([0-9a-f]+)")


def load_env():
    env_file = SKILL_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def parse_url(url):
    m = URL_RE.search(url)
    if not m:
        raise SystemExit("URL 格式不对，应为 https://cad.onshape.com/documents/<did>/w/<wid>/e/<eid>")
    did, kind, wid, eid = m.groups()
    if kind != "w":
        raise SystemExit("需要 workspace 链接（/w/），版本(/v/)或 microversion(/m/) 不能写入")
    return did, wid, eid


class OnshapeError(RuntimeError):
    pass


class Client:
    def __init__(self, url):
        load_env()
        ak, sk = os.environ.get("ONSHAPE_ACCESS_KEY"), os.environ.get("ONSHAPE_SECRET_KEY")
        if not ak or not sk:
            raise SystemExit("缺少 ONSHAPE_ACCESS_KEY / ONSHAPE_SECRET_KEY：请放进环境变量或 "
                             f"{SKILL_DIR}/.env（参考 .env.example），不要贴进对话。")
        self.base = os.environ.get("ONSHAPE_BASE_URL", "https://cad.onshape.com").rstrip("/") + "/api/v6"
        self.did, self.wid, self.eid = parse_url(url)
        self.s = requests.Session()
        self.s.auth = (ak, sk)
        self.s.headers.update({"Accept": "application/json;charset=UTF-8; qs=0.09",
                               "Content-Type": "application/json"})

    @property
    def ps(self):
        return f"{self.base}/partstudios/d/{self.did}/w/{self.wid}/e/{self.eid}"

    def _req(self, method, url, **kw):
        r = self.s.request(method, url, timeout=60, **kw)
        if not r.ok:
            raise OnshapeError(f"{method} {url.replace(self.base, '')} -> {r.status_code}: {r.text[:500]}")
        return r.json() if r.content else {}

    def features(self):
        return self._req("GET", f"{self.ps}/features")

    def add_feature(self, feature):
        return self._req("POST", f"{self.ps}/features", json={"feature": feature})

    def delete_feature(self, fid):
        return self._req("DELETE", f"{self.ps}/features/featureid/{fid}")

    def parts(self):
        return self._req("GET", f"{self.base}/parts/d/{self.did}/w/{self.wid}/e/{self.eid}")

    def bbox(self):
        return self._req("GET", f"{self.ps}/boundingboxes")


def feature_status(resp):
    """Returns (status, message) from an add_feature response."""
    st = resp.get("featureState", {})
    return st.get("featureStatus", "UNKNOWN"), st.get("statusMessage") or ""
