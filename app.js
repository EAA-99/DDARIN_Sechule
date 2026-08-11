const API_URL = "https://script.google.com/macros/s/AKfycbwuOrjG9SZxN4CtkXb9EW2Hd_bt4x-ntPXjAFisw9VojI2X8lijwSZ2Prw5xaxkP8CYeg/exec";

const SPREADSHEET_ID = "1gCvMJMK52QUyo1M4FbFzWsJ_NZp3MUqgrDa0obhNIbY";
const SHEETS_API_KEY = "AIzaSyC0RsFfc5y9GmEaE29niGWD9hbSnpIc7rM";
const SHEETS_API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/AppEvents!A2:D?key=${SHEETS_API_KEY}`;

const SONGBOOK_SPREADSHEET_ID = "1NhImCLm5diXM0pA45SkB-g2PARivQiVN8bUKlniiOB8";
const SONGBOOK_CLIPS_SPREADSHEET_ID = "17EmfOEPVGesH9FXnh7xsKvBYYIhi2TrerSzY23E2N9A";

const LOADING_GIF_MS = 1540;
const SONGBOOK_LOADING_GIF_MS = 4470;

const YEAR = 2026;
const STORAGE_KEY = "calendar-events-2026";
const SHEET_URL_KEY = "calendar-sheet-url-2026";
const EDIT_PW_KEY = "calendar-edit-pw-2026";
const EDIT_USER_KEY = "calendar-edit-user-2026";

function getStoredCreds() {
  const password = localStorage.getItem(EDIT_PW_KEY) || sessionStorage.getItem(EDIT_PW_KEY);
  const username = localStorage.getItem(EDIT_USER_KEY) || sessionStorage.getItem(EDIT_USER_KEY);
  return { username, password };
}

function setStoredCreds(username, password, remember) {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(EDIT_USER_KEY, username);
  storage.setItem(EDIT_PW_KEY, password);
}

function clearStoredCreds() {
  localStorage.removeItem(EDIT_PW_KEY);
  localStorage.removeItem(EDIT_USER_KEY);
  sessionStorage.removeItem(EDIT_PW_KEY);
  sessionStorage.removeItem(EDIT_USER_KEY);
}

let currentMonth = 0; // 0 = January
let selectedDateKey = null;
let isReadOnly = true;

const loadingScreen = document.getElementById("loadingScreen");
const monthTitle = document.getElementById("monthTitle");
const grid = document.getElementById("grid");
const weekdayRow = document.querySelector(".weekday-row");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const cardView = document.getElementById("cardView");
const cardList = document.getElementById("cardList");
const weekPrevBtn = document.getElementById("weekPrevBtn");
const weekNextBtn = document.getElementById("weekNextBtn");
const dayCellMenu = document.getElementById("dayCellMenu");
const dayCellSoopSummaryEl = document.getElementById("dayCellSoopSummary");

const CAFE_API_URL = "/api/cafe";
const BROADCAST_SUMMARY_API_URL = "/api/broadcast-summary";

let dayCellMenuDate = null;

function closeDayCellMenu() {
  dayCellMenu.classList.add("hidden");
  window.removeEventListener("scroll", repositionDayCellMenu, true);
  window.removeEventListener("resize", repositionDayCellMenu);
}

function getDayCellMenuAnchor() {
  if (!dayCellMenuDate) return null;
  return document.querySelector(`.day-cell-menu-btn[data-date="${dayCellMenuDate}"]`);
}

function repositionDayCellMenu() {
  const anchorEl = getDayCellMenuAnchor();
  if (!anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const maxTop = window.innerHeight - dayCellMenu.offsetHeight - 8;
  const top = Math.min(rect.bottom + 4, Math.max(8, maxTop));
  dayCellMenu.style.top = `${top}px`;
  dayCellMenu.style.left = `${Math.min(rect.left, window.innerWidth - dayCellMenu.offsetWidth - 8)}px`;
}

function renderBroadcastSummaryTimeline(data) {
  dayCellSoopSummaryEl.innerHTML = "";

  if (data.summary) {
    const intro = document.createElement("div");
    intro.className = "day-cell-summary-intro";
    intro.textContent = data.summary;
    dayCellSoopSummaryEl.appendChild(intro);
  }

  if (data.events && data.events.length) {
    const timeline = document.createElement("div");
    timeline.className = "day-cell-summary-timeline";
    data.events.forEach((ev) => {
      const item = document.createElement("div");
      item.className = "timeline-item";
      const time = document.createElement("span");
      time.className = "timeline-time";
      time.textContent = ev.time;
      const text = document.createElement("span");
      text.className = "timeline-text";
      text.textContent = ev.summary;
      item.appendChild(time);
      item.appendChild(text);
      timeline.appendChild(item);
    });
    dayCellSoopSummaryEl.appendChild(timeline);
  }
}

async function loadDayCellBroadcastSummary(dateKeyStr) {
  dayCellSoopSummaryEl.textContent = "불러오는 중...";
  dayCellSoopSummaryEl.classList.remove("hidden");
  repositionDayCellMenu();

  try {
    const res = await fetch(`${BROADCAST_SUMMARY_API_URL}?date=${dateKeyStr}`);
    const data = await res.json();
    if (dayCellMenuDate !== dateKeyStr) return;

    if (data.available) {
      renderBroadcastSummaryTimeline(data);
    } else if (data.reason === "offline") {
      dayCellSoopSummaryEl.textContent = "지금 방송 중이 아니에요.";
    } else if (data.reason === "not_today") {
      dayCellSoopSummaryEl.textContent = "방송 중이거나 방송 직후에만 볼 수 있어요.";
    } else {
      dayCellSoopSummaryEl.textContent = "불러오기 실패";
    }
  } catch {
    if (dayCellMenuDate !== dateKeyStr) return;
    dayCellSoopSummaryEl.textContent = "불러오기 실패";
  }
  repositionDayCellMenu();
}

function openDayCellMenu(anchorEl, dateKeyStr) {
  dayCellMenuDate = dateKeyStr;
  dayCellSoopSummaryEl.classList.add("hidden");

  const rect = anchorEl.getBoundingClientRect();
  dayCellMenu.classList.remove("hidden");
  dayCellMenu.style.top = `${rect.bottom + 4}px`;
  dayCellMenu.style.left = `${Math.min(rect.left, window.innerWidth - dayCellMenu.offsetWidth - 8)}px`;

  window.addEventListener("scroll", repositionDayCellMenu, true);
  window.addEventListener("resize", repositionDayCellMenu);
}

document.getElementById("dayCellSoopBtn").addEventListener("click", () => {
  if (dayCellMenuDate) loadDayCellBroadcastSummary(dayCellMenuDate);
});

document.addEventListener("click", (e) => {
  if (!dayCellMenu.classList.contains("hidden") && !dayCellMenu.contains(e.target) && !e.target.classList.contains("day-cell-menu-btn")) {
    closeDayCellMenu();
  }
});
let viewMode = "list";
let cardWeekStart = getMonday(new Date());
const modalBackdrop = document.getElementById("modalBackdrop");
const modalDate = document.getElementById("modalDate");
const eventList = document.getElementById("eventList");
const eventForm = document.getElementById("eventForm");
const eventTitleInput = document.getElementById("eventTitle");
const eventAttendeesInput = document.getElementById("eventAttendees");
const eventSubmitBtn = document.getElementById("eventSubmitBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const colorPickerBtn = document.getElementById("colorPickerBtn");
const colorPickerBtnLabel = document.getElementById("colorPickerBtnLabel");
const colorPickerList = document.getElementById("colorPickerList");
const colorPickerOptions = document.querySelectorAll(".color-picker-option");
let selectedColor = "gray";
let selectedHex = null;
let editingIndex = null;

const editLockBtn = document.getElementById("editLockBtn");
const loginBtnLabel = document.getElementById("loginBtnLabel");

const appViewEl = document.querySelector(".app");
const songbookBtn = document.getElementById("songbookBtn");
const songbookView = document.getElementById("songbookView");
const songSearchInput = document.getElementById("songSearchInput");
const genreTabs = document.getElementById("genreTabs");
const artistList = document.getElementById("artistList");
let songbookArtist = "전체";
const songSortSelect = document.getElementById("songSortSelect");
const songNoImageBtn = document.getElementById("songNoImageBtn");
const songImageBtn = document.getElementById("songImageBtn");
const playerEmpty = document.getElementById("playerEmpty");
const playerNoClip = document.getElementById("playerNoClip");
const playerNoClipSong = document.getElementById("playerNoClipSong");
const playerPlayBtn = document.getElementById("playerPlayBtn");
const playerPrevBtn = document.getElementById("playerPrevBtn");
const playerNextBtn = document.getElementById("playerNextBtn");
const songPlayerModalBackdrop = document.getElementById("songPlayerModalBackdrop");
const songPlayerModalFrame = document.getElementById("songPlayerModalFrame");
const songPlayerModalClose = document.getElementById("songPlayerModalClose");
const songPlayerModalTitle = document.getElementById("songPlayerModalTitle");
const songPlayerModalArtist = document.getElementById("songPlayerModalArtist");
const songPlayerModalFavBtn = document.getElementById("songPlayerModalFavBtn");
const songPlayerModalFavIcon = document.getElementById("songPlayerModalFavIcon");
const songPlayerModalFavLabel = document.getElementById("songPlayerModalFavLabel");
const songGrid = document.getElementById("songGrid");
const songbookLoadingScreen = document.getElementById("songbookLoadingScreen");
const favoritesListEl = document.getElementById("favoritesList");
let allSongs = null;
let songByKey = {};
let songbookGenre = "전체";
const sheetSettingsBtn = document.getElementById("sheetSettingsBtn");
const sheetModalBackdrop = document.getElementById("sheetModalBackdrop");
const sheetUrlInput = document.getElementById("sheetUrlInput");
const sheetAutoImportBtn = document.getElementById("sheetAutoImportBtn");
const sheetJsonInput = document.getElementById("sheetJsonInput");
const sheetStatus = document.getElementById("sheetStatus");
const sheetImportBtn = document.getElementById("sheetImportBtn");
const closeSheetModalBtn = document.getElementById("closeSheetModalBtn");

let eventsCache = null;

function loadEvents() {
  if (eventsCache) return eventsCache;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function eventsObjectToFlat(events) {
  const flat = [];
  Object.keys(events).forEach((date) => {
    events[date].forEach((ev) => flat.push(Object.assign({ date: date }, ev)));
  });
  return flat;
}

function flatToEventsObject(flat) {
  const events = {};
  flat.forEach((row) => {
    const date = row.date;
    const ev = { title: row.title };
    if (row.color) ev.color = row.color;
    if (row.sheetColor) ev.sheetColor = row.sheetColor;
    if (!events[date]) events[date] = [];
    events[date].push(ev);
  });
  return events;
}

async function apiGetEventsDirect() {
  try {
    const res = await fetch(SHEETS_API_URL);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.values) return [];
    return data.values
      .map((row) => {
        const [date, title, color, sheetColor] = row;
        if (!date || !title) return null;
        const item = { date: String(date), title: String(title) };
        if (color) item.color = String(color);
        if (sheetColor) item.sheetColor = String(sheetColor);
        return item;
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

async function apiGetEventsAppsScript() {
  try {
    const res = await fetch(`${API_URL}?data=events`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function apiGetEvents() {
  const direct = await apiGetEventsDirect();
  if (direct) return direct;
  return apiGetEventsAppsScript();
}

async function fetchSongbookGenres() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SONGBOOK_SPREADSHEET_ID}?key=${SHEETS_API_KEY}&fields=sheets.properties.title`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.sheets || []).map((s) => s.properties.title);
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

