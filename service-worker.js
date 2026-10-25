const CACHE_NAME = "ddarin-calendar-v616";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=616",
  "./app.js?v=616",
  "./games.js?v=616",
  "./manifest.json",
  "./DDARIN_아바타.jpg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./today-mascot.png",
  "./today-mascot2.png",
  "./today-mascot3.png",
  "./일정표.png",
  "./노래책.png",
  "./유튜브.png",
  "./메모.png",
  "./로그인.png",
  "./메뉴판2.png",
  "./게임메뉴.png",
  "./따린_홈.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn("[service-worker] 캐시 실패, 건너뜀:", url, err))
        )
      )
    )
  );
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
