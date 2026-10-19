// Offline cache for the hosted version. Bump VERSION whenever a file changes.
var VERSION = 'rbscout-v2-5';
var FILES = [
  './', 'index.html', 'manifest.webmanifest', 'logo.png', 'css/v2.css', 'vendor/qrcode.js',
  'js/config.js', 'js/codec.js', 'js/stats.js', 'js/ui.js', 'js/quake.js', 'js/field.js', 'js/form.js', 'js/data.js', 'js/app.js',
  'rebuilt-scout-v2-offline.html',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Cache first, refresh in the background. Fonts and other sites go to the network.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