function renderGenreTabs(genres) {
  genreTabs.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "genre-tab" + (songbookGenre === "전체" ? " active" : "");
  allBtn.dataset.genre = "전체";
  allBtn.textContent = "전체";
  genreTabs.appendChild(allBtn);

  genres.forEach((genre) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "genre-tab" + (songbookGenre === genre ? " active" : "");
    btn.dataset.genre = genre;
    btn.textContent = genre;
    genreTabs.appendChild(btn);
  });
}

function renderArtistList() {
  const inGenre = (allSongs || []).filter(
    (song) => songbookGenre === "전체" || song.genre === songbookGenre
  );
  const artists = [...new Set(inGenre.map((s) => s.artist))].sort((a, b) => a.localeCompare(b, "ko"));

  if (songbookArtist !== "전체" && !artists.includes(songbookArtist)) {
    songbookArtist = "전체";
  }

  artistList.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "artist-list-btn" + (songbookArtist === "전체" ? " active" : "");
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => {
    songbookArtist = "전체";
    renderArtistList();
    renderSongGrid();
  });
  artistList.appendChild(allBtn);

  artists.forEach((artist) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "artist-list-btn" + (songbookArtist === artist ? " active" : "");
    btn.textContent = artist;
    btn.addEventListener("click", () => {
      songbookArtist = artist;
      renderArtistList();
      renderSongGrid();
    });
    artistList.appendChild(btn);
  });
}

function albumArtCacheKey(song) {
  return `${song.artist}|${song.title}`.toLowerCase();
}

let songbookSongsPromise = null;

function ensureSongbookSongs() {
  if (!songbookSongsPromise) {
    songbookSongsPromise = fetchSongbookSongs().then((songs) => {
      allSongs = songs;
      songByKey = {};
      songs.forEach((song) => {
        songByKey[albumArtCacheKey(song)] = song;
      });
      const genres = [...new Set(songs.map((s) => s.genre))];
      renderGenreTabs(genres);
      return songs;
    });
  }
  return songbookSongsPromise;
}

let clipMap = null;
let thumbMap = null;
let songMetaPromise = null;

