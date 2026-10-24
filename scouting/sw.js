// 离线缓存：第一次联网打开后，整站在没网的看台也能用。改了文件就把 VERSION 加 1。
var VERSION = 'frcscout-v3';
var FILES = [
  './', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'css/style.css',
  'vendor/qrcode.js', 'vendor/jsQR.js',
  'js/config.js', 'js/store.js', 'js/codec.js', 'js/analysis.js', 'js/tba.js', 'js/ui.js',
  'js/match.js', 'js/subjective.js', 'js/pit.js', 'js/data.js', 'js/views.js', 'js/app.js',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// 同源文件：先用缓存，同时后台更新；TBA 等跨域请求直接走网络
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
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
