// ===== 노래책 데이터 (Google Sheets) =====
const SONGBOOK_SPREADSHEET_ID = "1NhImCLm5diXM0pA45SkB-g2PARivQiVN8bUKlniiOB8";
const SHEETS_API_KEY = "AIzaSyC0RsFfc5y9GmEaE29niGWD9hbSnpIc7rM";

function albumArtCacheKey(song) {
  return `${song.artist}|${song.title}`.toLowerCase();
}

async function fetchSongbookGenres() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SONGBOOK_SPREADSHEET_ID}?key=${SHEETS_API_KEY}&fields=sheets.properties.title`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.sheets || [])
    .map((s) => s.properties.title)
    .filter((title) => !/^시트\d+$/.test(title));
}

async function fetchSongbookSongs() {
  const genres = await fetchSongbookGenres();
  if (!genres.length) return [];
  const ranges = genres.map((g) => `ranges=${encodeURIComponent(`'${g}'!C2:D`)}`).join("&");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SONGBOOK_SPREADSHEET_ID}/values:batchGet?${ranges}&key=${SHEETS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const songs = [];
  (data.valueRanges || []).forEach((vr, i) => {
    const genre = genres[i];
    (vr.values || []).forEach((row) => {
      const [artist, title] = row;
      if (!title) return;
      songs.push({ genre, artist: artist || "", title });
    });
  });
  return songs;
}

async function fetchLocalOverrides() {
  try {
    const res = await fetch("https://ddarin-sechule.vercel.app/api/songbook");
    if (!res.ok) return { overrides: {}, deletions: [] };
    const data = await res.json();
    return { overrides: data.overrides || {}, deletions: data.deletions || [] };
  } catch {
    return { overrides: {}, deletions: [] };
  }
}

// exe 전용 비밀키. 일정표 웹앱의 로그인 계정과는 무관하며, 서버(api/songbook.js)의
// SONGBOOK_APP_KEY 환경변수와 반드시 같아야 함.
const SONGBOOK_APP_KEY = "SimyVEO0eWXq1FFlt6mHxLi5HYUPtVO4maW2nplg";

async function saveSongbookLocalData() {
  try {
    await fetch("https://ddarin-sechule.vercel.app/api/songbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: SONGBOOK_APP_KEY,
        overrides: localSongOverrides,
        deletions: [...localSongDeletions],
      }),
    });
  } catch {
    // 네트워크 오류 시에도 로컬 상태는 이미 반영되어 있으므로 화면은 정상 동작
  }
}

let allSongs = [];
let songByKey = {};
let localSongOverrides = {};
let localSongDeletions = new Set();
let songbookGenresList = [];

async function loadSongbook() {
  const [songs, local] = await Promise.all([fetchSongbookSongs(), fetchLocalOverrides()]);
  localSongOverrides = local.overrides;
  localSongDeletions = new Set(local.deletions);

  const merged = [];
  const seenKeys = new Set();
  songs.forEach((song) => {
    const key = albumArtCacheKey(song);
    if (localSongDeletions.has(key)) return;
    const finalSong = localSongOverrides[key] ? { ...localSongOverrides[key] } : song;
    merged.push(finalSong);
    seenKeys.add(key);
  });
  Object.keys(localSongOverrides).forEach((key) => {
    if (seenKeys.has(key) || localSongDeletions.has(key)) return;
    merged.push({ ...localSongOverrides[key] });
  });

  allSongs = merged;
  songByKey = {};
  allSongs.forEach((song) => {
    songByKey[albumArtCacheKey(song)] = song;
  });

  songbookGenresList = [...new Set(allSongs.map((s) => s.genre))];
  renderGenreTabs2(songbookGenresList);
}

// ===== 공용 대기열 (일정표 웹앱과 동일한 /api/songbook?resource=queue 사용) =====
let singQueueOrder = [];
let songRequestTimeByKey = {};

async function fetchSingQueue() {
  try {
    const res = await fetch("https://ddarin-sechule.vercel.app/api/songbook?resource=queue");
    if (!res.ok) return;
    const data = await res.json();
    singQueueOrder = Array.isArray(data.queue) ? data.queue : [];
    songRequestTimeByKey = data.times && typeof data.times === "object" ? data.times : {};
    renderSongRequestList();
  } catch (err) {
    console.error("[대기열] 불러오기 실패:", err);
  }
}

let queueSaveChain = Promise.resolve();

function saveSingQueue() {
  const queueSnapshot = [...singQueueOrder];
  const timesSnapshot = { ...songRequestTimeByKey };
  queueSaveChain = queueSaveChain.then(() =>
    fetch("https://ddarin-sechule.vercel.app/api/songbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: SONGBOOK_APP_KEY, resource: "queue", queue: queueSnapshot, times: timesSnapshot }),
    }).catch((err) => console.error("[대기열] 저장 실패:", err))
  );
}

function addToSingQueue(keys) {
  keys.forEach((key) => {
    if (!singQueueOrder.includes(key)) {
      singQueueOrder.push(key);
      songRequestTimeByKey[key] = Date.now();
    }
  });
  saveSingQueue();
  renderSongRequestList();
}

function removeFromSingQueue(key) {
  const idx = singQueueOrder.indexOf(key);
  if (idx === -1) return;
  singQueueOrder.splice(idx, 1);
  saveSingQueue();
  renderSongRequestList();
}

let draggedQueueKey = null;

function clearSingQueue() {
  singQueueOrder = [];
  saveSingQueue();
  renderSongRequestList();
}

// ===== 사이드바 탭 전환 =====
const songRequestNavItems = document.querySelectorAll(".song-request-nav-item[data-panel]");
const songRequestContentPanels = document.querySelectorAll(".song-request-content-panel");

songRequestNavItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    songRequestNavItems.forEach((el) => el.classList.toggle("active", el === btn));
    const target = btn.dataset.panel;
    songRequestContentPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === target));
  });
});

// ===== 오버레이 > 테마 (다크/화이트 공용) =====
const OVERLAY_THEMES = {
  dark: { bg: "#14141c", color: "#ffffff" },
  light: { bg: "#ffffff", color: "#14141c" },
};

function setupOverlayThemeToggle(wrapId, onChange) {
  const wrap = document.getElementById(wrapId);
  const btns = wrap.querySelectorAll(".song-request-theme-btn");
  let theme = "dark";
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      theme = btn.dataset.theme;
      btns.forEach((b) => b.classList.toggle("active", b === btn));
      onChange();
    });
  });
  return { get: () => theme };
}

const SONG_REQUEST_OVERLAY_FONT_DEFAULT = "system";

const SONG_REQUEST_OVERLAY_FONTS = {
  system: { family: `"Malgun Gothic", "Segoe UI", sans-serif`, google: null },
  notosanskr: { family: `"Noto Sans KR", sans-serif`, google: "Noto+Sans+KR:wght@400;700;900" },
  nanumgothic: { family: `"Nanum Gothic", sans-serif`, google: "Nanum+Gothic:wght@400;700;800" },
  nanummyeongjo: { family: `"Nanum Myeongjo", serif`, google: "Nanum+Myeongjo:wght@400;700;800" },
  gothica1: { family: `"Gothic A1", sans-serif`, google: "Gothic+A1:wght@400;700;900" },
  dohyeon: { family: `"Do Hyeon", sans-serif`, google: "Do+Hyeon" },
  blackhansans: { family: `"Black Han Sans", sans-serif`, google: "Black+Han+Sans" },
  jua: { family: `"Jua", sans-serif`, google: "Jua" },
  gaegu: { family: `"Gaegu", sans-serif`, google: "Gaegu:wght@400;700" },
  gamjaflower: { family: `"Gamja Flower", sans-serif`, google: "Gamja+Flower" },
  poorstory: { family: `"Poor Story", sans-serif`, google: "Poor+Story" },
  sunflower: { family: `"Sunflower", sans-serif`, google: "Sunflower:wght@300;500;700" },
  singleday: { family: `"Single Day", sans-serif`, google: "Single+Day" },
};

function loadGoogleFontLink(fontKey, linkId) {
  const existing = document.getElementById(linkId);
  const google = SONG_REQUEST_OVERLAY_FONTS[fontKey]?.google;
  if (!google) {
    if (existing) existing.remove();
    return;
  }
  const link = existing || document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${google}&display=swap`;
  if (!existing) document.head.appendChild(link);
}