async function fetchSongMeta() {
  const clips = {};
  const thumbs = {};
  const durations = {};
  try {
    const range = encodeURIComponent("시트1!A2:E");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SONGBOOK_CLIPS_SPREADSHEET_ID}/values/${range}?key=${SHEETS_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      (data.values || []).forEach((row) => {
        const [artist, title, link, thumbUrl, durationMs] = row;
        if (!title) return;
        const key = `${artist || ""}|${title}`.toLowerCase();
        if (link) {
          const m = /player\/(\d+)/.exec(link);
          if (m) clips[key] = m[1];
        }
        if (thumbUrl) thumbs[key] = thumbUrl;
        if (durationMs) durations[key] = parseInt(durationMs, 10) || null;
      });
    }
  } catch {
    // maps stay as whatever was parsed so far
  }
  clipMap = clips;
  thumbMap = thumbs;
  clipDurationMap = durations;
  return { clips, thumbs, durations };
}

function ensureSongMeta() {
  if (!songMetaPromise) songMetaPromise = fetchSongMeta();
  return songMetaPromise;
}

function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = url;
  });
}

async function preloadAllAlbumArt() {
  const urls = Object.values(thumbMap || {}).filter(Boolean);
  await Promise.all(urls.map(preloadImage));
}

let albumArtPreloadPromise = null;

function ensureAlbumArtPreloaded() {
  if (!albumArtPreloadPromise) {
    albumArtPreloadPromise = ensureSongMeta().then(preloadAllAlbumArt);
  }
  return albumArtPreloadPromise;
}

async function prefetchSongbookInBackground() {
  await ensureSongbookSongs();
  await ensureAlbumArtPreloaded();
}

function buildClipPageUrl(clipId) {
  return `https://vod.sooplive.com/player/${clipId}/embed?type=catch&autoPlay=true&showChat=false&mutePlay=false`;
}

function updateSongPlayerModalFavBtn(key) {
  const active = isSongFavorite(key);
  songPlayerModalFavIcon.textContent = active ? "★" : "☆";
  songPlayerModalFavLabel.textContent = active ? "즐겨찾기 해제" : "즐겨찾기 추가";
}

function openSongPlayerModal(song, clipId) {
  songPlayerModalFrame.src = buildClipPageUrl(clipId);
  songPlayerModalTitle.textContent = song.title;
  songPlayerModalArtist.textContent = song.artist;
  updateSongPlayerModalFavBtn(albumArtCacheKey(song));
  songPlayerModalBackdrop.classList.remove("hidden");
}

function closeSongPlayerModal() {
  clearTimeout(autoAdvanceTimer);
  songPlayerModalBackdrop.classList.add("hidden");
  songPlayerModalFrame.src = "";
}

songPlayerModalClose.addEventListener("click", closeSongPlayerModal);
songPlayerModalBackdrop.addEventListener("click", (e) => {
  if (e.target === songPlayerModalBackdrop) closeSongPlayerModal();
});
songPlayerModalFavBtn.addEventListener("click", () => {
  if (!currentSongKey) return;
  toggleSongFavorite(currentSongKey);
  updateSongPlayerModalFavBtn(currentSongKey);
  renderFavoritesList();
});

let currentClipId = null;
let currentSongKey = null;
let currentSong = null;

async function playSong(song) {
  if (!clipMap) await ensureSongMeta();
  const key = albumArtCacheKey(song);
  const clipId = clipMap[key];

  clearTimeout(autoAdvanceTimer);

  if (isSongFavorite(key)) {
    favoritesQueue = songFavoritesOrder.map((k) => songByKey[k]).filter((s) => s && clipMap[albumArtCacheKey(s)]);
    favoritesQueueIndex = favoritesQueue.findIndex((s) => albumArtCacheKey(s) === key);
    favoritesQueueActive = favoritesQueueIndex !== -1;
  } else {
    favoritesQueueActive = false;
  }

  playerEmpty.classList.add("hidden");
  currentClipId = clipId || null;
  currentSongKey = key;
  currentSong = song;
  playerPrevBtn.disabled = !(favoritesQueueActive && favoritesQueueIndex > 0);
  playerNextBtn.disabled = !(favoritesQueueActive && favoritesQueueIndex < favoritesQueue.length - 1);

  if (!clipId) {
    playerPlayBtn.disabled = true;
    playerNoClip.classList.remove("hidden");
    playerNoClipSong.textContent = `${song.title} - ${song.artist}`;
    closeSongPlayerModal();
    return;
  }

  playerNoClip.classList.add("hidden");
  playerPlayBtn.disabled = false;

  openSongPlayerModal(song, clipId);
  if (favoritesQueueActive) scheduleAutoAdvance();
}

function goToFavoritesQueueOffset(offset) {
  if (!favoritesQueueActive) return;
  const newIndex = favoritesQueueIndex + offset;
  if (newIndex < 0 || newIndex >= favoritesQueue.length) return;
  playSong(favoritesQueue[newIndex]);
}

playerPrevBtn.addEventListener("click", () => goToFavoritesQueueOffset(-1));
playerNextBtn.addEventListener("click", () => goToFavoritesQueueOffset(1));

playerPlayBtn.addEventListener("click", () => {
  if (currentClipId && currentSong) {
    openSongPlayerModal(currentSong, currentClipId);
    return;
  }
  const favSongs = songFavoritesOrder.map((k) => songByKey[k]).filter(Boolean);
  if (favSongs.length) playSong(favSongs[0]);
});

let songShowImage = true;
let songSortMode = "artist"; // "artist" | "title"

const SONG_FAVORITES_KEY = "songbook-favorites";
let songFavoritesOrder = [];
try {
  songFavoritesOrder = JSON.parse(localStorage.getItem(SONG_FAVORITES_KEY)) || [];
} catch {
  songFavoritesOrder = [];
}

function isSongFavorite(key) {
  return songFavoritesOrder.includes(key);
}

function toggleSongFavorite(key) {
  const idx = songFavoritesOrder.indexOf(key);
  if (idx >= 0) songFavoritesOrder.splice(idx, 1);
  else songFavoritesOrder.push(key);
  localStorage.setItem(SONG_FAVORITES_KEY, JSON.stringify(songFavoritesOrder));
}

let draggedFavKey = null;

function renderFavoritesList() {
  favoritesListEl.innerHTML = "";

  const favSongs = songFavoritesOrder.map((key) => songByKey[key]).filter(Boolean);

  if (!currentClipId) playerPlayBtn.disabled = favSongs.length === 0;

  if (!favSongs.length) {
    const empty = document.createElement("p");
    empty.className = "favorites-empty";
    empty.textContent = "즐겨찾기한 곡이 없습니다.";
    favoritesListEl.appendChild(empty);
    return;
  }

  favSongs.forEach((song) => {
    const key = albumArtCacheKey(song);

    const item = document.createElement("button");
    item.type = "button";
    item.className = "favorite-item";
    item.draggable = true;

    const titleEl = document.createElement("div");
    titleEl.className = "favorite-item-title";
    titleEl.textContent = song.title;

    const artistEl = document.createElement("div");
    artistEl.className = "favorite-item-artist";
    artistEl.textContent = song.artist;

    item.append(titleEl, artistEl);
    item.addEventListener("click", () => playSong(song));

    item.addEventListener("dragstart", () => {
      draggedFavKey = key;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      draggedFavKey = null;
      item.classList.remove("dragging");
    });
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!draggedFavKey || draggedFavKey === key) return;
      const fromIdx = songFavoritesOrder.indexOf(draggedFavKey);
      const toIdx = songFavoritesOrder.indexOf(key);
      if (fromIdx === -1 || toIdx === -1) return;
      songFavoritesOrder.splice(fromIdx, 1);
      songFavoritesOrder.splice(toIdx, 0, draggedFavKey);
      localStorage.setItem(SONG_FAVORITES_KEY, JSON.stringify(songFavoritesOrder));
      renderFavoritesList();
    });

    favoritesListEl.appendChild(item);
  });
}

