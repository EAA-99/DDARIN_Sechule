const CACHE_NAME = "ddarin-calendar-v426";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./games.js",
  "./manifest.json",
  "./DDARIN_아바타.jpg",
  "./높은양갈래따린윙크.gif",
  "./단발오잉따린.gif",
  "./단발음뫄.gif",
  "./양갈래하트윙크따린.gif",
  "./키네시스어센트따린.gif",
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
  "./룰렛 꽝 이미지.png",
  "./룰렛 꽝 이미지 2.png",
  "./룰렛 꽝 이미지3.png",
  "./룰렛 이미지.png",
  "./룰렛 이미지2.png",
  "./룰렛 이미지3.png",
  "./soop 배경.png",
  "./youtube배경.png",
  "./playlist배경.jpg",
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