// ===== 오버레이 > 노래 신청 목록 탭 =====
const SONG_REQUEST_OVERLAY_URL = "https://ddarin-sechule.vercel.app/overlay/request/x0UXQ5j2URXmiitcuwPZ4RZQZQyPXgq";
const songRequestOverlayUrlInput = document.getElementById("songRequestOverlayUrlInput");
const songRequestOverlayEyeBtn = document.getElementById("songRequestOverlayEyeBtn");
const songRequestOverlayCopyBtn = document.getElementById("songRequestOverlayCopyBtn");
const songRequestOverlayFontSelect = document.getElementById("songRequestOverlayFontSelect");
const songRequestOverlayPreviewWrap = document.getElementById("songRequestOverlayPreviewWrap");
const songRequestOverlayDisplayModeWrap = document.getElementById("songRequestOverlayDisplayModeToggle");
const songRequestOverlayMaxCountInput = document.getElementById("songRequestOverlayMaxCountInput");
const SONG_REQUEST_OVERLAY_MAX_COUNT_DEFAULT = 3;

const songRequestOverlayTheme = setupOverlayThemeToggle("songRequestOverlayThemeToggle", () => updateOverlayUrlDisplay());

let songRequestOverlayDisplayMode = "static";
songRequestOverlayDisplayModeWrap.querySelectorAll(".song-request-theme-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    songRequestOverlayDisplayMode = btn.dataset.mode;
    songRequestOverlayDisplayModeWrap
      .querySelectorAll(".song-request-theme-btn")
      .forEach((b) => b.classList.toggle("active", b === btn));
    updateOverlayUrlDisplay();
  });
});

function currentOverlayUrl() {
  const params = new URLSearchParams();
  const theme = OVERLAY_THEMES[songRequestOverlayTheme.get()];
  if (songRequestOverlayTheme.get() !== "dark") {
    params.set("bg", theme.bg);
    params.set("color", theme.color);
  }
  if (songRequestOverlayFontSelect.value !== SONG_REQUEST_OVERLAY_FONT_DEFAULT) params.set("font", songRequestOverlayFontSelect.value);
  if (songRequestOverlayDisplayMode === "scroll") params.set("mode", "scroll");
  const maxCount = Number(songRequestOverlayMaxCountInput.value) || SONG_REQUEST_OVERLAY_MAX_COUNT_DEFAULT;
  if (maxCount !== SONG_REQUEST_OVERLAY_MAX_COUNT_DEFAULT) params.set("max", maxCount);
  const qs = params.toString();
  return qs ? `${SONG_REQUEST_OVERLAY_URL}?${qs}` : SONG_REQUEST_OVERLAY_URL;
}

const songRequestOverlayPreviewViewport = document.getElementById("songRequestOverlayPreviewViewport");
const songRequestOverlayPreviewTrack = document.getElementById("songRequestOverlayPreviewTrack");
const PREVIEW_SCROLL_DWELL_MS = 1200;
const PREVIEW_SCROLL_SPEED_PX_PER_SEC = 40;
const PREVIEW_STATIC_PAGE_DWELL_MS = 5000;
let previewScrollAnim = null;
let previewStaticPageIndex = 0;
let previewStaticPageTimer = null;

function updateOverlayUrlDisplay() {
  songRequestOverlayUrlInput.value = currentOverlayUrl();
  const fontKey = songRequestOverlayFontSelect.value;
  loadGoogleFontLink(fontKey, "songRequestOverlayFontLink");
  const theme = OVERLAY_THEMES[songRequestOverlayTheme.get()];
  songRequestOverlayPreviewWrap.style.setProperty("--overlay-bg", theme.bg);
  songRequestOverlayPreviewWrap.style.setProperty("--overlay-color", theme.color);
  songRequestOverlayPreviewWrap.style.setProperty("--overlay-font", SONG_REQUEST_OVERLAY_FONTS[fontKey].family);

  const maxCount = Number(songRequestOverlayMaxCountInput.value) || SONG_REQUEST_OVERLAY_MAX_COUNT_DEFAULT;
  const previewRows = songRequestOverlayPreviewTrack.querySelectorAll(".queue-row");

  if (previewScrollAnim) {
    previewScrollAnim.cancel();
    previewScrollAnim = null;
  }
  songRequestOverlayPreviewTrack.style.removeProperty("transform");

  if (songRequestOverlayDisplayMode !== "scroll") {
    if (previewStaticPageTimer) {
      clearInterval(previewStaticPageTimer);
      previewStaticPageTimer = null;
    }

    const pageCount = Math.max(Math.ceil(previewRows.length / maxCount), 1);
    if (previewStaticPageIndex >= pageCount) previewStaticPageIndex = 0;
    const pageStart = previewStaticPageIndex * maxCount;
    previewRows.forEach((row, i) => row.classList.toggle("hidden", i < pageStart || i >= pageStart + maxCount));
    songRequestOverlayPreviewViewport.style.removeProperty("height");

    if (pageCount > 1) {
      previewStaticPageTimer = setInterval(() => {
        previewStaticPageIndex += 1;
        updateOverlayUrlDisplay();
      }, PREVIEW_STATIC_PAGE_DWELL_MS);
    } else {
      previewStaticPageIndex = 0;
    }
    return;
  }

  if (previewStaticPageTimer) {
    clearInterval(previewStaticPageTimer);
    previewStaticPageTimer = null;
    previewStaticPageIndex = 0;
  }

  previewRows.forEach((row) => row.classList.remove("hidden"));
  requestAnimationFrame(() => {
    const rowRect = previewRows[0].getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(songRequestOverlayPreviewTrack).rowGap) || 0;
    const viewportHeight = rowRect.height * maxCount + gap * (maxCount - 1);
    songRequestOverlayPreviewViewport.style.height = `${viewportHeight}px`;

    const scrollDistance = songRequestOverlayPreviewTrack.scrollHeight - viewportHeight;
    if (scrollDistance <= 0) return;

    const scrollMs = Math.max((scrollDistance / PREVIEW_SCROLL_SPEED_PX_PER_SEC) * 1000, 1000);
    const totalMs = PREVIEW_SCROLL_DWELL_MS * 2 + scrollMs;
    const scrollStart = PREVIEW_SCROLL_DWELL_MS / totalMs;
    const scrollEnd = (PREVIEW_SCROLL_DWELL_MS + scrollMs) / totalMs;
    previewScrollAnim = songRequestOverlayPreviewTrack.animate(
      [
        { transform: "translateY(0)", offset: 0 },
        { transform: "translateY(0)", offset: scrollStart },
        { transform: `translateY(-${scrollDistance}px)`, offset: scrollEnd },
        { transform: `translateY(-${scrollDistance}px)`, offset: 1 },
      ],
      { duration: totalMs, iterations: Infinity, easing: "linear" }
    );
  });
}

updateOverlayUrlDisplay();
songRequestOverlayUrlInput.classList.add("song-request-overlay-url-input-hidden");

songRequestOverlayFontSelect.addEventListener("change", updateOverlayUrlDisplay);
songRequestOverlayMaxCountInput.addEventListener("input", updateOverlayUrlDisplay);
songRequestOverlayEyeBtn.addEventListener("click", () => {
  songRequestOverlayUrlInput.classList.toggle("song-request-overlay-url-input-hidden");
});
songRequestOverlayCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentOverlayUrl());
    songRequestOverlayCopyBtn.textContent = "복사됨";
    setTimeout(() => {
      songRequestOverlayCopyBtn.textContent = "복사";
    }, 1500);
  } catch {
    // 클립보드 권한이 없으면 무시 - 입력창에서 직접 선택해 복사할 수 있음
  }
});

// ===== 오버레이 > 현재 노래 정보 탭 =====
const SONG_REQUEST_OVERLAY_NOWPLAYING_URL =
  "https://ddarin-sechule.vercel.app/overlay/nowplaying/I71BDs9EYsiHN54o4xEllo4u7k6b9ACd";