let clipDurationMap = {};
let favoritesQueue = [];
let favoritesQueueIndex = -1;
let favoritesQueueActive = false;
let autoAdvanceTimer = null;

function scheduleAutoAdvance() {
  clearTimeout(autoAdvanceTimer);
  console.log("[autoAdvance] scheduleAutoAdvance called. favoritesQueueActive=", favoritesQueueActive, "currentSongKey=", currentSongKey);
  if (!favoritesQueueActive) return;
  const duration = clipDurationMap[currentSongKey];
  console.log("[autoAdvance] duration for key:", duration, "clipDurationMap has", Object.keys(clipDurationMap || {}).length, "entries");
  if (!duration) return;
  const AUTO_ADVANCE_BUFFER_MS = 10;
  const LOAD_DELAY_COMPENSATION_MS = 2000; // 영상 로딩 시간만큼 타이머를 늦게 발동
  const fireAt = Math.max(10, duration - AUTO_ADVANCE_BUFFER_MS + LOAD_DELAY_COMPENSATION_MS);
  console.log("[autoAdvance] timer set to fire in", fireAt, "ms");
  autoAdvanceTimer = setTimeout(() => {
    console.log("[autoAdvance] timer fired, advancing queue");
    advanceFavoritesQueue();
  }, fireAt);
}

function advanceFavoritesQueue() {
  if (!favoritesQueueActive) return;
  const nextIndex = favoritesQueueIndex + 1;
  if (nextIndex >= favoritesQueue.length) {
    favoritesQueueActive = false;
    return;
  }
  playSong(favoritesQueue[nextIndex]);
}

function buildSongCard(song) {
  const card = document.createElement("div");
  card.className = "song-card";

  const key = albumArtCacheKey(song);

  const artEl = document.createElement("img");
  artEl.className = "song-card-art";
  artEl.alt = "";

  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "song-card-fav-btn" + (isSongFavorite(key) ? " active" : "");
  favBtn.textContent = isSongFavorite(key) ? "★" : "☆";
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSongFavorite(key);
    favBtn.classList.toggle("active");
    favBtn.textContent = isSongFavorite(key) ? "★" : "☆";
    renderFavoritesList();
  });

  const titleEl = document.createElement("div");
  titleEl.className = "song-card-title";
  titleEl.textContent = song.title;

  const artistEl = document.createElement("div");
  artistEl.className = "song-card-artist";
  artistEl.textContent = song.artist;

  const genreEl = document.createElement("span");
  genreEl.className = "song-card-genre";
  genreEl.textContent = song.genre;

  card.append(artEl, favBtn, titleEl, artistEl, genreEl);
  card.addEventListener("click", () => playSong(song));

  if (thumbMap && thumbMap[key]) artEl.src = thumbMap[key];

  return card;
}

function renderSongGrid() {
  songGrid.classList.toggle("no-image-mode", !songShowImage);

  const query = songSearchInput.value.trim().toLowerCase();

  const filtered = (allSongs || []).filter((song) => {
    if (songbookGenre !== "전체" && song.genre !== songbookGenre) return false;
    if (songbookArtist !== "전체" && song.artist !== songbookArtist) return false;
    if (query && !song.title.toLowerCase().includes(query) && !song.artist.toLowerCase().includes(query)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const field = songSortMode === "title" ? "title" : "artist";
    return a[field].localeCompare(b[field], "ko");
  });

  songGrid.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "song-empty";
    empty.textContent = "곡이 없습니다.";
    songGrid.appendChild(empty);
    return;
  }

  if (songSortMode !== "artist") {
    filtered.forEach((song) => songGrid.appendChild(buildSongCard(song)));
    return;
  }

  const groups = [];
  filtered.forEach((song) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.artist === song.artist) {
      lastGroup.songs.push(song);
    } else {
      groups.push({ artist: song.artist, songs: [song] });
    }
  });

  groups.forEach((group) => {
    const header = document.createElement("div");
    header.className = "song-group-header";

    const nameEl = document.createElement("span");
    nameEl.className = "song-group-name";
    nameEl.textContent = group.artist;

    const countEl = document.createElement("span");
    countEl.className = "song-group-count";
    countEl.textContent = `${group.songs.length}곡`;

    header.append(nameEl, countEl);
    songGrid.appendChild(header);

    group.songs.forEach((song) => songGrid.appendChild(buildSongCard(song)));
  });
}

async function openSongbook() {
  appViewEl.classList.add("hidden");
  songbookView.classList.remove("hidden");

  if (!allSongs) {
    songGrid.innerHTML = `<div class="song-empty">불러오는 중...</div>`;
    await ensureSongbookSongs();
  }

  songbookLoadingScreen.classList.remove("hidden");
  const minDelay = new Promise((r) => setTimeout(r, SONGBOOK_LOADING_GIF_MS));
  await Promise.all([ensureAlbumArtPreloaded(), minDelay]);
  songbookLoadingScreen.classList.add("hidden");

  renderSongGrid();
  renderFavoritesList();
  renderArtistList();
}

function closeSongbook() {
  songbookView.classList.add("hidden");
  appViewEl.classList.remove("hidden");
}

songbookBtn.addEventListener("click", openSongbook);
document.getElementById("calendarBtn").addEventListener("click", closeSongbook);

const MEMO_KEY = "ddarin-memo-2026";
const memoBtn = document.getElementById("memoBtn");
const memoPanel = document.getElementById("memoPanel");
const memoOverlay = document.getElementById("memoOverlay");
const closeMemoBtn = document.getElementById("closeMemoBtn");
const memoSharedHint = document.getElementById("memoSharedHint");
const memoTabPersonal = document.getElementById("memoTabPersonal");
const memoTabShared = document.getElementById("memoTabShared");
const memoPersonalSection = document.getElementById("memoPersonalSection");
const memoSharedSection = document.getElementById("memoSharedSection");
const memoPersonalInput = document.getElementById("memoPersonalInput");
const memoPersonalAddBtn = document.getElementById("memoPersonalAddBtn");
const memoPersonalList = document.getElementById("memoPersonalList");
const memoSharedInput = document.getElementById("memoSharedInput");
const memoSharedAddBtn = document.getElementById("memoSharedAddBtn");
const memoSharedList = document.getElementById("memoSharedList");

const SHARED_MEMO_API_URL = "/api/memo";
let sharedMemoItems = [];

