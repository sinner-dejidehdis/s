// Saves the project in this browser only. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const KEY = 'sigao.project.v1';

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      const p = raw ? JSON.parse(raw) : null;
      return p && p.version === 1 ? p : null;
    } catch (e) { return null; }
  }

  function save(p) {
    try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; }
  }

  S.store = { load, save };
})(typeof window !== 'undefined' ? window : globalThis);