const songRequestOverlayNowplayingUrlInput = document.getElementById("songRequestOverlayNowplayingUrlInput");
const songRequestOverlayNowplayingEyeBtn = document.getElementById("songRequestOverlayNowplayingEyeBtn");
const songRequestOverlayNowplayingCopyBtn = document.getElementById("songRequestOverlayNowplayingCopyBtn");
const songRequestOverlayNowplayingFontSelect = document.getElementById("songRequestOverlayNowplayingFontSelect");
const songRequestOverlayNowplayingFontSizeInput = document.getElementById("songRequestOverlayNowplayingFontSizeInput");
const songRequestOverlayNowplayingPreviewWrap = document.getElementById("songRequestOverlayNowplayingPreviewWrap");
const SONG_REQUEST_OVERLAY_NOWPLAYING_FONT_SIZE_DEFAULT = 1.4;

const songRequestOverlayNowplayingTheme = setupOverlayThemeToggle("songRequestOverlayNowplayingThemeToggle", () =>
  updateNowplayingOverlayUrlDisplay()
);

const songRequestOverlayNowplayingAlignWrap = document.getElementById("songRequestOverlayNowplayingAlignToggle");
let songRequestOverlayNowplayingAlign = "left";
songRequestOverlayNowplayingAlignWrap.querySelectorAll(".song-request-theme-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    songRequestOverlayNowplayingAlign = btn.dataset.align;
    songRequestOverlayNowplayingAlignWrap
      .querySelectorAll(".song-request-theme-btn")
      .forEach((b) => b.classList.toggle("active", b === btn));
    updateNowplayingOverlayUrlDisplay();
  });
});

function currentNowplayingOverlayUrl() {
  const params = new URLSearchParams();
  const theme = OVERLAY_THEMES[songRequestOverlayNowplayingTheme.get()];
  if (songRequestOverlayNowplayingTheme.get() !== "dark") {
    params.set("bg", theme.bg);
    params.set("color", theme.color);
  }
  if (songRequestOverlayNowplayingFontSelect.value !== SONG_REQUEST_OVERLAY_FONT_DEFAULT) params.set("font", songRequestOverlayNowplayingFontSelect.value);
  const fontSize = Number(songRequestOverlayNowplayingFontSizeInput.value) || SONG_REQUEST_OVERLAY_NOWPLAYING_FONT_SIZE_DEFAULT;
  if (fontSize !== SONG_REQUEST_OVERLAY_NOWPLAYING_FONT_SIZE_DEFAULT) params.set("size", fontSize);
  if (songRequestOverlayNowplayingAlign !== "left") params.set("align", songRequestOverlayNowplayingAlign);
  const qs = params.toString();
  return qs ? `${SONG_REQUEST_OVERLAY_NOWPLAYING_URL}?${qs}` : SONG_REQUEST_OVERLAY_NOWPLAYING_URL;
}

function updateNowplayingOverlayUrlDisplay() {
  songRequestOverlayNowplayingUrlInput.value = currentNowplayingOverlayUrl();
  const fontKey = songRequestOverlayNowplayingFontSelect.value;
  loadGoogleFontLink(fontKey, "songRequestOverlayNowplayingFontLink");
  const theme = OVERLAY_THEMES[songRequestOverlayNowplayingTheme.get()];
  const fontSize = Number(songRequestOverlayNowplayingFontSizeInput.value) || SONG_REQUEST_OVERLAY_NOWPLAYING_FONT_SIZE_DEFAULT;
  songRequestOverlayNowplayingPreviewWrap.style.setProperty("--overlay-bg", theme.bg);
  songRequestOverlayNowplayingPreviewWrap.style.setProperty("--overlay-color", theme.color);
  songRequestOverlayNowplayingPreviewWrap.style.setProperty("--overlay-font", SONG_REQUEST_OVERLAY_FONTS[fontKey].family);
  songRequestOverlayNowplayingPreviewWrap.style.setProperty("--overlay-font-size", `${fontSize}rem`);
  songRequestOverlayNowplayingPreviewWrap.style.setProperty("--overlay-align", songRequestOverlayNowplayingAlign);
}

updateNowplayingOverlayUrlDisplay();
songRequestOverlayNowplayingUrlInput.classList.add("song-request-overlay-url-input-hidden");

songRequestOverlayNowplayingFontSelect.addEventListener("change", updateNowplayingOverlayUrlDisplay);
songRequestOverlayNowplayingFontSizeInput.addEventListener("input", updateNowplayingOverlayUrlDisplay);
songRequestOverlayNowplayingEyeBtn.addEventListener("click", () => {
  songRequestOverlayNowplayingUrlInput.classList.toggle("song-request-overlay-url-input-hidden");
});
songRequestOverlayNowplayingCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentNowplayingOverlayUrl());
    songRequestOverlayNowplayingCopyBtn.textContent = "복사됨";
    setTimeout(() => {
      songRequestOverlayNowplayingCopyBtn.textContent = "복사";
    }, 1500);
  } catch {
    // 클립보드 권한이 없으면 무시 - 입력창에서 직접 선택해 복사할 수 있음
  }
});

let songRequestSortMode = "order";

document.querySelector(".song-request-sort-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".song-request-sort-tab");
  if (!btn) return;
  document.querySelectorAll(".song-request-sort-tab").forEach((el) => el.classList.toggle("active", el === btn));
  songRequestSortMode = btn.dataset.sort;
  renderSongRequestList();
});

document.querySelectorAll(".song-request-fullview-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector('.song-request-nav-item[data-panel="queue"]').click();
  });
});

// ===== SOOP 채팅에서 "!제목" / "!제목-가수"를 폴링해서 대기열에 자동 추가 =====
const SONG_REQUEST_POLL_MS = 5000;
let songRequestPollInterval = null;
let songRequestSinceTime = null;
const songRequestListEl = document.getElementById("songRequestList");
const songRequestListFullEl = document.getElementById("songRequestListFull");
let songRequestSenderByKey = {};
let songRequestStarByKey = {};

