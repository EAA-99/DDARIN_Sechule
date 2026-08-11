const CACHE_NAME = "ddarin-calendar-v104";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./loading.gif",
  "./songbook-loading.gif",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./today-mascot.png",
  "./일정표.png",
  "./노래책.png",
  "./유튜브.png",
  "./메모.png",
  "./로그인.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Apps Script/Sheets API 호출은 그대로 통과
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