function showMemoTab(tab) {
  const showShared = tab === "shared";
  memoTabPersonal.classList.toggle("active", !showShared);
  memoTabShared.classList.toggle("active", showShared);
  memoPersonalSection.classList.toggle("hidden", showShared);
  memoSharedSection.classList.toggle("hidden", !showShared);
}

memoTabPersonal.addEventListener("click", () => showMemoTab("personal"));
memoTabShared.addEventListener("click", () => showMemoTab("shared"));

function renderMemoCards(listEl, items, canDelete, onDelete) {
  listEl.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "memo-card-empty";
    empty.textContent = "메모가 없습니다.";
    listEl.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "memo-card";
    card.textContent = item.text;
    if (canDelete) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "memo-card-delete";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => onDelete(item.id));
      card.appendChild(delBtn);
    }
    listEl.appendChild(card);
  });
}

function loadPersonalMemoItems() {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMO_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function savePersonalMemoItems(items) {
  localStorage.setItem(MEMO_KEY, JSON.stringify(items));
}

function renderPersonalMemoList() {
  renderMemoCards(memoPersonalList, loadPersonalMemoItems(), true, (id) => {
    savePersonalMemoItems(loadPersonalMemoItems().filter((it) => it.id !== id));
    renderPersonalMemoList();
  });
}

memoPersonalAddBtn.addEventListener("click", () => {
  const text = memoPersonalInput.value.trim();
  if (!text) return;
  const items = loadPersonalMemoItems();
  items.unshift({ id: Date.now(), text });
  savePersonalMemoItems(items);
  memoPersonalInput.value = "";
  renderPersonalMemoList();
});
memoPersonalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") memoPersonalAddBtn.click();
});

function renderSharedMemoList() {
  renderMemoCards(memoSharedList, sharedMemoItems, !isReadOnly, async (id) => {
    const { username, password } = getStoredCreds();
    if (!username || !password) return;
    await fetch(SHARED_MEMO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, action: "delete", id }),
    });
    await loadSharedMemoList();
  });
}

async function loadSharedMemoList() {
  memoSharedList.innerHTML = `<div class="memo-card-empty">불러오는 중...</div>`;
  try {
    const res = await fetch(SHARED_MEMO_API_URL);
    const data = await res.json();
    sharedMemoItems = (data && data.items) || [];
  } catch {
    sharedMemoItems = [];
  }
  renderSharedMemoList();
}

memoSharedAddBtn.addEventListener("click", async () => {
  if (isReadOnly) return;
  const text = memoSharedInput.value.trim();
  if (!text) return;
  const { username, password } = getStoredCreds();
  if (!username || !password) return;
  memoSharedInput.value = "";
  await fetch(SHARED_MEMO_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, action: "add", text }),
  });
  await loadSharedMemoList();
});
memoSharedInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") memoSharedAddBtn.click();
});

function openMemoPanel() {
  renderPersonalMemoList();
  memoSharedInput.disabled = isReadOnly;
  memoSharedAddBtn.disabled = isReadOnly;
  memoSharedHint.classList.toggle("hidden", !isReadOnly);
  showMemoTab("shared");
  loadSharedMemoList();
  memoPanel.classList.remove("hidden");
  memoOverlay.classList.remove("hidden");
}

function closeMemoPanel() {
  memoPanel.classList.add("hidden");
  memoOverlay.classList.add("hidden");
}

memoBtn.addEventListener("click", openMemoPanel);
closeMemoBtn.addEventListener("click", closeMemoPanel);
memoOverlay.addEventListener("click", closeMemoPanel);

(function makeMemoPanelDraggable() {
  const header = document.querySelector(".memo-panel-header");
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("mousedown", (e) => {
    if (e.target.closest(".memo-panel-close")) return;
    dragging = true;
    const rect = memoPanel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    memoPanel.style.right = "auto";
    memoPanel.style.left = `${rect.left}px`;
    memoPanel.style.top = `${rect.top}px`;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    memoPanel.style.left = `${e.clientX - offsetX}px`;
    memoPanel.style.top = `${e.clientY - offsetY}px`;
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });
})();
songSearchInput.addEventListener("input", renderSongGrid);
genreTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".genre-tab");
  if (!btn) return;
  songbookGenre = btn.dataset.genre;
  genreTabs.querySelectorAll(".genre-tab").forEach((el) => el.classList.toggle("active", el === btn));
  renderArtistList();
  renderSongGrid();
});

songNoImageBtn.addEventListener("click", () => {
  songShowImage = false;
  songNoImageBtn.classList.add("active");
  songImageBtn.classList.remove("active");
  renderSongGrid();
});

songImageBtn.addEventListener("click", () => {
  songShowImage = true;
  songImageBtn.classList.add("active");
  songNoImageBtn.classList.remove("active");
  renderSongGrid();
});

songSortSelect.addEventListener("change", () => {
  songSortMode = songSortSelect.value;
  renderSongGrid();
});

async function apiPost(payload) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function saveEvents(data) {
  eventsCache = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const { username, password } = getStoredCreds();
  if (!password || !username) return;

  apiPost({ action: "save", events: eventsObjectToFlat(data), username, password }).then((res) => {
    if (!res || !res.ok) {
      clearStoredCreds();
      isReadOnly = true;
      updateLockUi();
      alert("저장에 실패했습니다. 편집 잠금이 해제되어 다시 비밀번호를 입력해야 합니다.");
    }
  });
}

async function syncEventsFromServer() {
  const flat = await apiGetEvents();
  if (flat) {
    eventsCache = flatToEventsObject(flat);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsCache));
    refreshCurrentView();
  }
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function initEvents() {
  const flat = await withTimeout(apiGetEvents(), 5000);
  if (flat && flat.length) {
    eventsCache = flatToEventsObject(flat);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsCache));
  } else {
    eventsCache = loadEvents();
  }
}