function formatSongRequestRelativeTime(ts) {
  if (!ts) return "";
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

const songRequestNowPlayingTitleEl = document.getElementById("songRequestNowPlayingTitle");
const songRequestNowPlayingArtistEl = document.getElementById("songRequestNowPlayingArtist");
const songRequestTodayBadgeEl = document.getElementById("songRequestTodayBadge");
const songRequestUndoBtn = document.getElementById("songRequestUndoBtn");
const songRequestSkipBtn = document.getElementById("songRequestSkipBtn");

const SONG_REQUEST_TODAY_COUNT_KEY = "songRequestTodayCount";
let songRequestLastRemoved = null;

function todayDateKeySeoul() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function getSongRequestTodayCount() {
  try {
    const saved = JSON.parse(localStorage.getItem(SONG_REQUEST_TODAY_COUNT_KEY) || "null");
    if (saved && saved.date === todayDateKeySeoul()) return saved.count;
  } catch {
    /* 저장된 값이 깨졌으면 0부터 다시 시작 */
  }
  return 0;
}

function setSongRequestTodayCount(count) {
  localStorage.setItem(SONG_REQUEST_TODAY_COUNT_KEY, JSON.stringify({ date: todayDateKeySeoul(), count }));
}

function renderSongRequestNowPlaying(queueSongs) {
  const song = queueSongs[0];

  if (!song) {
    songRequestNowPlayingTitleEl.textContent = "현재 노래가 없습니다";
    songRequestNowPlayingArtistEl.textContent = "대기열에서 곡을 선택해 주세요";
  } else {
    songRequestNowPlayingTitleEl.textContent = song.title;
    songRequestNowPlayingArtistEl.textContent = song.artist;
  }

  const completed = getSongRequestTodayCount();
  songRequestTodayBadgeEl.textContent = `오늘 ${completed}/${completed + queueSongs.length}곡`;

  songRequestSkipBtn.disabled = !song;
  songRequestUndoBtn.disabled = !songRequestLastRemoved;
}

songRequestSkipBtn.addEventListener("click", () => {
  const key = singQueueOrder[0];
  if (!key) return;
  songRequestLastRemoved = {
    key,
    wasCompleted: true,
    sender: songRequestSenderByKey[key] || null,
    time: songRequestTimeByKey[key] || null,
  };
  setSongRequestTodayCount(getSongRequestTodayCount() + 1);
  removeFromSingQueue(key);
});

songRequestUndoBtn.addEventListener("click", () => {
  if (!songRequestLastRemoved) return;
  const { key, wasCompleted, sender, time } = songRequestLastRemoved;
  if (!singQueueOrder.includes(key)) {
    singQueueOrder.unshift(key);
    if (sender) songRequestSenderByKey[key] = sender;
    if (time) songRequestTimeByKey[key] = time;
  }
  if (wasCompleted) setSongRequestTodayCount(Math.max(0, getSongRequestTodayCount() - 1));
  songRequestLastRemoved = null;
  saveSingQueue();
  renderSongRequestList();
});

function renderSongRequestListInto(container, displaySongs) {
  container.innerHTML = "";

  if (!displaySongs.length) {
    const empty = document.createElement("p");
    empty.className = "favorites-empty";
    empty.textContent = "아직 신청된 곡이 없습니다.";
    container.appendChild(empty);
    return;
  }

  displaySongs.forEach((song) => {
    const key = albumArtCacheKey(song);
    const sender = songRequestSenderByKey[key];

    const item = document.createElement("div");
    item.className = "song-request-item";
    item.draggable = songRequestSortMode !== "star";

    const textWrap = document.createElement("div");
    textWrap.className = "song-request-item-text";

    const titleEl = document.createElement("div");
    titleEl.className = "favorite-item-title";
    titleEl.textContent = song.title;

    const artistEl = document.createElement("div");
    artistEl.className = "favorite-item-artist";
    artistEl.textContent = sender ? `${song.artist} · ${sender}` : song.artist;

    textWrap.append(titleEl, artistEl);

    const timeEl = document.createElement("span");
    timeEl.className = "song-request-item-time";
    timeEl.textContent = formatSongRequestRelativeTime(songRequestTimeByKey[key]);

    item.append(textWrap, timeEl);

    item.addEventListener("dragstart", () => {
      draggedQueueKey = key;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      draggedQueueKey = null;
      item.classList.remove("dragging");
    });
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!draggedQueueKey || draggedQueueKey === key) return;
      const fromIdx = singQueueOrder.indexOf(draggedQueueKey);
      const toIdx = singQueueOrder.indexOf(key);
      if (fromIdx === -1 || toIdx === -1) return;
      singQueueOrder.splice(fromIdx, 1);
      singQueueOrder.splice(toIdx, 0, draggedQueueKey);
      saveSingQueue();
      renderSongRequestList();
    });

    container.appendChild(item);
  });
}

function renderSongRequestList() {
  const queueSongs = singQueueOrder.map((key) => songByKey[key]).filter(Boolean);
  renderSongRequestNowPlaying(queueSongs);

  const displaySongs =
    songRequestSortMode === "star"
      ? [...queueSongs].sort(
          (a, b) =>
            (songRequestStarByKey[albumArtCacheKey(b)] || 0) - (songRequestStarByKey[albumArtCacheKey(a)] || 0)
        )
      : queueSongs;

  renderSongRequestListInto(songRequestListEl, displaySongs);
  if (songRequestListFullEl) renderSongRequestListInto(songRequestListFullEl, displaySongs);
}

const songRequestListClearBtn = document.getElementById("songRequestListClearBtn");
songRequestListClearBtn.addEventListener("click", clearSingQueue);

const songRequestSuccessLogClearBtn = document.getElementById("songRequestSuccessLogClearBtn");
songRequestSuccessLogClearBtn.addEventListener("click", () => {
  songRequestSuccessLog = [];
  renderSongRequestSuccessLog();
});

const songRequestMinStarInput = document.getElementById("songRequestMinStarInput");
const songRequestStarApplyBtn = document.getElementById("songRequestStarApplyBtn");
let songRequestMinStars = Number(songRequestMinStarInput.value) || 0;

songRequestStarApplyBtn.addEventListener("click", () => {
  songRequestMinStars = Number(songRequestMinStarInput.value) || 0;
  if (getSongRequestActiveSource() === "star") {
    setSongRequestChatStatus(`별풍선 ${songRequestMinStars}개 이상 감지 중`, "live");
  }
});

function parseSongRequestMessage(text) {
  const raw = String(text || "").trim();
  if (!raw.startsWith("!")) return null;
  const body = raw.slice(1).trim();
  if (!body) return null;
  const m = /^(.+?)\s*-\s*(.+)$/.exec(body);
  if (m) return { title: m[1].trim(), artist: m[2].trim() };
  return { title: body, artist: null };
}

function matchSongForRequest(title, artist) {
  const titleLower = title.toLowerCase();
  const matches = (allSongs || []).filter((s) => s.title.toLowerCase() === titleLower);
  if (!matches.length) return { song: null, reason: "notfound" };
  if (matches.length === 1) return { song: matches[0], reason: null };
  if (!artist) return { song: null, reason: "ambiguous" };
  const artistLower = artist.toLowerCase();
  const song = matches.find((s) => s.artist.toLowerCase() === artistLower) || null;
  return song ? { song, reason: null } : { song: null, reason: "ambiguous" };
}

function findSongForRequest(title, artist) {
  return matchSongForRequest(title, artist).song;
}

const songRequestChatStatus = document.getElementById("songRequestChatStatus");

function setSongRequestChatStatus(text, tone) {
  if (!songRequestChatStatus) return;
  songRequestChatStatus.innerHTML = `<span class="song-request-chat-status-dot"></span>${text}`;
  songRequestChatStatus.classList.toggle("is-live", tone === "live");
  songRequestChatStatus.classList.toggle("is-error", tone === "error");
}

const songRequestChatLogEl = document.getElementById("songRequestChatLog");
const songRequestChatLogClearBtn = document.getElementById("songRequestChatLogClearBtn");
songRequestChatLogClearBtn.addEventListener("click", () => {
  songRequestChatLogEl.innerHTML = "";
});

function logSongRequestNote(text) {
  if (!songRequestChatLogEl) return;
  const line = document.createElement("div");
  line.className = "song-request-chat-log-line";
  line.textContent = text;
  songRequestChatLogEl.appendChild(line);
  songRequestChatLogEl.scrollTop = songRequestChatLogEl.scrollHeight;
}

function logSongRequestFailure(item, parsed, reason) {
  const sender = item.sender ? `${item.sender}: ` : "";
  const reasonText =
    reason === "ambiguous" ? "노래제목이 중복입니다. 가수 이름을 적어주세요." : "노래책 목록에 없는 곡입니다.";
  logSongRequestNote(`${sender}"${parsed.title}" - ${reasonText}`);
}

const songRequestSuccessLogEl = document.getElementById("songRequestSuccessLog");
const songRequestSuccessLogFullEl = document.getElementById("songRequestSuccessLogFull");
let songRequestSuccessLog = [];

function renderSongRequestSuccessLogInto(container) {
  if (!container) return;
  container.innerHTML = "";
  if (!songRequestSuccessLog.length) {
    const empty = document.createElement("p");
    empty.className = "song-request-empty-text";
    empty.textContent = "아직 신청된 곡이 없습니다.";
    container.appendChild(empty);
    return;
  }
  songRequestSuccessLog.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "song-request-success-row";
    const senderEl = document.createElement("span");
    senderEl.className = "song-request-success-sender";
    senderEl.textContent = entry.sender || "익명";
    const messageEl = document.createElement("span");
    messageEl.className = "song-request-success-message";
    messageEl.textContent = entry.message;
    row.append(senderEl, messageEl);
    if (entry.starCount) {
      const starEl = document.createElement("span");
      starEl.className = "song-request-star-count-label";
      starEl.textContent = `별풍선 ${entry.starCount}개`;
      row.appendChild(starEl);
    }
    if (entry.failed) {
      const failEl = document.createElement("span");
      failEl.className = "song-request-fail-label";
      failEl.textContent = "실패";
      row.appendChild(failEl);
    }
    container.appendChild(row);
  });
}

