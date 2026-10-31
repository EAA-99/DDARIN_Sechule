const CACHE_NAME = "ddarin-calendar-v637";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=637",
  "./app.js?v=637",
  "./games.js?v=637",
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

// 새 버전은 다음에 켤 때부터 보임 (버전이 바뀌어도 자동 새로고침은 하지 않음)
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Apps Script/Sheets API 호출은 그대로 통과
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