function dateKey(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function getMonday(date) {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7; // 0=월 ... 6=일
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function firstWeekOfMonth(monthIndex) {
  return getMonday(new Date(YEAR, monthIndex, 1));
}

function lastWeekOfMonth(monthIndex) {
  return getMonday(new Date(YEAR, monthIndex + 1, 0));
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

const ATTENDEE_RE = /\s+w\.\s*(.+)$/i;

function getColorInfo(ev) {
  if (ev.title.includes("휴방")) return { key: "hiatus" };
  if (ev.title.includes("합방")) return { key: "collab" };
  if (ev.title.includes("따이봤")) return { key: "gray" };
  if (ev.sheetColor) return { hex: ev.sheetColor };
  return { key: ev.color || "blue" };
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(c) {
  return "#" + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function mix(rgb, target, ratio) {
  return {
    r: Math.round(rgb.r + (target - rgb.r) * ratio),
    g: Math.round(rgb.g + (target - rgb.g) * ratio),
    b: Math.round(rgb.b + (target - rgb.b) * ratio),
  };
}

const EVENT_COLOR_LABELS = {
  purple: "합방",
  collab: "합방",
  blue: "종겜",
  hiatus: "휴방",
  gray: "갠방",
  yellow: "노래관련",
};

const EVENT_HEX_LABELS = {
  "#4285f4": "종겜",
  "#ff6d01": "노래관련",
  "#cc0000": "휴방",
  "#e951d0": "커머스",
  "#8a2be2": "종겜",
  "#9900ff": "종겜",
  "#000000": "시네티",
};

function getEventBadgeLabel(ev) {
  const info = getColorInfo(ev);
  if (info.hex) return EVENT_HEX_LABELS[info.hex.toLowerCase()] || null;
  return EVENT_COLOR_LABELS[info.key] || null;
}

function applyEventColor(el, ev) {
  const info = getColorInfo(ev);
  if (info.hex) {
    const rgb = hexToRgb(info.hex);
    if (rgb) {
      el.style.background = rgbToHex(mix(rgb, 255, 0.82));
      el.style.color = rgbToHex(mix(rgb, 0, 0.3));
      return;
    }
  }
  el.classList.add(`color-${info.key || "blue"}`);
}

function fillEventContent(el, title) {
  const match = title.match(ATTENDEE_RE);
  if (!match) {
    el.textContent = title;
    return;
  }

  el.textContent = title.slice(0, match.index);
  const icon = document.createElement("span");
  icon.className = "attendee-icon";
  icon.textContent = "👥";
  icon.title = `w. ${match[1].trim()}`;
  el.appendChild(icon);
}

function renderGrid() {
  const events = loadEvents();
  monthTitle.textContent = `${currentMonth + 1}월`;
  prevBtn.disabled = currentMonth === 0;
  nextBtn.disabled = currentMonth === 11;

  grid.innerHTML = "";

  const firstDay = (new Date(YEAR, currentMonth, 1).getDay() + 6) % 7; // 0=월 ... 6=일
  const daysInMonth = new Date(YEAR, currentMonth + 1, 0).getDate();
  const today = todayKey();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKey(YEAR, currentMonth, day);
    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (key === today) cell.classList.add("today");

    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = day;
    cell.appendChild(num);

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "day-cell-menu-btn";
    menuBtn.textContent = "⋮";
    menuBtn.setAttribute("aria-label", "더보기");
    menuBtn.dataset.date = key;
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDayCellMenu(menuBtn, key);
    });
    cell.appendChild(menuBtn);

    const dayEvents = events[key] || [];

    if (dayEvents.length) {
      const eventsWrap = document.createElement("div");
      eventsWrap.className = "day-cell-events";
      dayEvents.forEach((ev) => {
        const chip = document.createElement("div");
        chip.className = "event-single";
        applyEventColor(chip, ev);
        const chipText = document.createElement("span");
        chipText.className = "event-single-text";
        fillEventContent(chipText, ev.title);
        chip.appendChild(chipText);
        eventsWrap.appendChild(chip);
      });
      cell.appendChild(eventsWrap);
    }

    cell.addEventListener("click", () => openModal(key));
    grid.appendChild(cell);
  }
}

function renderCardView() {
  const events = loadEvents();
  const today = todayKey();
  cardList.innerHTML = "";

  for (let i = 0; i < 7; i++) {
    const d = new Date(cardWeekStart);
    d.setDate(d.getDate() + i);
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());

    const card = document.createElement("div");
    card.className = "day-card";
    if (key === today) card.classList.add("today");

    const dateBox = document.createElement("div");
    dateBox.className = "day-card-date";
    dateBox.innerHTML = `<div class="day-card-weekday">${WEEKDAY_LABELS[i]}</div><div class="day-card-num">${d.getDate()}</div>`;
    card.appendChild(dateBox);

    const body = document.createElement("div");
    body.className = "day-card-body";

    const dayEvents = events[key] || [];
    if (!dayEvents.length) {
      const empty = document.createElement("div");
      empty.className = "day-card-empty";
      empty.textContent = "오늘은 일정이 없습니다.";
      body.appendChild(empty);
    } else {
      dayEvents.forEach((ev) => {
        const evBox = document.createElement("div");
        evBox.className = "day-card-event";
        applyEventColor(evBox, ev);
        fillEventContent(evBox, ev.title);
        body.appendChild(evBox);
      });
    }
    card.appendChild(body);

    card.addEventListener("click", () => openModal(key));
    cardList.appendChild(card);
  }

  weekPrevBtn.disabled = cardWeekStart <= firstWeekOfMonth(currentMonth);
  weekNextBtn.disabled = cardWeekStart >= lastWeekOfMonth(currentMonth);
}

function resetCardWeekToMonth() {
  const first = firstWeekOfMonth(currentMonth);
  const last = lastWeekOfMonth(currentMonth);
  const todayWeek = getMonday(new Date());
  cardWeekStart = todayWeek >= first && todayWeek <= last ? todayWeek : first;
}

function selectColor(color, hex) {
  selectedColor = color || null;
  selectedHex = hex || null;
  const value = hex || color || "gray";
  colorPickerOptions.forEach((opt) => {
    const matches = opt.dataset.value === value;
    opt.classList.toggle("selected", matches);
    if (matches) colorPickerBtnLabel.textContent = opt.textContent;
  });
}

function resetForm() {
  editingIndex = null;
  eventTitleInput.value = "";
  eventAttendeesInput.value = "";
  selectColor("gray", null);
  eventSubmitBtn.textContent = "추가";
}

const modalCafeNotice = document.getElementById("modalCafeNotice");
const modalCafeNoticeTitle = document.getElementById("modalCafeNoticeTitle");

async function loadModalCafeNotice(key) {
  modalCafeNotice.classList.add("hidden");
  try {
    const res = await fetch(`${CAFE_API_URL}?date=${key}`);
    const posts = await res.json();
    if (selectedDateKey !== key) return;
    if (posts && posts.length) {
      modalCafeNoticeTitle.textContent = posts[0].title;
      modalCafeNotice.href = posts[0].url;
      modalCafeNotice.classList.remove("hidden");
    }
  } catch {
    // 조용히 무시 (공지사항 없이 표시)
  }
}

const SOOP_NOTICE_API_URL = "/api/soop-notice";
const modalSoopNotice = document.getElementById("modalSoopNotice");
const modalSoopNoticeTitle = document.getElementById("modalSoopNoticeTitle");
const modalSoopNoticeContent = document.getElementById("modalSoopNoticeContent");

async function loadModalSoopNotice(key) {
  modalSoopNotice.classList.add("hidden");
  try {
    const res = await fetch(`${SOOP_NOTICE_API_URL}?date=${key}`);
    const posts = await res.json();
    if (selectedDateKey !== key) return;
    if (posts && posts.length) {
      modalSoopNoticeTitle.textContent = posts[0].title;
      modalSoopNoticeContent.textContent = posts[0].content;
      modalSoopNotice.href = posts[0].url;
      modalSoopNotice.classList.remove("hidden");
    }
  } catch {
    // 조용히 무시 (공지사항 없이 표시)
  }
}

function openModal(key) {
  selectedDateKey = key;
  const [, m, d] = key.split("-");
  modalDate.textContent = `${YEAR}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  renderEventList();
  resetForm();
  eventForm.classList.toggle("hidden", isReadOnly);
  modalBackdrop.classList.remove("hidden");
  if (!isReadOnly) eventTitleInput.focus();
  loadModalCafeNotice(key);
  loadModalSoopNotice(key);
}

function editEvent(idx) {
  if (isReadOnly) return;
  const events = loadEvents();
  const ev = (events[selectedDateKey] || [])[idx];
  if (!ev) return;

  editingIndex = idx;
  const match = ev.title.match(ATTENDEE_RE);
  eventTitleInput.value = match ? ev.title.slice(0, match.index).trim() : ev.title;
  eventAttendeesInput.value = match ? match[1].trim() : "";
  if (ev.sheetColor) {
    selectColor(null, ev.sheetColor);
  } else {
    selectColor(ev.color || "gray", null);
  }
  eventSubmitBtn.textContent = "수정";
  eventTitleInput.focus();
}

colorPickerBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  colorPickerList.classList.toggle("hidden");
});

colorPickerOptions.forEach((opt) => {
  opt.addEventListener("click", () => {
    const v = opt.dataset.value;
    if (v.startsWith("#")) selectColor(null, v);
    else selectColor(v, null);
    colorPickerList.classList.add("hidden");
  });
});

document.addEventListener("click", (e) => {
  if (!colorPickerList.classList.contains("hidden") && !colorPickerList.contains(e.target) && e.target !== colorPickerBtn) {
    colorPickerList.classList.add("hidden");
  }
});

function closeModal() {
  modalBackdrop.classList.add("hidden");
  selectedDateKey = null;
}

function renderEventList() {
  const events = loadEvents();
  const list = events[selectedDateKey] || [];

  eventList.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "event-empty";
    empty.textContent = "등록된 일정이 없습니다.";
    eventList.appendChild(empty);
    return;
  }

  list.forEach((ev, idx) => {
    const card = document.createElement("div");
    card.className = "event-card";
    if (isReadOnly) card.style.cursor = "default";
    else card.addEventListener("click", () => editEvent(idx));

    if (!isReadOnly) {
      const delBtn = document.createElement("button");
      delBtn.className = "del-btn";
      delBtn.textContent = "삭제";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteEvent(idx);
      });
      card.appendChild(delBtn);
    }

    const match = ev.title.match(ATTENDEE_RE);
    const titleEl = document.createElement("div");
    titleEl.className = "event-card-title";
    titleEl.textContent = match ? ev.title.slice(0, match.index) : ev.title;
    card.appendChild(titleEl);

    const badgeLabel = getEventBadgeLabel(ev);
    if (badgeLabel) {
      const badgeEl = document.createElement("div");
      badgeEl.className = "event-card-badge";
      badgeEl.textContent = badgeLabel;
      applyEventColor(badgeEl, ev);
      card.appendChild(badgeEl);
    }

    if (match) {
      const names = match[1].split(/[,、&]/).map((n) => n.trim()).filter(Boolean);
      if (names.length) {
        const attendeesWrap = document.createElement("div");
        attendeesWrap.className = "event-card-attendees";

        const icon = document.createElement("span");
        icon.className = "attendees-icon";
        icon.textContent = "👤";
        attendeesWrap.appendChild(icon);

        const namesEl = document.createElement("span");
        namesEl.textContent = names.join(", ");
        attendeesWrap.appendChild(namesEl);

        card.appendChild(attendeesWrap);
      }
    }

    eventList.appendChild(card);
  });
}

function refreshCurrentView() {
  renderGrid();
  if (viewMode === "card") renderCardView();
}

function deleteEvent(index) {
  if (isReadOnly) return;
  const events = loadEvents();
  const list = events[selectedDateKey] || [];
  list.splice(index, 1);
  if (list.length === 0) delete events[selectedDateKey];
  saveEvents(events);
  if (editingIndex === index) resetForm();
  renderEventList();
  refreshCurrentView();
}

eventForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (isReadOnly) return;
  const baseTitle = eventTitleInput.value.trim();
  if (!baseTitle || !selectedDateKey) return;

  const attendees = eventAttendeesInput.value.trim();
  const title = attendees ? `${baseTitle} w.${attendees}` : baseTitle;

  const events = loadEvents();
  if (!events[selectedDateKey]) events[selectedDateKey] = [];

  const newEvent = selectedHex ? { title, sheetColor: selectedHex } : { title, color: selectedColor };

  if (editingIndex !== null) {
    events[selectedDateKey][editingIndex] = newEvent;
  } else {
    events[selectedDateKey].push(newEvent);
  }
  saveEvents(events);

  resetForm();
  renderEventList();
  refreshCurrentView();
  eventTitleInput.focus();
});

prevBtn.addEventListener("click", () => {
  if (currentMonth > 0) {
    currentMonth--;
    renderGrid();
    if (viewMode === "card") {
      resetCardWeekToMonth();
      renderCardView();
    }
  }
});

nextBtn.addEventListener("click", () => {
  if (currentMonth < 11) {
    currentMonth++;
    renderGrid();
    if (viewMode === "card") {
      resetCardWeekToMonth();
      renderCardView();
    }
  }
});

weekPrevBtn.addEventListener("click", () => {
  cardWeekStart.setDate(cardWeekStart.getDate() - 7);
  renderCardView();
});

weekNextBtn.addEventListener("click", () => {
  cardWeekStart.setDate(cardWeekStart.getDate() + 7);
  renderCardView();
});

closeModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modalBackdrop.classList.contains("hidden")) closeModal();
  if (!sheetModalBackdrop.classList.contains("hidden")) sheetModalBackdrop.classList.add("hidden");
});

function setSheetStatus(text, kind) {
  sheetStatus.textContent = text;
  sheetStatus.className = "sheet-status" + (kind ? ` ${kind}` : "");
}

function mergeSheetRows(rows) {
  const events = loadEvents();
  let added = 0;
  rows.forEach((row) => {
    const key = String(row.date || "").trim();
    const title = String(row.title || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !title) return;
    if (!key.startsWith(`${YEAR}-`)) return;

    if (!events[key]) events[key] = [];
    const sheetColor = row.color || undefined;
    const existing = events[key].find((ev) => ev.title === title);
    if (existing) {
      if (sheetColor) existing.sheetColor = sheetColor;
    } else {
      events[key].push({ title, sheetColor });
      added++;
    }
  });

  saveEvents(events);
  refreshCurrentView();
  return added;
}

async function importFromSheetAuto() {
  const url = sheetUrlInput.value.trim();
  if (!url) {
    setSheetStatus("웹앱 URL을 먼저 입력하세요.", "error");
    return;
  }
  localStorage.setItem(SHEET_URL_KEY, url);

  setSheetStatus("불러오는 중...");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    const added = mergeSheetRows(rows);
    setSheetStatus(`${added}개 일정을 새로 불러왔습니다.`, "success");
  } catch (err) {
    setSheetStatus(`자동 불러오기 실패: ${err.message} (아래 붙여넣기 방식을 사용해보세요)`, "error");
  }
}

function importFromSheet() {
  const text = sheetJsonInput.value.trim();
  if (!text) {
    setSheetStatus("먼저 내용을 붙여넣으세요.", "error");
    return;
  }

  try {
    const rows = JSON.parse(text);
    if (!Array.isArray(rows)) throw new Error("배열 형태(JSON)가 아닙니다.");
    const added = mergeSheetRows(rows);
    setSheetStatus(`${added}개 일정을 새로 불러왔습니다.`, "success");
  } catch (err) {
    setSheetStatus(`불러오기에 실패했습니다: ${err.message}`, "error");
  }
}

sheetSettingsBtn.addEventListener("click", () => {
  sheetUrlInput.value = localStorage.getItem(SHEET_URL_KEY) || "";
  setSheetStatus("");
  sheetModalBackdrop.classList.remove("hidden");
});
closeSheetModalBtn.addEventListener("click", () => {
  sheetModalBackdrop.classList.add("hidden");
});
sheetModalBackdrop.addEventListener("click", (e) => {
  if (e.target === sheetModalBackdrop) sheetModalBackdrop.classList.add("hidden");
});
sheetImportBtn.addEventListener("click", importFromSheet);
sheetAutoImportBtn.addEventListener("click", importFromSheetAuto);

function updateLockUi() {
  sheetSettingsBtn.classList.toggle("hidden", isReadOnly);
  editLockBtn.classList.toggle("unlocked", !isReadOnly);
  const label = isReadOnly ? "로그인 (눌러서 편집 잠금 해제)" : "로그아웃 (눌러서 편집 잠그기)";
  editLockBtn.title = label;
  editLockBtn.setAttribute("aria-label", label);
  loginBtnLabel.textContent = isReadOnly ? "로그인" : "로그아웃";
}

async function tryAutoUnlock() {
  const { username: user, password: pw } = getStoredCreds();
  if (!pw || !user) {
    isReadOnly = true;
    return;
  }
  const res = await apiPost({ action: "checkPassword", username: user, password: pw });
  const ok = !!(res && res.ok);
  isReadOnly = !ok;
  if (!ok) clearStoredCreds();
}

const loginModalBackdrop = document.getElementById("loginModalBackdrop");
const loginForm = document.getElementById("loginForm");
const loginUsernameInput = document.getElementById("loginUsernameInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const loginRememberInput = document.getElementById("loginRememberInput");
const loginError = document.getElementById("loginError");
const closeLoginModalBtn = document.getElementById("closeLoginModalBtn");

editLockBtn.addEventListener("click", () => {
  if (!isReadOnly) {
    clearStoredCreds();
    isReadOnly = true;
    updateLockUi();
    return;
  }

  loginError.classList.add("hidden");
  loginUsernameInput.value = "";
  loginPasswordInput.value = "";
  loginRememberInput.checked = false;
  loginModalBackdrop.classList.remove("hidden");
  loginUsernameInput.focus();
});

closeLoginModalBtn.addEventListener("click", () => {
  loginModalBackdrop.classList.add("hidden");
});
loginModalBackdrop.addEventListener("click", (e) => {
  if (e.target === loginModalBackdrop) loginModalBackdrop.classList.add("hidden");
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = loginUsernameInput.value.trim();
  const pw = loginPasswordInput.value;
  if (!username || !pw) return;

  const res = await apiPost({ action: "checkPassword", username, password: pw });
  if (res && res.ok) {
    setStoredCreds(username, pw, loginRememberInput.checked);
    isReadOnly = false;
    updateLockUi();
    loginModalBackdrop.classList.add("hidden");
  } else {
    loginError.classList.remove("hidden");
  }
});

const todayScheduleCard = document.getElementById("todayScheduleCard");
const todayScheduleLive = document.getElementById("todayScheduleLive");
const todayScheduleThumbLink = document.getElementById("todayScheduleThumbLink");
const todayScheduleThumb = document.getElementById("todayScheduleThumb");
const todayScheduleThumbTitle = document.getElementById("todayScheduleThumbTitle");
const todayScheduleList = document.getElementById("todayScheduleList");

function renderTodaySchedule() {
  const key = todayKey();
  const events = loadEvents();
  const list = events[key] || [];

  todayScheduleList.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "today-schedule-empty";
    empty.textContent = "오늘 일정이 없습니다.";
    todayScheduleList.appendChild(empty);
  } else {
    list.forEach((ev) => {
      const item = document.createElement("div");
      item.className = "today-schedule-item";

      const dot = document.createElement("span");
      dot.className = "today-schedule-item-dot";
      applyEventColor(dot, ev);
      item.appendChild(dot);

      const titleEl = document.createElement("span");
      titleEl.className = "today-schedule-item-title";
      titleEl.textContent = ev.title;
      item.appendChild(titleEl);

      item.addEventListener("click", () => openModal(key));
      todayScheduleList.appendChild(item);
    });
  }

  todayScheduleCard.classList.remove("hidden");
}

async function checkLiveStatus() {
  try {
    const res = await fetch("https://chapi.sooplive.com/api/insome0319/station", {
      headers: { Accept: "application/json, text/plain, */*" },
    });
    const data = await res.json();
    const broad = data && data.broad;
    const broadNo = broad && (broad.broad_no || broad.broadNo);

    if (broadNo) {
      todayScheduleLive.classList.remove("hidden");
      todayScheduleThumb.src = `https://liveimg.sooplive.co.kr/m/${broadNo}`;
      todayScheduleThumbTitle.textContent = broad.broad_title || broad.title || "";
      todayScheduleThumbLink.href = "https://play.sooplive.com/insome0319";
      todayScheduleThumbLink.classList.remove("hidden");
    } else {
      todayScheduleLive.classList.add("hidden");
      todayScheduleThumbLink.classList.add("hidden");
    }
  } catch {
    todayScheduleLive.classList.add("hidden");
    todayScheduleThumbLink.classList.add("hidden");
  }
}

async function init() {
  const today = new Date();
  if (today.getFullYear() === YEAR) currentMonth = today.getMonth();

  const minDelay = new Promise((r) => setTimeout(r, LOADING_GIF_MS));
  await Promise.all([initEvents(), minDelay]);

  updateLockUi();
  renderGrid();
  renderTodaySchedule();
  checkLiveStatus();

  loadingScreen.classList.add("hidden");

  prefetchSongbookInBackground();

  tryAutoUnlock().then(() => {
    updateLockUi();
    refreshCurrentView();
  });
}
init();

const SYNC_INTERVAL_MS = 60 * 1000; // 1분

async function backgroundSyncSheet() {
  const url = localStorage.getItem(SHEET_URL_KEY);
  if (!url || isReadOnly) return;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const rows = await res.json();
    mergeSheetRows(rows);
  } catch {
    // 조용히 실패, 다음 주기에 재시도
  }
}

setInterval(() => {
  backgroundSyncSheet();
  syncEventsFromServer();
  renderTodaySchedule();
  checkLiveStatus();
}, SYNC_INTERVAL_MS);