function renderSongRequestSuccessLog() {
  renderSongRequestSuccessLogInto(songRequestSuccessLogEl);
  renderSongRequestSuccessLogInto(songRequestSuccessLogFullEl);
}

function logSongRequestSuccess(sender, message, failed, starCount) {
  songRequestSuccessLog.push({ sender: sender || null, message, failed: !!failed, starCount: starCount || null });
  renderSongRequestSuccessLog();
}

let songRequestPendingStarSenders = {};

const UNMATCHED_SONG_GENRE = "미분류";

// 노래책에 없는 곡이 "!제목-가수" 형식으로 신청되면, 노래책에 임시 항목(override)으로
// 추가해서 대기열/오버레이에서도 보이게 한다. 나중에 "곡 편집/삭제"로 정리 가능.
function addUnmatchedSongOverride(title, artist) {
  const newSong = { genre: UNMATCHED_SONG_GENRE, artist, title, note: "", mr: "" };
  const key = albumArtCacheKey(newSong);
  if (!songByKey[key]) {
    allSongs = allSongs || [];
    allSongs.push(newSong);
    songByKey[key] = newSong;
    localSongOverrides[key] = newSong;
    saveSongbookLocalData();
    songbookGenresList = [...new Set(allSongs.map((s) => s.genre))];
    renderGenreTabs2(songbookGenresList);
  }
  return songByKey[key];
}

function tryQueueChatItem(item, starCount) {
  const parsed = parseSongRequestMessage(item.message);
  if (!parsed) return false;
  const { song, reason } = matchSongForRequest(parsed.title, parsed.artist);

  if (!song && reason === "notfound" && parsed.artist) {
    const added = addUnmatchedSongOverride(parsed.title, parsed.artist);
    const key = albumArtCacheKey(added);
    songRequestSenderByKey[key] = item.sender || null;
    if (starCount) songRequestStarByKey[key] = starCount;
    addToSingQueue([key]);
    logSongRequestNote(`${item.sender ? item.sender + ": " : ""}"${parsed.title} - ${parsed.artist}" - 노래책에 없는 곡이지만 대기열에 추가했습니다.`);
    logSongRequestSuccess(item.sender, item.message, false, starCount);
    return true;
  }

  if (!song) {
    logSongRequestFailure(item, parsed, reason);
    logSongRequestSuccess(item.sender, item.message, true);
    return false;
  }
  songRequestSenderByKey[albumArtCacheKey(song)] = item.sender || null;
  if (starCount) songRequestStarByKey[albumArtCacheKey(song)] = starCount;
  addToSingQueue([albumArtCacheKey(song)]);
  logSongRequestSuccess(item.sender, item.message, false, starCount);
  return true;
}

async function pollSongRequests() {
  try {
    const res = await fetch("https://ddarin-sechule.vercel.app/api/soop-chat?type=songRequest,star");
    if (!res.ok) return;
    const data = await res.json();
    const items = (data.items || []).filter((it) => !songRequestSinceTime || it.time > songRequestSinceTime);

    const source = getSongRequestActiveSource();
    if (source === "chat") {
      items.forEach((item) => {
        if (item.type !== "songRequest") return;
        tryQueueChatItem(item);
      });
    } else if (source === "star") {
      items.forEach((item) => {
        if (item.type === "star") {
          const count = Number(item.message) || 0;
          const sender = item.sender;
          if (!sender) return;
          if (count < songRequestMinStars) {
            logSongRequestNote(`${sender}: 별풍선 ${count}개 - 최소 별풍선 개수(${songRequestMinStars}개) 미달`);
            return;
          }
          songRequestPendingStarSenders[sender] = songRequestPendingStarSenders[sender] || [];
          songRequestPendingStarSenders[sender].push(count);
          return;
        }
        if (item.type !== "songRequest") return;
        const sender = item.sender;
        const pending = songRequestPendingStarSenders[sender];
        if (!sender || !pending || !pending.length) {
          if (sender) logSongRequestNote(`${sender}: "${item.message}" - 확인된 별풍선 후원이 없어요.`);
          return;
        }
        if (!tryQueueChatItem(item, pending[0])) return;
        pending.shift();
        if (!pending.length) delete songRequestPendingStarSenders[sender];
      });
    }

    if (items.length) {
      songRequestSinceTime = items.reduce((max, it) => (it.time > max ? it.time : max), songRequestSinceTime || "");
    }
  } catch (err) {
    console.error("[신청곡] 폴링 오류:", err);
  }
}

function startSongRequestCollection() {
  songRequestSinceTime = new Date().toISOString();
  songRequestSenderByKey = {};
  songRequestStarByKey = {};
  songRequestPendingStarSenders = {};
  if (songRequestChatLogEl) songRequestChatLogEl.innerHTML = "";
  renderSongRequestList();
  stopSongRequestCollection();
  const isStar = getSongRequestActiveSource() === "star";
  setSongRequestChatStatus(isStar ? `별풍선 ${songRequestMinStars}개 이상 감지 중` : "수집 중", "live");
  songRequestPollInterval = setInterval(pollSongRequests, SONG_REQUEST_POLL_MS);
}

function stopSongRequestCollection() {
  if (songRequestPollInterval) {
    clearInterval(songRequestPollInterval);
    songRequestPollInterval = null;
  }
}

const songRequestAcceptToggle = document.getElementById("songRequestAcceptToggle");
const songRequestOffNotice = document.getElementById("songRequestOffNotice");

function getSongRequestActiveSource() {
  if (songRequestAcceptToggle.getAttribute("aria-pressed") !== "true") return null;
  const activeSourceBtn = document.querySelector(".song-request-source-btn.active");
  return activeSourceBtn ? activeSourceBtn.dataset.source : null;
}

songRequestAcceptToggle.addEventListener("click", () => {
  const isOn = songRequestAcceptToggle.getAttribute("aria-pressed") === "true";
  songRequestAcceptToggle.setAttribute("aria-pressed", String(!isOn));
  songRequestOffNotice.classList.toggle("song-request-notice-collapsed", !isOn);

  if (getSongRequestActiveSource()) {
    startSongRequestCollection();
  } else {
    stopSongRequestCollection();
    setSongRequestChatStatus("신청 받기 꺼짐");
  }
});

const songRequestSourceNoticeText = document.getElementById("songRequestSourceNoticeText");
const SONG_REQUEST_SOURCE_NOTICES = {
  chat: "채팅창에 <b>'!제목'</b> 또는 <b>'!제목-가수'</b> 형식으로 메시지를 입력하면 대기열에 표시돼요.",
  star: "최소 별풍선 개수 이상 후원메세지로 <b>'!제목'</b> 또는 <b>'!제목-가수'</b> 형식으로 메시지를 입력하면 대기열에 표시돼요.",
};

const songRequestStarFilterEl = document.querySelector(".song-request-star-filter");

function updateSongRequestStarFilterVisibility() {
  const activeBtn = document.querySelector(".song-request-source-btn.active");
  const isStar = activeBtn && activeBtn.dataset.source === "star";
  songRequestStarFilterEl.classList.toggle("hidden", !isStar);
}
updateSongRequestStarFilterVisibility();

document.querySelectorAll(".song-request-source-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".song-request-source-btn").forEach((el) => el.classList.toggle("active", el === btn));
    songRequestSourceNoticeText.innerHTML = SONG_REQUEST_SOURCE_NOTICES[btn.dataset.source];
    updateSongRequestStarFilterVisibility();

    if (getSongRequestActiveSource()) startSongRequestCollection();
  });
});


// ===== 노래책 > 가수 초성 목록 =====
const CHOSEONG_LIST = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const CHOSEONG_GROUP_MAP = {
  "ㄱ": "ㄱ", "ㄲ": "ㄱ",
  "ㄴ": "ㄴ",
  "ㄷ": "ㄷ", "ㄸ": "ㄷ",
  "ㄹ": "ㄹ",
  "ㅁ": "ㅁ",
  "ㅂ": "ㅂ", "ㅃ": "ㅂ",
  "ㅅ": "ㅅ", "ㅆ": "ㅅ",
  "ㅇ": "ㅇ",
  "ㅈ": "ㅈ", "ㅉ": "ㅈ",
  "ㅊ": "ㅊ",
  "ㅋ": "ㅋ",
  "ㅌ": "ㅌ",
  "ㅍ": "ㅍ",
  "ㅎ": "ㅎ",
};
const CHOSEONG_GROUPS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const ALPHABET_GROUPS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

function getArtistInitialGroup(artist) {
  const ch = (artist || "").trim()[0];
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const choseong = CHOSEONG_LIST[Math.floor((code - 0xac00) / 588)];
    return CHOSEONG_GROUP_MAP[choseong] || null;
  }
  const upper = ch.toUpperCase();
  if (upper >= "A" && upper <= "Z") return upper;
  return null;
}

const artist2List = document.getElementById("artist2List");
let songbook2Genre = "전체";
let songbook2Artist = "전체";

function renderArtistList2() {
  const inGenre = (allSongs || []).filter(
    (song) => songbook2Genre === "전체" || song.genre === songbook2Genre
  );
  const presentGroups = new Set(inGenre.map((s) => getArtistInitialGroup(s.artist)).filter(Boolean));

  if (songbook2Artist !== "전체" && !presentGroups.has(songbook2Artist)) {
    songbook2Artist = "전체";
  }

  artist2List.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "artist-list-btn" + (songbook2Artist === "전체" ? " active" : "");
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => {
    songbook2Artist = "전체";
    renderArtistList2();
    renderSongGrid2();
  });
  artist2List.appendChild(allBtn);

  [...CHOSEONG_GROUPS, ...ALPHABET_GROUPS].forEach((group) => {
    if (!presentGroups.has(group)) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "artist-list-btn" + (songbook2Artist === group ? " active" : "");
    btn.textContent = group;
    btn.addEventListener("click", () => {
      songbook2Artist = group;
      renderArtistList2();
      renderSongGrid2();
    });
    artist2List.appendChild(btn);
  });
}

// ===== 노래책 > 장르 탭 =====
const genre2Tabs = document.getElementById("genre2Tabs");
const song2GenreFilterToggle = document.getElementById("song2GenreFilterToggle");
const song2GenreFilterMenu = document.getElementById("song2GenreFilterMenu");

function renderGenreTabs2(genres) {
  const allGenres = ["전체", ...genres];

  [genre2Tabs, song2GenreFilterMenu].forEach((container) => {
    container.innerHTML = "";
    allGenres.forEach((genre) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "genre-tab" + (songbook2Genre === genre ? " active" : "");
      btn.dataset.genre = genre;
      btn.textContent = genre;
      container.appendChild(btn);
    });
  });
}

function selectSongbook2Genre(genre) {
  songbook2Genre = genre;
  renderGenreTabs2(songbookGenresList);
  song2GenreFilterMenu.classList.add("hidden");
  renderArtistList2();
  renderSongGrid2();
}

genre2Tabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".genre-tab");
  if (!btn) return;
  selectSongbook2Genre(btn.dataset.genre);
});

song2GenreFilterToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  song2GenreFilterMenu.classList.toggle("hidden");
});
song2GenreFilterMenu.addEventListener("click", (e) => {
  const btn = e.target.closest(".genre-tab");
  if (!btn) return;
  selectSongbook2Genre(btn.dataset.genre);
});
document.addEventListener("click", (e) => {
  if (!song2GenreFilterMenu.classList.contains("hidden") && !song2GenreFilterMenu.contains(e.target) && !song2GenreFilterToggle.contains(e.target)) {
    song2GenreFilterMenu.classList.add("hidden");
  }
});

// ===== 노래책 > 표 =====
const song2SearchInput = document.getElementById("song2SearchInput");
const song2Table = document.getElementById("song2Table");
const song2Grid = document.getElementById("song2Grid");
const songbookTotalCountEl = document.getElementById("songbookTotalCount");
let songSortMode2 = "artist";
let songSortDir2 = "asc";
let selectedSongKeys = new Set();

function getFilteredSongs2() {
  const query = song2SearchInput.value.trim().toLowerCase();

  const filtered = (allSongs || []).filter((song) => {
    if (songbook2Genre !== "전체" && song.genre !== songbook2Genre) return false;
    if (songbook2Artist !== "전체" && getArtistInitialGroup(song.artist) !== songbook2Artist) return false;
    if (query && !song.title.toLowerCase().includes(query) && !song.artist.toLowerCase().includes(query)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const field = songSortMode2 === "title" ? "title" : "artist";
    const cmp = a[field].localeCompare(b[field], "ko");
    return songSortDir2 === "asc" ? cmp : -cmp;
  });

  return filtered;
}

function toggleSongSelection(key, checked) {
  if (checked) selectedSongKeys.add(key);
  else selectedSongKeys.delete(key);
}

function buildSongRow2(song, num) {
  const key = albumArtCacheKey(song);
  const tr = document.createElement("tr");

  const checkTd = document.createElement("td");
  checkTd.className = "song2-col-check";
  const checkboxEl = document.createElement("input");
  checkboxEl.type = "checkbox";
  checkboxEl.checked = selectedSongKeys.has(key);
  checkboxEl.addEventListener("change", () => toggleSongSelection(key, checkboxEl.checked));
  checkTd.appendChild(checkboxEl);

  const numTd = document.createElement("td");
  numTd.className = "song2-col-num";
  numTd.textContent = num;

  const titleTd = document.createElement("td");
  titleTd.className = "song2-col-title";
  titleTd.textContent = song.title;

  const artistTd = document.createElement("td");
  artistTd.className = "song2-col-artist";
  artistTd.textContent = song.artist;

  const genreTd = document.createElement("td");
  genreTd.className = "song2-col-genre";
  const genreBadge = document.createElement("span");
  genreBadge.className = "song-card-genre";
  genreBadge.textContent = song.genre;
  genreTd.appendChild(genreBadge);

  tr.append(checkTd, numTd, titleTd, artistTd, genreTd);
  return tr;
}

function renderSongGrid2() {
  const filtered = getFilteredSongs2();

  songbookTotalCountEl.textContent = `총 ${(allSongs || []).length}곡`;

  song2Table.querySelectorAll(".song2-sortable").forEach((th) => {
    const isActive = th.dataset.sort === songSortMode2;
    th.classList.toggle("active", isActive);
    th.classList.toggle("desc", isActive && songSortDir2 === "desc");
  });

  song2Grid.innerHTML = "";

  if (!filtered.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "song-empty";
    td.colSpan = 6;
    td.textContent = "곡이 없습니다.";
    tr.appendChild(td);
    song2Grid.appendChild(tr);
    return;
  }

  filtered.forEach((song, i) => song2Grid.appendChild(buildSongRow2(song, i + 1)));
}

song2SearchInput.addEventListener("input", renderSongGrid2);

song2Table.querySelector("thead").addEventListener("click", (e) => {
  const th = e.target.closest(".song2-sortable");
  if (!th) return;
  if (songSortMode2 === th.dataset.sort) {
    songSortDir2 = songSortDir2 === "asc" ? "desc" : "asc";
  } else {
    songSortMode2 = th.dataset.sort;
    songSortDir2 = "asc";
  }
  renderSongGrid2();
});

// ===== 노래책 룰렛 =====
const songRouletteBtn = document.getElementById("songRouletteBtn");
const songRouletteModalBackdrop = document.getElementById("songRouletteModalBackdrop");
const songRouletteCloseBtn = document.getElementById("songRouletteCloseBtn");
const songRouletteStatus = document.getElementById("songRouletteStatus");
const songRouletteStatusText = document.getElementById("songRouletteStatusText");
const songRouletteFilterToggle = document.getElementById("songRouletteFilterToggle");
const songRouletteFilterValue = document.getElementById("songRouletteFilterValue");
const songRouletteFilterMenu = document.getElementById("songRouletteFilterMenu");
const songRouletteSpinBtn = document.getElementById("songRouletteSpinBtn");
const songRouletteQueueAddBtn = document.getElementById("songRouletteQueueAddBtn");
let songRouletteGenre = "전체";
let songRouletteResultSong = null;

function closeSongRouletteModal() {
  songRouletteModalBackdrop.classList.add("hidden");
  songRouletteFilterMenu.classList.add("hidden");
}

songRouletteBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  songRouletteGenre = "전체";
  songRouletteFilterValue.textContent = songRouletteGenre;
  songRouletteFilterMenu.innerHTML = "";
  ["전체", ...songbookGenresList].forEach((genre) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "genre-tab" + (genre === songRouletteGenre ? " active" : "");
    btn.dataset.genre = genre;
    btn.textContent = genre;
    songRouletteFilterMenu.appendChild(btn);
  });
  songRouletteStatus.className = "song-roulette-status";
  songRouletteStatusText.textContent = "대기 중";
  songRouletteSpinBtn.disabled = false;
  songRouletteResultSong = null;
  songRouletteModalBackdrop.classList.remove("hidden");
});
songRouletteCloseBtn.addEventListener("click", closeSongRouletteModal);

songRouletteFilterToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  songRouletteFilterMenu.classList.toggle("hidden");
});
songRouletteFilterMenu.addEventListener("click", (e) => {
  const btn = e.target.closest(".genre-tab");
  if (!btn) return;
  songRouletteGenre = btn.dataset.genre;
  songRouletteFilterValue.textContent = songRouletteGenre;
  songRouletteFilterMenu.querySelectorAll(".genre-tab").forEach((el) => el.classList.toggle("active", el === btn));
  songRouletteFilterMenu.classList.add("hidden");
});
document.addEventListener("click", (e) => {
  if (!songRouletteModalBackdrop.classList.contains("hidden") && !songRouletteModalBackdrop.contains(e.target) && e.target !== songRouletteBtn) {
    closeSongRouletteModal();
  } else if (!songRouletteFilterMenu.classList.contains("hidden") && !songRouletteFilterMenu.contains(e.target) && !songRouletteFilterToggle.contains(e.target)) {
    songRouletteFilterMenu.classList.add("hidden");
  }
});

songRouletteSpinBtn.addEventListener("click", () => {
  const pool = (allSongs || []).filter((s) => songRouletteGenre === "전체" || s.genre === songRouletteGenre);
  if (!pool.length) {
    songRouletteStatus.className = "song-roulette-status";
    songRouletteStatusText.textContent = "곡이 없습니다";
    return;
  }

  songRouletteResultSong = null;
  songRouletteSpinBtn.disabled = true;
  songRouletteStatus.className = "song-roulette-status spinning";

  const spinInterval = setInterval(() => {
    const s = pool[Math.floor(Math.random() * pool.length)];
    songRouletteStatusText.textContent = `${s.title} - ${s.artist}`;
  }, 80);

  setTimeout(() => {
    clearInterval(spinInterval);
    const song = pool[Math.floor(Math.random() * pool.length)];
    songRouletteStatus.className = "song-roulette-status result";
    songRouletteStatusText.textContent = `${song.title} - ${song.artist}`;
    songRouletteSpinBtn.disabled = false;
    songRouletteResultSong = song;
  }, 3000);
});

songRouletteQueueAddBtn.addEventListener("click", () => {
  if (!songRouletteResultSong) return;
  addToSingQueue([albumArtCacheKey(songRouletteResultSong)]);
});

// ===== 노래책 > 곡 추가/편집 =====
function renderPlainOptionLabel(opt) {
  const span = document.createElement("span");
  span.textContent = opt.label;
  return span;
}

function setupCustomSelect(root, { options, initialValue, placeholderLabel, renderLabel }) {
  const trigger = root.querySelector(".song-select-trigger");
  const triggerLabel = trigger.querySelector(".song-select-trigger-label");
  const panel = root.querySelector(".song-select-panel");

  function setValue(value) {
    root.dataset.value = value;
    const opt = options.find((o) => String(o.value) === String(value));
    triggerLabel.innerHTML = "";
    triggerLabel.classList.toggle("placeholder", !opt);
    if (opt) {
      triggerLabel.append(renderLabel(opt));
    } else {
      triggerLabel.textContent = placeholderLabel || "";
    }
  }

  function closePanel() {
    panel.classList.add("hidden");
  }

  function openPanel() {
    panel.innerHTML = "";
    options.forEach((opt) => {
      const item = document.createElement("div");
      item.className = "song-select-option";
      item.append(renderLabel(opt));
      item.addEventListener("click", () => {
        setValue(opt.value);
        closePanel();
      });
      panel.appendChild(item);
    });
    document.querySelectorAll(".song-select-panel").forEach((p) => p.classList.add("hidden"));
    panel.classList.remove("hidden");
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (panel.classList.contains("hidden")) openPanel();
    else closePanel();
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) closePanel();
  });

  setValue(initialValue);

  return {
    getValue: () => root.dataset.value,
    setValue,
    setOptions: (newOptions) => {
      options = newOptions;
    },
  };
}

const songAddGenreSelect = setupCustomSelect(document.getElementById("songAddGenreSelect"), {
  options: [],
  initialValue: "",
  placeholderLabel: "장르 선택",
  renderLabel: renderPlainOptionLabel,
});

const songSelectAllBtn = document.getElementById("songSelectAllBtn");
const songDeleteSelectedBtn = document.getElementById("songDeleteSelectedBtn");
const songQueueAddBtn = document.getElementById("songQueueAddBtn");
const songAddBtn = document.getElementById("songAddBtn");
const songAddModalBackdrop = document.getElementById("songAddModalBackdrop");
const songAddModalTitle = document.getElementById("songAddModalTitle");
const closeSongAddModalBtn = document.getElementById("closeSongAddModalBtn");
const songAddForm = document.getElementById("songAddForm");
const songAddTitleInput = document.getElementById("songAddTitleInput");
const songAddArtistInput = document.getElementById("songAddArtistInput");
const songAddNoteInput = document.getElementById("songAddNoteInput");
const songAddMrInput = document.getElementById("songAddMrInput");
const songAddSaveBtn = document.getElementById("songAddSaveBtn");
const cancelSongAddBtn = document.getElementById("cancelSongAddBtn");

function closeSongAddModal() {
  songAddModalBackdrop.classList.add("hidden");
}

let songEditTarget = null;

function openSongAddModal() {
  const selectedKeys = [...selectedSongKeys];
  songEditTarget = selectedKeys.length === 1 ? songByKey[selectedKeys[0]] : null;

  songAddModalTitle.textContent = songEditTarget ? "곡 편집" : "곡 추가";
  songAddSaveBtn.textContent = songEditTarget ? "수정" : "저장";

  songAddGenreSelect.setOptions(songbookGenresList.map((g) => ({ value: g, label: g })));

  if (songEditTarget) {
    songAddTitleInput.value = songEditTarget.title;
    songAddArtistInput.value = songEditTarget.artist;
    songAddNoteInput.value = songEditTarget.note || "";
    songAddMrInput.value = songEditTarget.mr || "";
    songAddGenreSelect.setValue(songEditTarget.genre);
  } else {
    songAddForm.reset();
    songAddGenreSelect.setValue("");
  }

  songAddModalBackdrop.classList.remove("hidden");
  songAddTitleInput.focus();
}

songAddBtn.addEventListener("click", openSongAddModal);
closeSongAddModalBtn.addEventListener("click", closeSongAddModal);
cancelSongAddBtn.addEventListener("click", closeSongAddModal);
songAddModalBackdrop.addEventListener("click", (e) => {
  if (e.target === songAddModalBackdrop) closeSongAddModal();
});

songAddForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = songAddTitleInput.value.trim();
  const artist = songAddArtistInput.value.trim();
  const genre = songAddGenreSelect.getValue();
  if (!title || !artist || !genre) return;

  const note = songAddNoteInput.value.trim();
  const mr = songAddMrInput.value.trim();

  if (songEditTarget) {
    const oldKey = albumArtCacheKey(songEditTarget);
    songEditTarget.genre = genre;
    songEditTarget.artist = artist;
    songEditTarget.title = title;
    songEditTarget.note = note;
    songEditTarget.mr = mr;
    const newKey = albumArtCacheKey(songEditTarget);

    if (newKey !== oldKey) {
      delete songByKey[oldKey];
      delete localSongOverrides[oldKey];
      localSongDeletions.add(oldKey);

      const queueIdx = singQueueOrder.indexOf(oldKey);
      if (queueIdx !== -1) singQueueOrder[queueIdx] = newKey;
      saveSingQueue();
    }
    songByKey[newKey] = songEditTarget;
    localSongOverrides[newKey] = songEditTarget;
    saveSongbookLocalData();
    selectedSongKeys.clear();
  } else {
    const song = { genre, artist, title, note, mr };
    allSongs = allSongs || [];
    allSongs.push(song);
    const key = albumArtCacheKey(song);
    songByKey[key] = song;
    localSongOverrides[key] = song;
    saveSongbookLocalData();
  }

  songbookGenresList = [...new Set(allSongs.map((s) => s.genre))];
  renderGenreTabs2(songbookGenresList);
  renderArtistList2();
  renderSongGrid2();

  closeSongAddModal();
});

songSelectAllBtn.addEventListener("click", () => {
  const filteredKeys = getFilteredSongs2().map((song) => albumArtCacheKey(song));
  const allSelected = filteredKeys.length > 0 && filteredKeys.every((key) => selectedSongKeys.has(key));
  if (allSelected) {
    filteredKeys.forEach((key) => selectedSongKeys.delete(key));
  } else {
    filteredKeys.forEach((key) => selectedSongKeys.add(key));
  }
  renderSongGrid2();
});

songDeleteSelectedBtn.addEventListener("click", () => {
  if (!selectedSongKeys.size) return;
  if (!confirm(`선택한 ${selectedSongKeys.size}곡을 삭제할까요?`)) return;

  allSongs = (allSongs || []).filter((song) => !selectedSongKeys.has(albumArtCacheKey(song)));
  selectedSongKeys.forEach((key) => {
    delete songByKey[key];
    delete localSongOverrides[key];
    localSongDeletions.add(key);
  });
  saveSongbookLocalData();
  selectedSongKeys.clear();

  songbookGenresList = [...new Set(allSongs.map((s) => s.genre))];
  renderGenreTabs2(songbookGenresList);
  renderArtistList2();
  renderSongGrid2();
});

songQueueAddBtn.addEventListener("click", () => {
  if (!selectedSongKeys.size) return;
  addToSingQueue([...selectedSongKeys]);
});

// ===== 기능 둘러보기 (코치마크 투어) =====
const TOUR_STEPS = [
  { selector: '.song-request-nav-item[data-panel="request"]', title: "노래 신청", desc: "채팅이나 별풍선으로 들어온 신청곡을 확인하고 관리해요." },
  { selector: '.song-request-nav-item[data-panel="queue"]', title: "대기열", desc: "지금 대기 중인 신청곡 전체 목록과 채팅 로그를 한눈에 볼 수 있어요." },
  { selector: '.song-request-nav-item[data-panel="songbook"]', title: "노래책", desc: "방송에서 부를 수 있는 전체 노래 목록을 관리해요." },
  { selector: '.song-request-nav-item[data-panel="overlay-nowplaying"]', title: "현재 노래 정보", desc: "지금 부르고 있는 곡 제목/가수만 보여주는 OBS 오버레이를 설정해요." },
  { selector: '.song-request-nav-item[data-panel="overlay-queue"]', title: "노래 신청 목록", desc: "대기 중인 신청곡 목록을 보여주는 OBS 오버레이를 설정해요." },
  { selector: "#songRequestAcceptToggle", title: "신청 받기", desc: "이 토글을 켜야 채팅/별풍선으로 들어오는 신청을 실제로 받기 시작해요." },
  { selector: "#songRequestSourceChatBtn", title: "채팅 / 별풍선", desc: "신청을 채팅 메시지로 받을지, 별풍선 후원 메시지로만 받을지 선택해요." },
  { selector: ".song-request-nowplaying-actions", title: "되돌리기 / 건너뛰기", desc: "방금 재생한 곡을 취소하거나, 다음 곡으로 건너뛸 수 있어요." },
];

const tourOverlay = document.getElementById("tourOverlay");
const tourHighlight = document.getElementById("tourHighlight");
const tourTooltip = document.getElementById("tourTooltip");
const tourStepLabel = document.getElementById("tourStepLabel");
const tourTitle = document.getElementById("tourTitle");
const tourDesc = document.getElementById("tourDesc");
const tourPrevBtn = document.getElementById("tourPrevBtn");
const tourNextBtn = document.getElementById("tourNextBtn");
const tourSkipBtn = document.getElementById("tourSkipBtn");
const featureTourBtn = document.getElementById("featureTourBtn");

let tourStepIndex = 0;
let tourResizeHandlerAttached = false;

function getTourVisibleSteps() {
  return TOUR_STEPS.filter((step) => {
    const el = document.querySelector(step.selector);
    return !!(el && el.offsetParent !== null);
  });
}

function positionTourStep(step) {
  const el = document.querySelector(step.selector);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const pad = 8;
  const margin = 12;

  tourHighlight.style.top = `${rect.top - pad}px`;
  tourHighlight.style.left = `${rect.left - pad}px`;
  tourHighlight.style.width = `${rect.width + pad * 2}px`;
  tourHighlight.style.height = `${rect.height + pad * 2}px`;

  const tooltipWidth = tourTooltip.offsetWidth || 280;
  const tooltipHeight = tourTooltip.offsetHeight || 150;

  let top = rect.bottom + pad + margin;
  if (top + tooltipHeight > window.innerHeight - margin) {
    top = rect.top - pad - margin - tooltipHeight;
  }
  if (top < margin) top = margin;

  let left = rect.left;
  if (left + tooltipWidth > window.innerWidth - margin) {
    left = window.innerWidth - margin - tooltipWidth;
  }
  if (left < margin) left = margin;

  tourTooltip.style.top = `${top}px`;
  tourTooltip.style.left = `${left}px`;
  return true;
}

function renderTourStep() {
  const steps = getTourVisibleSteps();
  if (!steps.length || tourStepIndex >= steps.length) {
    endTour();
    return;
  }
  const step = steps[tourStepIndex];
  if (!positionTourStep(step)) {
    tourStepIndex += 1;
    renderTourStep();
    return;
  }
  tourStepLabel.textContent = `${tourStepIndex + 1} / ${steps.length}`;
  tourTitle.textContent = step.title;
  tourDesc.textContent = step.desc;
  tourPrevBtn.disabled = tourStepIndex === 0;
  tourNextBtn.textContent = tourStepIndex === steps.length - 1 ? "완료" : "다음";
}

function startTour() {
  tourStepIndex = 0;
  tourOverlay.classList.remove("hidden");
  renderTourStep();
  if (!tourResizeHandlerAttached) {
    window.addEventListener("resize", () => {
      if (!tourOverlay.classList.contains("hidden")) renderTourStep();
    });
    tourResizeHandlerAttached = true;
  }
}

function endTour() {
  tourOverlay.classList.add("hidden");
}

featureTourBtn.addEventListener("click", startTour);
tourSkipBtn.addEventListener("click", endTour);
tourNextBtn.addEventListener("click", () => {
  const steps = getTourVisibleSteps();
  if (tourStepIndex >= steps.length - 1) {
    endTour();
    return;
  }
  tourStepIndex += 1;
  renderTourStep();
});
tourPrevBtn.addEventListener("click", () => {
  if (tourStepIndex === 0) return;
  tourStepIndex -= 1;
  renderTourStep();
});
tourOverlay.addEventListener("click", (e) => {
  if (e.target === tourOverlay) endTour();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !tourOverlay.classList.contains("hidden")) endTour();
});

// ===== 시작 =====
loadSongbook().then(() => {
  fetchSingQueue();
  setInterval(fetchSingQueue, 5000);
  setInterval(loadSongbook, 5 * 60 * 1000);
  renderArtistList2();
  renderSongGrid2();
});
