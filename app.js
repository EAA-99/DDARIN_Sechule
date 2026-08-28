const API_URL = "https://script.google.com/macros/s/AKfycbwuOrjG9SZxN4CtkXb9EW2Hd_bt4x-ntPXjAFisw9VojI2X8lijwSZ2Prw5xaxkP8CYeg/exec";

const SPREADSHEET_ID = "1gCvMJMK52QUyo1M4FbFzWsJ_NZp3MUqgrDa0obhNIbY";
const SHEETS_API_KEY = "AIzaSyC0RsFfc5y9GmEaE29niGWD9hbSnpIc7rM";
const SHEETS_API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/AppEvents!A2:E?key=${SHEETS_API_KEY}`;

const SONGBOOK_SPREADSHEET_ID = "1NhImCLm5diXM0pA45SkB-g2PARivQiVN8bUKlniiOB8";
const SONGBOOK_CLIPS_SPREADSHEET_ID = "17EmfOEPVGesH9FXnh7xsKvBYYIhi2TrerSzY23E2N9A";

const LOADING_GIF_MS = 1540;

const YEAR = 2026;
const STORAGE_KEY = "calendar-events-2026";
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
const loadingGifImg = document.getElementById("loadingGifImg");
const CALENDAR_LOADING_GIFS = [
  "높은양갈래따린윙크.gif",
  "단발오잉따린.gif",
  "단발음뫄.gif",
  "양갈래하트윙크따린.gif",
  "키네시스어센트따린.gif",
];
loadingGifImg.src = CALENDAR_LOADING_GIFS[Math.floor(Math.random() * CALENDAR_LOADING_GIFS.length)];
const monthTitle = document.getElementById("monthTitle");
const grid = document.getElementById("grid");
const weekdayRow = document.querySelector(".weekday-row");
const calendarHeaderEl = document.querySelector(".calendar-header");
grid.addEventListener("scroll", () => {
  weekdayRow.scrollLeft = grid.scrollLeft;
});
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

  if (data.timeline && data.timeline.length) {
    const timeline = document.createElement("div");
    timeline.className = "day-cell-summary-timeline";
    data.timeline.forEach((group) => {
      const item = document.createElement("div");
      item.className = "timeline-item";
      if (group.highlight) item.classList.add("highlight");

      const head = document.createElement("div");
      head.className = "timeline-head";
      const time = document.createElement("span");
      time.className = "timeline-time";
      time.textContent = group.time;
      const text = document.createElement("span");
      text.className = "timeline-text";
      text.textContent = (group.highlight ? "🔥 " : "") + group.summary;
      head.appendChild(time);
      head.appendChild(text);
      item.appendChild(head);

      if (group.details && group.details.length) {
        const details = document.createElement("div");
        details.className = "timeline-details";
        group.details.forEach((d) => {
          const dItem = document.createElement("div");
          dItem.className = "timeline-detail-item";
          dItem.textContent = `[${d.time}] ${d.summary}`;
          details.appendChild(dItem);
        });
        item.appendChild(details);
      }

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
let cardWeekStart = getWeekStart(new Date());
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
const modalManageActions = document.getElementById("modalManageActions");
const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
const newEventBtn = document.getElementById("newEventBtn");
let selectedColor = "gray";
let selectedHex = null;
let editingIndex = null;
let managingMode = false;
let expandedIndex = null;
let draggedEventIndex = null;

const editLockBtn = document.getElementById("editLockBtn");
const loginBtnLabel = document.getElementById("loginBtnLabel");

const appViewEl = document.querySelector(".calendar-post-column");
const songbookView = document.getElementById("songbookView");
const gameView = document.getElementById("gameView");
const backMenuView = document.getElementById("backMenuView");
const cafePhotosView = document.getElementById("cafePhotosView");
const sideNavEl = document.querySelector(".side-nav");
const songSearchInput = document.getElementById("songSearchInput");
const genreTabsMenu = document.getElementById("genreTabsMenu");
const clipSourceCarousel = document.getElementById("clipSourceCarousel");
const clipSourceTrack = document.getElementById("clipSourceTrack");
const clipSourceDots = document.getElementById("clipSourceDots");
const CLIP_SOURCE_ORDER = ["clip", "youtube", "playlist"];
const artistList = document.getElementById("artistList");
let songbookArtist = "전체";
const sortTabs = document.getElementById("sortTabs");
const sortTabsToggle = document.getElementById("sortTabsToggle");
const sortTabsMenu = document.getElementById("sortTabsMenu");
const playerNoClip = document.getElementById("playerNoClip");
const playerNoClipSong = document.getElementById("playerNoClipSong");
const songGrid = document.getElementById("songGrid");
const songPlayerModalBackdrop = document.getElementById("songPlayerModalBackdrop");
const songPlayerModal = document.getElementById("songPlayerModal");
const songPlayerModalFrame = document.getElementById("songPlayerModalFrame");
const songPlayerModalClose = document.getElementById("songPlayerModalClose");
const songPlayerModalTitle = document.getElementById("songPlayerModalTitle");
const songPlayerModalArtist = document.getElementById("songPlayerModalArtist");
const songPlayerModalFavBtn = document.getElementById("songPlayerModalFavBtn");
const songPlayerModalFavIcon = document.getElementById("songPlayerModalFavIcon");
const songPlayerModalFavLabel = document.getElementById("songPlayerModalFavLabel");
const favoritesListEl = document.getElementById("favoritesList");
const songbook2View = document.getElementById("songbook2View");
const song2SearchInput = document.getElementById("song2SearchInput");
const genre2Tabs = document.getElementById("genre2Tabs");
const artist2List = document.getElementById("artist2List");
const song2SortSelect = document.getElementById("song2SortSelect");
const song2Grid = document.getElementById("song2Grid");
const favorites2ListEl = document.getElementById("favorites2List");
const singQueueListEl = document.getElementById("singQueueList");
const songManageBtn = document.getElementById("songManageBtn");
const songManageToolbar = document.getElementById("songManageToolbar");
const songSelectAllBtn = document.getElementById("songSelectAllBtn");
const songDeleteSelectedBtn = document.getElementById("songDeleteSelectedBtn");
const songQueueAddBtn = document.getElementById("songQueueAddBtn");
const songManageCloseBtn = document.getElementById("songManageCloseBtn");
let songbook2Genre = "전체";
let songbook2Artist = "전체";
let songSortMode2 = "artist";
let songManageMode = false;
let selectedSongKeys = new Set();
let allSongs = null;
let songByKey = {};
let songbookGenre = "전체";
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
    if (row.source) ev.source = row.source;
    if (!events[date]) events[date] = [];
    events[date].push(ev);
  });
  return events;
}

async function apiGetEventsDirect() {
  try {
    const res = await fetch(SHEETS_API_URL);
    console.log("[events] direct fetch res.ok=", res.ok, "status=", res.status);
    if (!res.ok) return null;
    const data = await res.json();
    console.log("[events] direct raw values=", data.values);
    if (!data.values) return [];
    return data.values
      .map((row) => {
        const [date, title, color, sheetColor, source] = row;
        if (!date || !title) return null;
        const item = { date: String(date), title: String(title) };
        if (color) item.color = String(color);
        if (sheetColor) item.sheetColor = String(sheetColor);
        if (source) item.source = String(source);
        return item;
      })
      .filter(Boolean);
  } catch (err) {
    console.log("[events] direct fetch threw", err);
    return null;
  }
}

async function apiGetEventsAppsScript() {
  try {
    const res = await fetch(`${API_URL}?data=events`);
    console.log("[events] apps-script fetch res.ok=", res.ok, "status=", res.status);
    if (!res.ok) return null;
    const json = await res.json();
    console.log("[events] apps-script data=", json);
    return json;
  } catch (err) {
    console.log("[events] apps-script fetch threw", err);
    return null;
  }
}

async function apiGetEvents() {
  const direct = await apiGetEventsDirect();
  if (direct) {
    console.log("[events] using direct source, count=", direct.length, direct.filter((e) => e.date === "2026-08-15"));
    const perDateCount = {};
    direct.forEach((e) => { perDateCount[e.date] = (perDateCount[e.date] || 0) + 1; });
    const dupes = Object.entries(perDateCount).filter(([, n]) => n > 1);
    console.log("[events] dates with >1 row in raw sheet data:", dupes);
    return direct;
  }
  const fallback = await apiGetEventsAppsScript();
  console.log("[events] using apps-script fallback, count=", fallback && fallback.length);
  return fallback;
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

function appendGenreTabLabel(btn, label, count) {
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const countEl = document.createElement("span");
  countEl.className = "genre-tab-count";
  countEl.textContent = count;
  btn.append(labelEl, countEl);
}

function renderGenreTabs(genres) {
  genreTabsMenu.innerHTML = "";

  const visibleSongs = (allSongs || []).filter((s) => !s.deletedFromLiveClip);

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "genre-tab" + (songbookGenre === "전체" ? " active" : "");
  allBtn.dataset.genre = "전체";
  appendGenreTabLabel(allBtn, "전체", visibleSongs.length);
  genreTabsMenu.appendChild(allBtn);

  genres.forEach((genre) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "genre-tab" + (songbookGenre === genre ? " active" : "");
    btn.dataset.genre = genre;
    const count = visibleSongs.filter((s) => s.genre === genre).length;
    appendGenreTabLabel(btn, genre, count);
    genreTabsMenu.appendChild(btn);
  });
}

function renderArtistList() {
  const inGenre = (allSongs || []).filter(
    (song) => !song.deletedFromLiveClip && (songbookGenre === "전체" || song.genre === songbookGenre)
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

function renderGenreTabs2(genres) {
  genre2Tabs.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "genre-tab" + (songbook2Genre === "전체" ? " active" : "");
  allBtn.dataset.genre = "전체";
  appendGenreTabLabel(allBtn, "전체", (allSongs || []).length);
  genre2Tabs.appendChild(allBtn);

  genres.forEach((genre) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "genre-tab" + (songbook2Genre === genre ? " active" : "");
    btn.dataset.genre = genre;
    const count = (allSongs || []).filter((s) => s.genre === genre).length;
    appendGenreTabLabel(btn, genre, count);
    genre2Tabs.appendChild(btn);
  });
}

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

function albumArtCacheKey(song) {
  return `${song.artist}|${song.title}`.toLowerCase();
}

const SONGBOOK_LOCAL_API_URL = "/api/songbook";

let localSongOverrides = {};
let localSongDeletions = new Set();
let songbookLocalDataPromise = null;

function ensureSongbookLocalData() {
  if (!songbookLocalDataPromise) {
    songbookLocalDataPromise = fetch(SONGBOOK_LOCAL_API_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        localSongOverrides = (data && data.overrides) || {};
        localSongDeletions = new Set((data && data.deletions) || []);
      })
      .catch(() => {
        localSongOverrides = {};
        localSongDeletions = new Set();
      });
  }
  return songbookLocalDataPromise;
}

async function saveSongbookLocalData() {
  const { username, password } = getStoredCreds();
  if (!username || !password) return;
  try {
    await fetch(SONGBOOK_LOCAL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        overrides: localSongOverrides,
        deletions: [...localSongDeletions],
      }),
    });
  } catch {
    // 네트워크 오류 시에도 로컬 상태는 이미 반영되어 있으므로 화면은 정상 동작
  }
}

let songSeqCounter = 0;
let songbookSongsPromise = null;
let songbookGenresList = [];

function ensureSongbookSongs() {
  if (!songbookSongsPromise) {
    songbookSongsPromise = Promise.all([fetchSongbookSongs(), ensureSongbookLocalData()]).then(([songs]) => {
      const merged = [];
      const seenKeys = new Set();

      songs.forEach((song) => {
        const key = albumArtCacheKey(song);
        if (localSongDeletions.has(key)) return;
        const finalSong = localSongOverrides[key] ? { ...localSongOverrides[key] } : song;
        finalSong.seq = songSeqCounter++;
        merged.push(finalSong);
        seenKeys.add(key);
      });

      Object.keys(localSongOverrides).forEach((key) => {
        if (seenKeys.has(key) || localSongDeletions.has(key)) return;
        const song = { ...localSongOverrides[key] };
        song.seq = songSeqCounter++;
        merged.push(song);
      });

      allSongs = merged;
      songByKey = {};
      allSongs.forEach((song) => {
        songByKey[albumArtCacheKey(song)] = song;
      });
      songbookGenresList = [...new Set(allSongs.map((s) => s.genre))];
      renderGenreTabs(songbookGenresList);
      renderGenreTabs2(songbookGenresList);
      return allSongs;
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
  renderSongGrid();
  renderFavoritesList();
  renderArtistList();
  await ensureAlbumArtPreloaded();
}

function buildClipPageUrl(clipId) {
  return `https://vod.sooplive.com/player/${clipId}/embed?type=catch&autoPlay=true&showChat=false&mutePlay=false`;
}

function updateSongPlayerModalFavBtn(key) {
  const fav = isSongFavorite(key);
  songPlayerModalFavIcon.classList.toggle("active", fav);
  songPlayerModalFavLabel.textContent = fav ? "즐겨찾기 해제" : "즐겨찾기 추가";
}

function resetSongPlayerModalPosition() {
  songPlayerModal.style.position = "";
  songPlayerModal.style.left = "";
  songPlayerModal.style.top = "";
  songPlayerModal.style.width = "";
  songPlayerModal.style.margin = "";
  songPlayerModalBackdrop.classList.remove("minimized");
}

function openSongPlayerModal(song, clipId) {
  const key = albumArtCacheKey(song);
  songPlayerModalFrame.src = buildClipPageUrl(clipId);
  songPlayerModalTitle.textContent = song.title;
  songPlayerModalArtist.textContent = song.artist;
  updateSongPlayerModalFavBtn(key);
  resetSongPlayerModalPosition();
  songPlayerModalBackdrop.classList.remove("hidden");
}

function closeSongPlayerModal() {
  clearTimeout(autoAdvanceTimer);
  songPlayerModalBackdrop.classList.add("hidden");
  songPlayerModalFrame.src = "";
}

function minimizeSongPlayerModal() {
  songPlayerModalBackdrop.classList.add("minimized");
}

let songPlayerInteracting = false;

songPlayerModalClose.addEventListener("click", closeSongPlayerModal);

songPlayerModalBackdrop.addEventListener("click", (e) => {
  if (songPlayerInteracting) return;
  if (e.target !== songPlayerModalBackdrop) return;
  minimizeSongPlayerModal();
});

songPlayerModal.addEventListener("click", () => {
  if (songPlayerInteracting) return;
  if (songPlayerModalBackdrop.classList.contains("minimized")) {
    songPlayerModalBackdrop.classList.remove("minimized");
  }
});

songPlayerModalFavBtn.addEventListener("click", () => {
  if (!currentSongKey) return;
  toggleSongFavorite(currentSongKey);
  updateSongPlayerModalFavBtn(currentSongKey);
  renderFavoritesList();
});

(function makeSongPlayerDraggable() {
  const handle = document.querySelector(".song-player-drag-handle");
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    songPlayerInteracting = true;
    const rect = songPlayerModal.getBoundingClientRect();
    songPlayerModal.style.position = "fixed";
    songPlayerModal.style.margin = "0";
    songPlayerModal.style.left = `${rect.left}px`;
    songPlayerModal.style.top = `${rect.top}px`;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const rect = songPlayerModal.getBoundingClientRect();
    let left = Math.min(Math.max(startLeft + dx, 0), window.innerWidth - rect.width);
    let top = Math.min(Math.max(startTop + dy, 0), window.innerHeight - rect.height);
    songPlayerModal.style.left = `${left}px`;
    songPlayerModal.style.top = `${top}px`;
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    setTimeout(() => { songPlayerInteracting = false; }, 0);
  });
})();

(function makeSongPlayerResizable() {
  const handles = document.querySelectorAll(".song-player-resize-handle");
  let resizing = false;
  let corner = null;
  let startX = 0;
  let startWidth = 0;
  let startLeft = 0;

  handles.forEach((handleEl) => {
    handleEl.addEventListener("mousedown", (e) => {
      resizing = true;
      songPlayerInteracting = true;
      corner = handleEl.dataset.corner;
      const rect = songPlayerModal.getBoundingClientRect();
      songPlayerModal.style.position = "fixed";
      songPlayerModal.style.margin = "0";
      songPlayerModal.style.left = `${rect.left}px`;
      songPlayerModal.style.top = `${rect.top}px`;
      startX = e.clientX;
      startWidth = rect.width;
      startLeft = rect.left;
      e.preventDefault();
      e.stopPropagation();
    });
  });

  window.addEventListener("mousemove", (e) => {
    if (!resizing) return;
    const dx = e.clientX - startX;
    let newWidth;
    let newLeft = startLeft;

    if (corner === "ne" || corner === "se") {
      newWidth = startWidth + dx;
    } else {
      newWidth = startWidth - dx;
    }
    newWidth = Math.min(Math.max(newWidth, 320), window.innerWidth - 20);
    if (corner === "nw" || corner === "sw") {
      newLeft = startLeft + (startWidth - newWidth);
    }
    songPlayerModal.style.width = `${newWidth}px`;
    songPlayerModal.style.left = `${newLeft}px`;
  });

  window.addEventListener("mouseup", () => {
    if (!resizing) return;
    resizing = false;
    corner = null;
    setTimeout(() => { songPlayerInteracting = false; }, 0);
  });
})();

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

  currentClipId = clipId || null;
  currentSongKey = key;
  currentSong = song;

  if (!clipId) {
    playerNoClip.classList.remove("hidden");
    playerNoClipSong.textContent = `${song.title} - ${song.artist}`;
    closeSongPlayerModal();
    return;
  }

  playerNoClip.classList.add("hidden");

  openSongPlayerModal(song, clipId);
  scheduleAutoAdvance();
}

let songSortMode = "title"; // "artist" | "title"

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

function renderFavorites2List() {
  favorites2ListEl.innerHTML = "";

  const favSongs = songFavoritesOrder.map((key) => songByKey[key]).filter(Boolean);

  if (!favSongs.length) {
    const empty = document.createElement("p");
    empty.className = "favorites-empty";
    empty.textContent = "즐겨찾기한 곡이 없습니다.";
    favorites2ListEl.appendChild(empty);
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
      renderFavorites2List();
    });

    favorites2ListEl.appendChild(item);
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
  const duration = clipDurationMap[currentSongKey];
  console.log("[autoAdvance] duration for key:", duration, "clipDurationMap has", Object.keys(clipDurationMap || {}).length, "entries");
  if (!duration) return;
  const EARLY_STOP_MS = 1; // SOOP 추천영상이 뜨기 전에 미리 끊기 위한 여유분
  const LOAD_DELAY_COMPENSATION_MS = 2000; // 영상 로딩 시간만큼 타이머를 늦게 발동
  const fireAt = Math.max(10, duration - EARLY_STOP_MS + LOAD_DELAY_COMPENSATION_MS);
  console.log("[autoAdvance] timer set to fire in", fireAt, "ms");
  autoAdvanceTimer = setTimeout(() => {
    if (favoritesQueueActive) {
      console.log("[autoAdvance] timer fired, advancing queue");
      advanceFavoritesQueue();
    } else {
      console.log("[autoAdvance] timer fired, stopping clip early");
      songPlayerModalFrame.src = "";
    }
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

function buildSongCard(song, options) {
  const playable = !options || options.playable !== false;
  const onFavToggle = (options && options.onFavToggle) || renderFavoritesList;
  const checkbox = options && options.checkbox;

  const card = document.createElement("div");
  card.className = "song-card";

  const key = albumArtCacheKey(song);

  let checkboxEl = null;
  if (checkbox) {
    checkboxEl = document.createElement("input");
    checkboxEl.type = "checkbox";
    checkboxEl.className = "song-card-checkbox";
    checkboxEl.checked = checkbox.checked;
    checkboxEl.addEventListener("click", (e) => e.stopPropagation());
    checkboxEl.addEventListener("change", () => checkbox.onChange(key, checkboxEl.checked));
  }

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
    onFavToggle();
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

  card.appendChild(artEl);
  if (checkboxEl) {
    const titleRow = document.createElement("div");
    titleRow.className = "song-card-title-row";
    titleRow.append(checkboxEl, titleEl);
    card.append(titleRow, favBtn, artistEl, genreEl);
  } else {
    card.append(favBtn, titleEl, artistEl, genreEl);
  }
  if (playable) {
    card.addEventListener("click", () => playSong(song));
  } else {
    card.classList.add("song-card-static");
  }

  artEl.src = (thumbMap && thumbMap[key]) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

  return card;
}

function renderSongGrid() {
  const query = songSearchInput.value.trim().toLowerCase();

  const filtered = (allSongs || []).filter((song) => {
    if (song.deletedFromLiveClip) return false;
    if (!(thumbMap && thumbMap[albumArtCacheKey(song)])) return false;
    if (songbookGenre !== "전체" && song.genre !== songbookGenre) return false;
    if (songbookArtist !== "전체" && song.artist !== songbookArtist) return false;
    if (query && !song.title.toLowerCase().includes(query) && !song.artist.toLowerCase().includes(query)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const field = songSortMode === "title" ? "title" : "artist";
    return a[field].localeCompare(b[field], "ko");
  });

  document.getElementById("playerStats").textContent = `트랙 ${filtered.length}개`;

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

let songSource = "clip"; // "clip" | "youtube" | "playlist"
let youtubeSourceFilter = "전체";
const youtubeGroupCache = {};

const SORT_OPTIONS = {
  clip: [
    { value: "artist", label: "가수이름순" },
    { value: "title", label: "가나다순" },
  ],
  youtube: [
    { value: "전체", label: "전체" },
    { value: "단체 커버곡", label: "단체 커버곡" },
    { value: "노래 영상", label: "노래 영상" },
  ],
  playlist: [
    { value: "전체", label: "전체" },
    { value: "출근용", label: "출근용" },
    { value: "퇴근용", label: "퇴근용" },
  ],
};

function renderSortMenu() {
  const options = SORT_OPTIONS[songSource] || SORT_OPTIONS.clip;
  sortTabsMenu.innerHTML = "";
  options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "genre-tab" + (i === 0 ? " active" : "");
    btn.dataset.sortValue = opt.value;
    btn.textContent = opt.label;
    sortTabsMenu.appendChild(btn);
  });
}

async function loadYoutubeGroup(group) {
  if (youtubeGroupCache[group]) return youtubeGroupCache[group];
  try {
    const res = await fetch(`/api/youtube-playlist?group=${group}`);
    const data = await res.json();
    youtubeGroupCache[group] = data.items || [];
  } catch {
    youtubeGroupCache[group] = [];
  }
  return youtubeGroupCache[group];
}

function renderYoutubePlaylistGrid(songs) {
  const filtered = youtubeSourceFilter === "전체" ? songs : songs.filter((s) => s.source === youtubeSourceFilter);

  document.getElementById("playerStats").textContent = `트랙 ${filtered.length}개`;
  songGrid.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "song-empty";
    empty.textContent = "불러올 곡이 없습니다.";
    songGrid.appendChild(empty);
    return;
  }

  filtered.forEach((song) => {
    const card = document.createElement("a");
    card.className = "song-card";
    card.href = song.url;
    card.target = "_blank";
    card.rel = "noopener";

    const art = document.createElement("img");
    art.className = "song-card-art";
    art.alt = "";
    art.src = song.thumbnail;

    const titleEl = document.createElement("div");
    titleEl.className = "song-card-title";
    titleEl.textContent = song.title;

    const artistEl = document.createElement("div");
    artistEl.className = "song-card-artist";
    artistEl.textContent = song.artist;

    card.append(art, titleEl, artistEl);
    songGrid.appendChild(card);
  });
}

function switchSongSource(newSource) {
  document.querySelectorAll(".clip-source-slide").forEach((el) => el.classList.toggle("active", el.dataset.source === newSource));
  songSource = newSource;
  youtubeSourceFilter = "전체";
  genreTabsMenu.classList.add("hidden");
  sortTabsMenu.classList.add("hidden");
  renderSortMenu();

  if (songSource === "clip") {
    renderSongGrid();
  } else {
    document.getElementById("playerStats").textContent = "";
    songGrid.innerHTML = `<div class="song-empty">불러오는 중...</div>`;
    loadYoutubeGroup(songSource).then(renderYoutubePlaylistGrid);
  }
}

let clipSourceIndex = 0;
let clipSourceDragMoved = false;

function updateClipSourceTrackPosition() {
  const w = clipSourceCarousel.clientWidth;
  clipSourceTrack.style.transform = `translateX(${-clipSourceIndex * w}px)`;
}

function setClipSourceIndex(index) {
  clipSourceIndex = index;
  updateClipSourceTrackPosition();
  clipSourceDots.querySelectorAll(".back-menu-dot").forEach((dot, i) => dot.classList.toggle("active", i === index));
  const source = CLIP_SOURCE_ORDER[index];
  if (source !== songSource) switchSongSource(source);
}

function pickRandomSong() {
  if (!allSongs || !allSongs.length) return null;
  return allSongs[Math.floor(Math.random() * allSongs.length)];
}

function renderClipSourcePreviews() {
  CLIP_SOURCE_ORDER.forEach((source) => {
    const song = pickRandomSong();
    if (!song) return;
    const titleEl = document.getElementById(`clipSourceTitle-${source}`);
    const artistEl = document.getElementById(`clipSourceArtist-${source}`);
    const artEl = document.getElementById(`clipSourceArt-${source}`);
    if (titleEl) titleEl.textContent = song.title;
    if (artistEl) artistEl.textContent = song.artist;
    if (artEl) {
      const key = albumArtCacheKey(song);
      artEl.src = (thumbMap && thumbMap[key]) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
    }
  });
}

clipSourceTrack.querySelectorAll(".clip-source-slide").forEach((slide, index) => {
  slide.addEventListener("click", () => {
    if (clipSourceDragMoved) return;
    if (index === clipSourceIndex) {
      if (index === 0) genreTabsMenu.classList.toggle("hidden");
      return;
    }
    setClipSourceIndex(index);
  });
});

const clipSourceSongListOverlay = document.getElementById("clipSourceSongListOverlay");

function setSongListOpen(open) {
  clipSourceSongListOverlay.classList.toggle("hidden", !open);
  sortTabs.classList.toggle("hidden", !open);
}

document.querySelectorAll(".clip-source-chat-icon").forEach((icon) => {
  icon.addEventListener("pointerdown", (e) => e.stopPropagation());
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    setSongListOpen(clipSourceSongListOverlay.classList.contains("hidden"));
  });
});

document.addEventListener("click", (e) => {
  if (clipSourceSongListOverlay.classList.contains("hidden")) return;
  if (clipSourceSongListOverlay.contains(e.target)) return;
  if (sortTabs.contains(e.target)) return;
  setSongListOpen(false);
});

clipSourceSongListOverlay.addEventListener("dragstart", (e) => e.preventDefault());

(function makeClipSourceSongListSwipeable() {
  let dragging = false;
  let horizontal = false;
  let startX = 0;
  let startY = 0;

  clipSourceSongListOverlay.addEventListener("pointerdown", (e) => {
    dragging = true;
    horizontal = false;
    startX = e.clientX;
    startY = e.clientY;
  });

  clipSourceSongListOverlay.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      horizontal = true;
      clipSourceSongListOverlay.setPointerCapture(e.pointerId);
    }
    if (horizontal) e.preventDefault();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    if (horizontal) {
      const dx = e.clientX - startX;
      if (dx < -50 && clipSourceIndex < CLIP_SOURCE_ORDER.length - 1) {
        setClipSourceIndex(clipSourceIndex + 1);
      } else if (dx > 50 && clipSourceIndex > 0) {
        setClipSourceIndex(clipSourceIndex - 1);
      }
    }
    horizontal = false;
  }

  clipSourceSongListOverlay.addEventListener("pointerup", endDrag);
  clipSourceSongListOverlay.addEventListener("pointercancel", endDrag);
})();

(function makeClipSourceDraggable() {
  let dragging = false;
  let startX = 0;

  clipSourceTrack.addEventListener("pointerdown", (e) => {
    dragging = true;
    clipSourceDragMoved = false;
    startX = e.clientX;
    clipSourceTrack.setPointerCapture(e.pointerId);
  });

  clipSourceTrack.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) clipSourceDragMoved = true;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;

    if (clipSourceDragMoved && Math.abs(dx) > 50) {
      if (dx < 0 && clipSourceIndex < CLIP_SOURCE_ORDER.length - 1) {
        setClipSourceIndex(clipSourceIndex + 1);
        return;
      }
      if (dx > 0 && clipSourceIndex > 0) {
        setClipSourceIndex(clipSourceIndex - 1);
        return;
      }
    }
    updateClipSourceTrackPosition();
  }

  clipSourceTrack.addEventListener("pointerup", endDrag);
  clipSourceTrack.addEventListener("pointerleave", (e) => {
    if (dragging) endDrag(e);
  });
})();

renderSortMenu();

function getFilteredSongs2() {
  const query = song2SearchInput.value.trim().toLowerCase();

  const filtered = (allSongs || []).filter((song) => {
    if (songbook2Genre !== "전체" && song.genre !== songbook2Genre) return false;
    if (songbook2Artist !== "전체" && getArtistInitialGroup(song.artist) !== songbook2Artist) return false;
    if (query && !song.title.toLowerCase().includes(query) && !song.artist.toLowerCase().includes(query)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (songSortMode2 === "recent") return (b.seq || 0) - (a.seq || 0);
    const field = songSortMode2 === "title" ? "title" : "artist";
    return a[field].localeCompare(b[field], "ko");
  });

  return filtered;
}

function buildSongCardOptions2(song) {
  return {
    playable: false,
    onFavToggle: renderFavorites2List,
    checkbox: songManageMode
      ? {
          checked: selectedSongKeys.has(albumArtCacheKey(song)),
          onChange: toggleSongSelection,
        }
      : null,
  };
}

function renderSongGrid2() {
  const filtered = getFilteredSongs2();

  song2Grid.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "song-empty";
    empty.textContent = "곡이 없습니다.";
    song2Grid.appendChild(empty);
    return;
  }

  if (songSortMode2 !== "artist") {
    filtered.forEach((song) => song2Grid.appendChild(buildSongCard(song, buildSongCardOptions2(song))));
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
    song2Grid.appendChild(header);

    group.songs.forEach((song) => song2Grid.appendChild(buildSongCard(song, buildSongCardOptions2(song))));
  });
}

let currentMainView = "calendar";

function applyHomeMatchedHeight(el) {
  const width = el.getBoundingClientRect().width;
  if (!width) return;
  const mediaHeight = ((width - 6) * 4) / 3;
  el.style.height = `${mediaHeight + 55 + 6}px`;
}

new ResizeObserver((entries) => {
  entries.forEach((entry) => applyHomeMatchedHeight(entry.target));
}).observe(songbookView);
new ResizeObserver((entries) => {
  entries.forEach((entry) => applyHomeMatchedHeight(entry.target));
}).observe(cafePhotosView);

function showMainView(view) {
  if (view === "backmenu") hideBackMenuCalendar();
  appViewEl.classList.toggle("hidden", view !== "calendar");
  songbookView.classList.toggle("hidden", view !== "songbook");
  songbook2View.classList.toggle("hidden", view !== "songbook2");
  gameView.classList.toggle("hidden", view !== "game");
  backMenuView.classList.toggle("hidden", view !== "backmenu");
  cafePhotosView.classList.toggle("hidden", view !== "cafephotos");

  if (view === "songbook") applyHomeMatchedHeight(songbookView);
  if (view === "cafephotos") applyHomeMatchedHeight(cafePhotosView);
  sideNavEl.classList.toggle(
    "hidden",
    view === "backmenu" || view === "cafephotos" || view === "songbook" || view === "songbook2"
  );
  backToCalendarBtn.classList.toggle(
    "hidden",
    view === "backmenu" || view === "cafephotos" || view === "songbook" || view === "calendar"
  );

  if (currentMainView === "backmenu" && view !== "backmenu") {
    const openedViewEl = { songbook: songbookView, songbook2: songbook2View, cafephotos: cafePhotosView }[view];
    if (openedViewEl) {
      openedViewEl.classList.remove("view-opening");
      void openedViewEl.offsetWidth;
      openedViewEl.classList.add("view-opening");
    }
  }
  currentMainView = view;
}

async function openSongbook() {
  showMainView("songbook");

  if (!allSongs) {
    songGrid.innerHTML = `<div class="song-empty">불러오는 중...</div>`;
    await ensureSongbookSongs();
  }

  await ensureAlbumArtPreloaded();

  renderSongGrid();
  renderFavoritesList();
  renderArtistList();
  renderClipSourcePreviews();
}

async function openSongbook2() {
  showMainView("songbook2");

  if (!allSongs) {
    song2Grid.innerHTML = `<div class="song-empty">불러오는 중...</div>`;
    await ensureSongbookSongs();
  }

  renderSongGrid2();
  renderFavorites2List();
  renderSingQueueList();
  renderArtistList2();
}

document.getElementById("calendarBtn").addEventListener("click", () => showMainView("backmenu"));

const backToCalendarBtn = document.getElementById("backToCalendarBtn");
backToCalendarBtn.addEventListener("click", () => showMainView("backmenu"));
const backMenuMedia = document.getElementById("backMenuMedia");
const backMenuDots = document.getElementById("backMenuDots");
const backMenuCalendarBox = document.getElementById("backMenuCalendarBox");
const backMenuCalendarBody = document.getElementById("backMenuCalendarBody");

function showBackMenuCalendar() {
  const clone = document.querySelector(".app").cloneNode(true);
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  clone.addEventListener("click", () => showMainView("calendar"));
  backMenuCalendarBody.innerHTML = "";
  backMenuCalendarBody.appendChild(clone);

  const now = new Date();
  document.getElementById("backMenuTodayDate").textContent = `${now.getMonth() + 1}월 ${now.getDate()}일`;

  const todayEvents = loadEvents()[todayKey()] || [];
  document.getElementById("backMenuTodaySchedule").textContent = todayEvents.length
    ? " " + todayEvents.map((ev) => ev.title).join(", ")
    : " 오늘은 일정이 없습니다";

  backMenuMedia.classList.add("hidden");
  backMenuCalendarBox.classList.remove("hidden");
}

function hideBackMenuCalendar() {
  backMenuCalendarBox.classList.add("hidden");
  backMenuMedia.classList.remove("hidden");
  backMenuCalendarBody.innerHTML = "";
}

const backMenuMediaTrack = document.getElementById("backMenuMediaTrack");
const backMenuDotEls = backMenuDots.querySelectorAll(".back-menu-dot");
let backMenuSlideIndex = 0;

function updateBackMenuSlide() {
  const w = backMenuMedia.clientWidth;
  backMenuMediaTrack.style.transform = `translateX(${-backMenuSlideIndex * w}px)`;
  backMenuDotEls.forEach((dot, i) => dot.classList.toggle("active", i === backMenuSlideIndex));
}

(function makeBackMenuMediaDraggable() {
  let dragging = false;
  let dragMoved = false;
  let startX = 0;

  backMenuMediaTrack.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragMoved = false;
    startX = e.clientX;
    backMenuMediaTrack.setPointerCapture(e.pointerId);
    backMenuMediaTrack.style.transition = "none";
  });

  backMenuMediaTrack.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) dragMoved = true;
    const w = backMenuMedia.clientWidth;
    backMenuMediaTrack.style.transform = `translateX(${-backMenuSlideIndex * w + dx}px)`;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    backMenuMediaTrack.style.transition = "";

    if (dragMoved && Math.abs(dx) > 50) {
      if (dx < 0 && backMenuSlideIndex < 1) backMenuSlideIndex += 1;
      else if (dx > 0 && backMenuSlideIndex > 0) backMenuSlideIndex -= 1;
    }
    updateBackMenuSlide();
  }

  backMenuMediaTrack.addEventListener("pointerup", endDrag);
  backMenuMediaTrack.addEventListener("pointerleave", (e) => {
    if (dragging) endDrag(e);
  });
})();

document.getElementById("backMenuCalendarBtn").addEventListener("click", () => {
  if (backMenuCalendarBox.classList.contains("hidden")) {
    showBackMenuCalendar();
  } else {
    hideBackMenuCalendar();
  }
});
document.getElementById("backMenuSongbookBtn").addEventListener("click", openSongbook2);
document.getElementById("backMenuPlaylistBtn").addEventListener("click", openSongbook);
document.getElementById("backMenuMailBtn").addEventListener("click", openSoopChatPanel);
document.getElementById("backMenuNavHomeBtn").addEventListener("click", () => showMainView("backmenu"));

const backMenuHamburgerBtn = document.getElementById("backMenuHamburgerBtn");
const backMenuNavMenu = document.getElementById("backMenuNavMenu");
backMenuHamburgerBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  backMenuNavMenu.classList.toggle("hidden");
});
backMenuNavMenu.addEventListener("click", (e) => {
  if (e.target.closest(".back-menu-nav-item")) backMenuNavMenu.classList.add("hidden");
});
document.addEventListener("click", (e) => {
  if (!backMenuNavMenu.classList.contains("hidden") && !backMenuNavMenu.contains(e.target) && e.target !== backMenuHamburgerBtn) {
    backMenuNavMenu.classList.add("hidden");
  }
});

function wireNavMenu(prefix, hamburgerId, menuId) {
  const hamburgerBtn = document.getElementById(hamburgerId);
  const menu = document.getElementById(menuId);
  hamburgerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });
  menu.addEventListener("click", (e) => {
    if (e.target.closest(".back-menu-nav-item")) menu.classList.add("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("hidden") && !menu.contains(e.target) && e.target !== hamburgerBtn) {
      menu.classList.add("hidden");
    }
  });
  document.getElementById(`${prefix}HomeBtn`).addEventListener("click", () => showMainView("backmenu"));
  document.getElementById(`${prefix}CalendarBtn`).addEventListener("click", () => showMainView("calendar"));
  document.getElementById(`${prefix}PlaylistBtn`).addEventListener("click", openSongbook);
  document.getElementById(`${prefix}PostsBtn`).addEventListener("click", () => {
    switchCafePhotosTab(cafePhotosTabEls[0], { menuId: "27", titleContains: "" });
    showMainView("cafephotos");
  });
  document.getElementById(`${prefix}SongbookBtn`).addEventListener("click", openSongbook2);
  document.getElementById(`${prefix}MailBtn`).addEventListener("click", openMemoPanel);
}

wireNavMenu("cafePhotosNav", "cafePhotosHamburgerBtn", "cafePhotosNavMenu");
wireNavMenu("songbookNav", "songbookHamburgerBtn", "songbookNavMenu");

const cafePhotosList = document.getElementById("cafePhotosList");

const cafePhotosProfileMenuBtn = document.getElementById("cafePhotosProfileMenuBtn");
const cafePhotosProfileMenu = document.getElementById("cafePhotosProfileMenu");
cafePhotosProfileMenuBtn.addEventListener("click", () => {
  cafePhotosProfileMenu.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!cafePhotosProfileMenuBtn.contains(e.target) && !cafePhotosProfileMenu.contains(e.target)) {
    cafePhotosProfileMenu.classList.add("hidden");
  }
});

const cafePhotoLightbox = document.getElementById("cafePhotoLightbox");
const cafePhotoLightboxImg = document.getElementById("cafePhotoLightboxImg");
const cafePhotoLightboxLink = document.getElementById("cafePhotoLightboxLink");
const cafePhotoPostEl = document.querySelector(".cafe-photo-post");
const cafePhotoLikes = document.getElementById("cafePhotoLikes");
const cafePhotoWriter = document.getElementById("cafePhotoWriter");
const cafePhotoTitle = document.getElementById("cafePhotoTitle");
const cafePhotoMenuBtn = document.getElementById("cafePhotoMenuBtn");
const cafePhotoMenu = document.getElementById("cafePhotoMenu");

function closeCafePhotoLightbox() {
  cafePhotoLightbox.classList.add("hidden");
  cafePhotoPostEl.classList.remove("zoomed");
  cafePhotoMenu.classList.add("hidden");
}
cafePhotoLightbox.addEventListener("click", (e) => {
  if (e.target === cafePhotoLightbox) closeCafePhotoLightbox();
});
document.getElementById("cafePhotoCloseBtn").addEventListener("click", closeCafePhotoLightbox);

cafePhotoMenuBtn.addEventListener("click", () => {
  cafePhotoMenu.classList.toggle("hidden");
});

document.getElementById("cafePhotoGotoPostBtn").addEventListener("click", () => {
  const item = cafePhotoItems[cafePhotoIndex];
  if (item) window.open(item.url, "_blank", "noopener");
  cafePhotoMenu.classList.add("hidden");
});

document.addEventListener("click", (e) => {
  if (!cafePhotoMenuBtn.contains(e.target) && !cafePhotoMenu.contains(e.target)) {
    cafePhotoMenu.classList.add("hidden");
  }
});

let cafePhotoItems = [];
let cafePhotoIndex = 0;

function renderCafePhotoLightbox() {
  const item = cafePhotoItems[cafePhotoIndex];
  if (!item) return;
  cafePhotoLightboxImg.src = `/api/naver-image?url=${encodeURIComponent(item.image)}`;
  cafePhotoLikes.textContent = `좋아요 ${(item.likeCount || 0).toLocaleString()}개`;
  cafePhotoWriter.textContent = item.writer || "";
  cafePhotoTitle.textContent = item.title || "";
}

function openCafePhotoLightbox(items, index) {
  cafePhotoItems = items;
  cafePhotoIndex = index;
  cafePhotoPostEl.classList.remove("zoomed");
  renderCafePhotoLightbox();
  cafePhotoLightbox.classList.remove("hidden");
}

(function makeCafePhotoLightboxDraggable() {
  let dragging = false;
  let dragMoved = false;
  let startX = 0;

  cafePhotoLightboxImg.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragMoved = false;
    startX = e.clientX;
    cafePhotoLightboxImg.setPointerCapture(e.pointerId);
    cafePhotoLightboxImg.style.transition = "none";
  });

  cafePhotoLightboxImg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) dragMoved = true;
    cafePhotoLightboxImg.style.transform = `translateX(${dx}px)`;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    cafePhotoLightboxImg.style.transition = "";
    cafePhotoLightboxImg.style.transform = "";

    if (dragMoved && Math.abs(dx) > 50) {
      if (dx < 0 && cafePhotoIndex < cafePhotoItems.length - 1) {
        cafePhotoIndex += 1;
        renderCafePhotoLightbox();
      } else if (dx > 0 && cafePhotoIndex > 0) {
        cafePhotoIndex -= 1;
        renderCafePhotoLightbox();
      }
    }
  }

  cafePhotoLightboxImg.addEventListener("pointerup", endDrag);
  cafePhotoLightboxImg.addEventListener("pointerleave", (e) => {
    if (dragging) endDrag(e);
  });

  cafePhotoLightboxLink.addEventListener("click", () => {
    if (dragMoved) return;
    cafePhotoPostEl.classList.toggle("zoomed");
  });
})();

let cafePhotosPage = 1;
let cafePhotosLoading = false;
let cafePhotosHasMore = true;
let cafePhotosAllItems = [];
let cafePhotosSource = { menuId: "27", titleContains: "" };

async function loadCafePhotosPage() {
  if (cafePhotosLoading || !cafePhotosHasMore) return;
  cafePhotosLoading = true;

  try {
    const params = new URLSearchParams({ page: cafePhotosPage, menuId: cafePhotosSource.menuId });
    if (cafePhotosSource.titleContains) params.set("titleContains", cafePhotosSource.titleContains);
    const res = await fetch(`/api/cafe-photos?${params}`);
    const data = await res.json();
    const items = data.items || [];
    cafePhotosHasMore = Boolean(data.hasMore);
    cafePhotosPage += 1;

    items.forEach((item) => {
      const index = cafePhotosAllItems.length;
      cafePhotosAllItems.push(item);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "cafe-photo-card";

      const img = document.createElement("img");
      img.className = "cafe-photo-img";
      img.src = `/api/naver-image?url=${encodeURIComponent(item.image)}`;
      img.alt = "";
      card.appendChild(img);

      card.addEventListener("click", () => openCafePhotoLightbox(cafePhotosAllItems, index));

      cafePhotosList.appendChild(card);
    });

    document.getElementById("cafePhotosPostCount").textContent = cafePhotosAllItems.length;

    if (!cafePhotosAllItems.length && !cafePhotosHasMore) {
      cafePhotosList.innerHTML = `<p class="cafe-photos-status">게시글을 불러오지 못했습니다.</p>`;
    }
  } catch {
    cafePhotosHasMore = false;
  } finally {
    cafePhotosLoading = false;
  }

  if (
    cafePhotosHasMore &&
    !cafePhotosView.classList.contains("hidden") &&
    cafePhotosList.scrollHeight <= cafePhotosList.clientHeight
  ) {
    loadCafePhotosPage();
  }
}

cafePhotosList.addEventListener("scroll", () => {
  if (cafePhotosView.classList.contains("hidden")) return;
  const nearBottom = cafePhotosList.scrollTop + cafePhotosList.clientHeight >= cafePhotosList.scrollHeight - 600;
  if (nearBottom) loadCafePhotosPage();
});

function switchCafePhotosTab(tabEl, source) {
  document.querySelectorAll(".cafe-photos-tab").forEach((el) => el.classList.toggle("active", el === tabEl));
  cafePhotosSource = source;
  cafePhotosPage = 1;
  cafePhotosLoading = false;
  cafePhotosHasMore = true;
  cafePhotosAllItems = [];
  cafePhotosList.innerHTML = "";
  loadCafePhotosPage();
}

const cafePhotosTabEls = document.querySelectorAll(".cafe-photos-tab");
cafePhotosTabEls[0].addEventListener("click", () =>
  switchCafePhotosTab(cafePhotosTabEls[0], { menuId: "27", titleContains: "" })
);
cafePhotosTabEls[1].addEventListener("click", () =>
  switchCafePhotosTab(cafePhotosTabEls[1], { menuId: "36", titleContains: "움짤" })
);
cafePhotosTabEls[2].addEventListener("click", () =>
  switchCafePhotosTab(cafePhotosTabEls[2], { menuId: "28", titleContains: "" })
);

document.getElementById("backMenuPostsBtn").addEventListener("click", () => {
  switchCafePhotosTab(cafePhotosTabEls[0], { menuId: "27", titleContains: "" });
  showMainView("cafephotos");
});
function syncGameViewHeight() {
  const wasHidden = songbookView.classList.contains("hidden");
  if (wasHidden) songbookView.classList.remove("hidden");
  const h = songbookView.offsetHeight;
  if (wasHidden) songbookView.classList.add("hidden");
  if (h > 0) gameView.style.minHeight = `${Math.max(0, h - 100)}px`;
}



const MEMO_KEY = "ddarin-memo-2026";
const memoBtn = document.getElementById("memoBtn");
const memoPanel = document.getElementById("memoPanel");
const memoOverlay = document.getElementById("memoOverlay");
const closeMemoBtn = document.getElementById("closeMemoBtn");
const memoTabPersonal = document.getElementById("memoTabPersonal");
const memoTabShared = document.getElementById("memoTabShared");
const memoAddToggleBtn = document.getElementById("memoAddToggleBtn");
const memoPersonalSection = document.getElementById("memoPersonalSection");
const memoSharedSection = document.getElementById("memoSharedSection");
const memoPersonalList = document.getElementById("memoPersonalList");
const memoSharedList = document.getElementById("memoSharedList");
const memoAddModalBackdrop = document.getElementById("memoAddModalBackdrop");
const memoAddModalTitle = document.getElementById("memoAddModalTitle");
const memoAddForm = document.getElementById("memoAddForm");
const memoAddDateInput = document.getElementById("memoAddDateInput");
const memoAddTitleInput = document.getElementById("memoAddTitleInput");
const memoAddFieldsGrid = document.getElementById("memoAddFieldsGrid");
const memoAddMoreBtn = document.getElementById("memoAddMoreBtn");
const closeMemoAddModalBtn = document.getElementById("closeMemoAddModalBtn");

const todayMemoModalBackdrop = document.getElementById("todayMemoModalBackdrop");
const todayMemoModalList = document.getElementById("todayMemoModalList");
const todayMemoHideTodayBtn = document.getElementById("todayMemoHideTodayBtn");
const todayMemoCloseBtn = document.getElementById("todayMemoCloseBtn");
const closeTodayMemoModalBtn = document.getElementById("closeTodayMemoModalBtn");
const TODAY_MEMO_POPUP_DISMISS_KEY = "today-memo-popup-dismissed";
let todayMemoPopupOnDone = null;
let todayMemoPopupIds = [];

function loadMemoDismissMap() {
  try {
    return JSON.parse(localStorage.getItem(TODAY_MEMO_POPUP_DISMISS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMemoDismissMap(map) {
  localStorage.setItem(TODAY_MEMO_POPUP_DISMISS_KEY, JSON.stringify(map));
}

function closeTodayMemoModal() {
  todayMemoModalBackdrop.classList.add("hidden");
  const onDone = todayMemoPopupOnDone;
  todayMemoPopupOnDone = null;
  if (onDone) onDone();
}

function showTodayMemoPopupIfNeeded(onDone) {
  const today = todayKey();
  const dismissMap = loadMemoDismissMap();
  const todaysMemos = sharedMemoItems.filter((item) => {
    if (item.date !== today) return false;
    const dismissedUntil = dismissMap[item.id];
    return !(dismissedUntil && dismissedUntil >= today);
  });

  if (!todaysMemos.length) {
    if (onDone) onDone();
    return;
  }

  todayMemoPopupIds = todaysMemos.map((item) => item.id);
  todayMemoPopupOnDone = onDone || null;
  renderMemoCards(todayMemoModalList, todaysMemos, false, null, null);
  todayMemoModalBackdrop.classList.remove("hidden");
}

closeTodayMemoModalBtn.addEventListener("click", closeTodayMemoModal);
todayMemoCloseBtn.addEventListener("click", closeTodayMemoModal);
todayMemoHideTodayBtn.addEventListener("click", () => {
  const dismissMap = loadMemoDismissMap();
  const today = todayKey();
  todayMemoPopupIds.forEach((id) => {
    dismissMap[id] = today;
  });
  saveMemoDismissMap(dismissMap);
  closeTodayMemoModal();
});
todayMemoModalBackdrop.addEventListener("click", (e) => {
  if (e.target === todayMemoModalBackdrop) closeTodayMemoModal();
});

const TODAY_YOUTUBE_POPUP_API_URL = "/api/youtube-recent";
const YOUTUBE_POPUP_DISMISS_KEY = "today-youtube-popup-dismissed";
const YOUTUBE_POPUP_WINDOW_DAYS = 3;

const todayYoutubeModalBackdrop = document.getElementById("todayYoutubeModalBackdrop");
const todayYoutubeModalList = document.getElementById("todayYoutubeModalList");
const todayYoutubeHideTodayBtn = document.getElementById("todayYoutubeHideTodayBtn");
const todayYoutubeHideWeekBtn = document.getElementById("todayYoutubeHideWeekBtn");
const todayYoutubeCloseBtn = document.getElementById("todayYoutubeCloseBtn");
const closeTodayYoutubeModalBtn = document.getElementById("closeTodayYoutubeModalBtn");

let todayYoutubePopupVideoIds = [];

function loadYoutubeDismissMap() {
  try {
    return JSON.parse(localStorage.getItem(YOUTUBE_POPUP_DISMISS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveYoutubeDismissMap(map) {
  localStorage.setItem(YOUTUBE_POPUP_DISMISS_KEY, JSON.stringify(map));
}

function formatYoutubeDateLabel(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function renderTodayYoutubeList(videos) {
  todayYoutubeModalList.innerHTML = "";
  videos.forEach((v) => {
    const item = document.createElement("a");
    item.className = "today-video-item";
    item.href = v.url;
    item.target = "_blank";
    item.rel = "noopener";

    const dateEl = document.createElement("div");
    dateEl.className = "today-video-date";
    dateEl.textContent = formatYoutubeDateLabel(v.published);

    const titleEl = document.createElement("div");
    titleEl.className = "today-video-title";
    titleEl.textContent = v.title;

    const thumb = document.createElement("img");
    thumb.className = "today-video-thumb";
    thumb.src = v.thumbnail;
    thumb.alt = "";

    item.append(dateEl, titleEl, thumb);
    todayYoutubeModalList.appendChild(item);
  });
}

async function showTodayYoutubePopupIfNeeded() {
  let videos = [];
  try {
    const res = await fetch(TODAY_YOUTUBE_POPUP_API_URL);
    videos = res.ok ? await res.json() : [];
  } catch {
    videos = [];
  }

  const cutoff = Date.now() - YOUTUBE_POPUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const dismissMap = loadYoutubeDismissMap();
  const today = todayKey();

  const recent = (videos || []).filter((v) => {
    if (!v.published || new Date(v.published).getTime() < cutoff) return false;
    const dismissedUntil = dismissMap[v.id];
    if (dismissedUntil && dismissedUntil >= today) return false;
    return true;
  });

  if (!recent.length) return;

  todayYoutubePopupVideoIds = recent.map((v) => v.id);
  renderTodayYoutubeList(recent);
  todayYoutubeModalBackdrop.classList.remove("hidden");
}

function closeTodayYoutubeModal() {
  todayYoutubeModalBackdrop.classList.add("hidden");
}

function dismissTodayYoutubePopup(days) {
  const dismissMap = loadYoutubeDismissMap();
  const until = new Date();
  until.setDate(until.getDate() + days);
  const untilKey = dateKey(until.getFullYear(), until.getMonth(), until.getDate());
  todayYoutubePopupVideoIds.forEach((id) => {
    dismissMap[id] = untilKey;
  });
  saveYoutubeDismissMap(dismissMap);
  closeTodayYoutubeModal();
}

closeTodayYoutubeModalBtn.addEventListener("click", closeTodayYoutubeModal);
todayYoutubeCloseBtn.addEventListener("click", closeTodayYoutubeModal);
todayYoutubeHideTodayBtn.addEventListener("click", () => dismissTodayYoutubePopup(0));
todayYoutubeHideWeekBtn.addEventListener("click", () => dismissTodayYoutubePopup(7));
todayYoutubeModalBackdrop.addEventListener("click", (e) => {
  if (e.target === todayYoutubeModalBackdrop) closeTodayYoutubeModal();
});

let memoAddExtraRowCount = 0;

function clearMemoExtraTitleRows() {
  memoAddFieldsGrid.querySelectorAll(".memo-add-extra-input, .memo-add-extra-remove, .memo-add-extra-spacer").forEach((el) => el.remove());
  memoAddExtraRowCount = 0;
}

function addMemoExtraTitleRow() {
  memoAddExtraRowCount += 1;
  const row = memoAddExtraRowCount + 1; // row 1 = 날짜/제목 기본 행

  const spacer = document.createElement("span");
  spacer.className = "memo-add-extra-spacer";
  spacer.style.gridColumn = "1";
  spacer.style.gridRow = String(row);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "memo-add-modal-input memo-add-extra-input";
  input.placeholder = "메모 제목";
  input.maxLength = 200;
  input.style.gridColumn = "2";
  input.style.gridRow = String(row);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "memo-add-extra-remove";
  removeBtn.textContent = "✕";
  removeBtn.style.gridColumn = "3";
  removeBtn.style.gridRow = String(row);
  removeBtn.addEventListener("click", () => {
    spacer.remove();
    input.remove();
    removeBtn.remove();
  });

  memoAddFieldsGrid.append(spacer, input, removeBtn);
  input.focus();
}

memoAddMoreBtn.addEventListener("click", addMemoExtraTitleRow);

const SHARED_MEMO_API_URL = "/api/memo";
let sharedMemoItems = [];
let editingMemoId = null;
let editingMemoIsShared = false;

function openMemoEditModal(item, isShared) {
  editingMemoId = item.id;
  editingMemoIsShared = isShared;
  memoAddModalTitle.textContent = "메모 수정";
  memoAddDateInput.value = item.date || "";
  memoAddTitleInput.value = item.text || "";
  clearMemoExtraTitleRows();
  memoAddModalBackdrop.classList.remove("hidden");
  memoAddTitleInput.focus();
}

function mergeMemoText(existingText, newTexts) {
  return [existingText, ...newTexts].filter(Boolean).join("\n");
}

async function addSharedMemoTexts(texts, date) {
  const { username, password } = getStoredCreds();
  if (!username || !password) return;

  if (date) {
    const existing = sharedMemoItems.find((it) => it.date === date);
    const action = existing ? "edit" : "add";
    const text = existing ? mergeMemoText(existing.text, texts) : texts.join("\n");
    const res = await fetch(SHARED_MEMO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        existing
          ? { username, password, action, id: existing.id, text, date }
          : { username, password, action, text, date }
      ),
    });
    const data = await res.json().catch(() => null);
    if (data && data.items) sharedMemoItems = data.items;
    renderSharedMemoList();
    return;
  }

  for (const t of texts) {
    const res = await fetch(SHARED_MEMO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, action: "add", text: t, date }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.items) sharedMemoItems = data.items;
  }
  renderSharedMemoList();
}

function addPersonalMemoTexts(texts, date) {
  const items = loadPersonalMemoItems();
  if (date) {
    const existing = items.find((it) => it.date === date);
    if (existing) {
      existing.text = mergeMemoText(existing.text, texts);
    } else {
      items.unshift({ id: Date.now(), text: texts.join("\n"), date });
    }
  } else {
    texts.forEach((t, i) => items.unshift({ id: Date.now() + i, text: t, date }));
  }
  savePersonalMemoItems(items);
  renderPersonalMemoList();
}

function closeMemoAddModal() {
  memoAddModalBackdrop.classList.add("hidden");
  editingMemoId = null;
}

function updateMemoAddToggleState() {
  const onShared = memoTabShared.classList.contains("active");
  memoAddToggleBtn.disabled = onShared && isReadOnly;
}

function showMemoTab(tab) {
  const showShared = tab === "shared";
  memoTabPersonal.classList.toggle("active", !showShared);
  memoTabShared.classList.toggle("active", showShared);
  memoPersonalSection.classList.toggle("hidden", showShared);
  memoSharedSection.classList.toggle("hidden", !showShared);
  updateMemoAddToggleState();
}

memoTabPersonal.addEventListener("click", () => showMemoTab("personal"));
memoTabShared.addEventListener("click", () => showMemoTab("shared"));

memoAddToggleBtn.addEventListener("click", () => {
  if (memoAddToggleBtn.disabled) return;
  editingMemoId = null;
  memoAddModalTitle.textContent = "메모 추가";
  memoAddDateInput.value = todayKey();
  memoAddTitleInput.value = "";
  clearMemoExtraTitleRows();
  memoAddModalBackdrop.classList.remove("hidden");
  memoAddTitleInput.focus();
});

closeMemoAddModalBtn.addEventListener("click", closeMemoAddModal);
memoAddModalBackdrop.addEventListener("click", (e) => {
  if (e.target === memoAddModalBackdrop) closeMemoAddModal();
});

memoAddForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = memoAddDateInput.value;
  const text = memoAddTitleInput.value.trim();
  if (!text) return;

  const extraTexts = Array.from(memoAddFieldsGrid.querySelectorAll(".memo-add-extra-input"))
    .map((el) => el.value.trim())
    .filter(Boolean);

  if (editingMemoId !== null) {
    const id = editingMemoId;
    const isShared = editingMemoIsShared;
    closeMemoAddModal();
    if (isShared) {
      const { username, password } = getStoredCreds();
      if (!username || !password) return;
      const res = await fetch(SHARED_MEMO_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, action: "edit", id, text, date }),
      });
      const data = await res.json().catch(() => null);
      if (data && data.items) sharedMemoItems = data.items;
      if (extraTexts.length) await addSharedMemoTexts(extraTexts, date);
      else renderSharedMemoList();
    } else {
      const items = loadPersonalMemoItems().map((it) => (it.id === id ? { ...it, text, date } : it));
      savePersonalMemoItems(items);
      if (extraTexts.length) addPersonalMemoTexts(extraTexts, date);
      else renderPersonalMemoList();
    }
    return;
  }

  const allTexts = [text, ...extraTexts];
  const onShared = memoTabShared.classList.contains("active");
  if (onShared) {
    if (isReadOnly) return;
    const { username, password } = getStoredCreds();
    if (!username || !password) return;
    closeMemoAddModal();
    await addSharedMemoTexts(allTexts, date);
  } else {
    closeMemoAddModal();
    addPersonalMemoTexts(allTexts, date);
  }
});

let draggedMemoId = null;

function groupMemoItemsByDate(items) {
  const order = [];
  const buckets = new Map();
  items.forEach((item) => {
    const key = item.date || `__nodate_${item.id}`;
    if (!buckets.has(key)) {
      buckets.set(key, { date: item.date || null, items: [] });
      order.push(key);
    }
    buckets.get(key).items.push(item);
  });
  return order.map((key) => buckets.get(key));
}

function formatMemoDateLabel(dateStr) {
  const parts = (dateStr || "").split("-");
  if (parts.length !== 3) return dateStr || "";
  const [, m, d] = parts;
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function buildMemoItemCard(item, canDelete, onDelete, onEdit, onReorder, orderedItems) {
  const card = document.createElement("div");
  card.className = "memo-card";

  const textEl = document.createElement("div");
  textEl.className = "memo-card-text";
  const lines = (item.text || "").split("\n").filter((line) => line.length);
  const multi = lines.length > 1;
  lines.forEach((line, i) => {
    const lineEl = document.createElement("div");
    lineEl.className = "memo-card-line";
    lineEl.textContent = multi ? `${i + 1}. ${line}` : line;
    textEl.appendChild(lineEl);
  });
  card.appendChild(textEl);

  if (onEdit) {
    card.addEventListener("dblclick", () => onEdit(item));
  }

  if (canDelete) {
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "memo-card-delete";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onDelete(item.id);
    });
    card.appendChild(delBtn);
  }

  if (onReorder) {
    card.draggable = true;
    card.addEventListener("dragstart", () => {
      draggedMemoId = item.id;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      draggedMemoId = null;
      card.classList.remove("dragging");
    });
    card.addEventListener("dragover", (e) => e.preventDefault());
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      if (draggedMemoId === null || draggedMemoId === item.id) return;
      const fromIdx = orderedItems.findIndex((it) => it.id === draggedMemoId);
      const toIdx = orderedItems.findIndex((it) => it.id === item.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const reordered = orderedItems.slice();
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      onReorder(reordered);
    });
  }

  return card;
}

function renderMemoCards(listEl, items, canDelete, onDelete, onEdit, onReorder) {
  listEl.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "memo-card-empty";
    empty.textContent = "메모가 없습니다.";
    listEl.appendChild(empty);
    return;
  }

  const groups = groupMemoItemsByDate(items);
  const orderedItems = groups.flatMap((g) => g.items);

  groups.forEach((group) => {
    if (!group.date) {
      group.items.forEach((item) => {
        listEl.appendChild(buildMemoItemCard(item, canDelete, onDelete, onEdit, onReorder, orderedItems));
      });
      return;
    }

    const row = document.createElement("div");
    row.className = "memo-group";

    const dateEl = document.createElement("div");
    dateEl.className = "memo-group-date";
    dateEl.textContent = formatMemoDateLabel(group.date);
    row.appendChild(dateEl);

    const itemsCol = document.createElement("div");
    itemsCol.className = "memo-group-items";
    group.items.forEach((item) => {
      itemsCol.appendChild(buildMemoItemCard(item, canDelete, onDelete, onEdit, onReorder, orderedItems));
    });
    row.appendChild(itemsCol);

    listEl.appendChild(row);
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
  renderMemoCards(
    memoPersonalList,
    loadPersonalMemoItems(),
    true,
    (id) => {
      savePersonalMemoItems(loadPersonalMemoItems().filter((it) => it.id !== id));
      renderPersonalMemoList();
    },
    (item) => openMemoEditModal(item, false),
    (reorderedItems) => {
      savePersonalMemoItems(reorderedItems);
      renderPersonalMemoList();
    }
  );
}

function renderSharedMemoList() {
  renderMemoCards(
    memoSharedList,
    sharedMemoItems,
    !isReadOnly,
    async (id) => {
      const { username, password } = getStoredCreds();
      if (!username || !password) return;
      const res = await fetch(SHARED_MEMO_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, action: "delete", id }),
      });
      const data = await res.json().catch(() => null);
      if (data && data.items) sharedMemoItems = data.items;
      renderSharedMemoList();
    },
    isReadOnly ? null : (item) => openMemoEditModal(item, true),
    isReadOnly
      ? null
      : async (reorderedItems) => {
          const { username, password } = getStoredCreds();
          if (!username || !password) return;
          sharedMemoItems = reorderedItems;
          renderSharedMemoList();
          const res = await fetch(SHARED_MEMO_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              password,
              action: "reorder",
              order: reorderedItems.map((it) => it.id),
            }),
          });
          const data = await res.json().catch(() => null);
          if (data && data.items) {
            sharedMemoItems = data.items;
            renderSharedMemoList();
          }
        }
  );
}

async function loadSharedMemoList() {
  if (sharedMemoItems.length) {
    renderSharedMemoList();
  } else {
    memoSharedList.innerHTML = `<div class="memo-card-empty">불러오는 중...</div>`;
  }
  try {
    const res = await fetch(SHARED_MEMO_API_URL);
    const data = await res.json();
    sharedMemoItems = (data && data.items) || [];
  } catch {
    if (!sharedMemoItems.length) sharedMemoItems = [];
  }
  renderSharedMemoList();
}

function openMemoPanel() {
  renderPersonalMemoList();
  showMemoTab("shared");
  loadSharedMemoList();
  memoPanel.classList.remove("hidden");
  memoOverlay.classList.remove("hidden");
}

function closeMemoPanel() {
  memoPanel.classList.add("hidden");
  memoOverlay.classList.add("hidden");
}

closeMemoBtn.addEventListener("click", closeMemoPanel);
memoOverlay.addEventListener("click", closeMemoPanel);

const soopChatOverlay = document.getElementById("soopChatOverlay");
const soopChatPanel = document.getElementById("soopChatPanel");
const soopChatList = document.getElementById("soopChatList");
const closeSoopChatBtn = document.getElementById("closeSoopChatBtn");

function formatSoopChatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

async function openSoopChatPanel() {
  soopChatPanel.classList.remove("hidden");
  soopChatOverlay.classList.remove("hidden");
  soopChatList.innerHTML = `<div class="memo-card-empty">불러오는 중...</div>`;

  try {
    const res = await fetch("/api/soop-chat");
    const data = await res.json();
    const items = (data && data.items) || [];

    if (!items.length) {
      soopChatList.innerHTML = `<div class="memo-card-empty">오늘 수집된 채팅이 없습니다.</div>`;
      return;
    }

    soopChatList.innerHTML = "";
    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "memo-card";
      const textEl = document.createElement("div");
      textEl.className = "memo-card-text";
      textEl.textContent = `${formatSoopChatTime(item.time)}  ${item.message}`;
      card.appendChild(textEl);
      soopChatList.appendChild(card);
    });
  } catch {
    soopChatList.innerHTML = `<div class="memo-card-empty">불러오지 못했습니다.</div>`;
  }
}

function closeSoopChatPanel() {
  soopChatPanel.classList.add("hidden");
  soopChatOverlay.classList.add("hidden");
}

memoBtn.addEventListener("click", openMemoPanel);
closeSoopChatBtn.addEventListener("click", closeSoopChatPanel);
soopChatOverlay.addEventListener("click", closeSoopChatPanel);

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
function selectGenreTab(btn) {
  if (!btn || btn.classList.contains("active")) return;
  songbookGenre = btn.dataset.genre;
  genreTabsMenu.querySelectorAll(".genre-tab").forEach((el) => el.classList.toggle("active", el === btn));
  renderArtistList();
  renderSongGrid();
}

genreTabsMenu.addEventListener("click", (e) => {
  selectGenreTab(e.target.closest(".genre-tab"));
  genreTabsMenu.classList.add("hidden");
});

document.addEventListener("click", (e) => {
  if (!clipSourceCarousel.contains(e.target)) genreTabsMenu.classList.add("hidden");
  if (!sortTabs.contains(e.target)) sortTabsMenu.classList.add("hidden");
});

sortTabsToggle.addEventListener("click", () => {
  sortTabsMenu.classList.toggle("hidden");
});

sortTabsMenu.addEventListener("click", (e) => {
  const btn = e.target.closest(".genre-tab");
  if (!btn) return;
  sortTabsMenu.querySelectorAll(".genre-tab").forEach((el) => el.classList.toggle("active", el === btn));
  sortTabsMenu.classList.add("hidden");

  if (songSource === "clip") {
    songSortMode = btn.dataset.sortValue === "title" ? "title" : "artist";
    renderSongGrid();
  } else {
    youtubeSourceFilter = btn.dataset.sortValue;
    renderYoutubePlaylistGrid(youtubeGroupCache[songSource] || []);
  }
});


song2SearchInput.addEventListener("input", renderSongGrid2);
genre2Tabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".genre-tab");
  if (!btn) return;
  songbook2Genre = btn.dataset.genre;
  genre2Tabs.querySelectorAll(".genre-tab").forEach((el) => el.classList.toggle("active", el === btn));
  renderArtistList2();
  renderSongGrid2();
});

song2SortSelect.addEventListener("change", () => {
  songSortMode2 = song2SortSelect.value;
  renderSongGrid2();
});

const songAddBtn = document.getElementById("songAddBtn");
const songAddModalBackdrop = document.getElementById("songAddModalBackdrop");
const songAddModalTitle = document.getElementById("songAddModalTitle");
const songAddSaveBtn = document.getElementById("songAddSaveBtn");
const songAddForm = document.getElementById("songAddForm");
const songAddTitleInput = document.getElementById("songAddTitleInput");
const songAddArtistInput = document.getElementById("songAddArtistInput");
const songAddNoteInput = document.getElementById("songAddNoteInput");
const songAddMrInput = document.getElementById("songAddMrInput");
const closeSongAddModalBtn = document.getElementById("closeSongAddModalBtn");
const cancelSongAddBtn = document.getElementById("cancelSongAddBtn");

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
      songEditTarget.seq = songSeqCounter++;

      const favIdx = songFavoritesOrder.indexOf(oldKey);
      if (favIdx !== -1) songFavoritesOrder[favIdx] = newKey;
      const queueIdx = singQueueOrder.indexOf(oldKey);
      if (queueIdx !== -1) singQueueOrder[queueIdx] = newKey;
      localStorage.setItem(SONG_FAVORITES_KEY, JSON.stringify(songFavoritesOrder));
      saveSingQueue();
    }
    songByKey[newKey] = songEditTarget;
    localSongOverrides[newKey] = songEditTarget;
    saveSongbookLocalData();
    selectedSongKeys.clear();
  } else {
    const song = { genre, artist, title, note, mr, seq: songSeqCounter++ };
    allSongs = allSongs || [];
    allSongs.push(song);
    const key = albumArtCacheKey(song);
    songByKey[key] = song;
    localSongOverrides[key] = song;
    saveSongbookLocalData();
  }

  renderGenreTabs(songbookGenresList);
  renderGenreTabs2(songbookGenresList);
  renderArtistList();
  renderArtistList2();
  renderSongGrid();
  renderSongGrid2();
  renderFavorites2List();
  renderSingQueueList();

  closeSongAddModal();
});

function toggleSongSelection(key, checked) {
  if (checked) selectedSongKeys.add(key);
  else selectedSongKeys.delete(key);
}

function openSongManageMode() {
  songManageMode = true;
  songManageBtn.classList.add("hidden");
  songManageToolbar.classList.remove("hidden");
  renderSongGrid2();
}

function closeSongManageMode() {
  songManageMode = false;
  selectedSongKeys.clear();
  songManageToolbar.classList.add("hidden");
  songManageBtn.classList.toggle("hidden", isReadOnly);
  renderSongGrid2();
}

songManageBtn.addEventListener("click", openSongManageMode);
songManageCloseBtn.addEventListener("click", closeSongManageMode);

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
  renderGenreTabs(songbookGenresList);
  renderGenreTabs2(songbookGenresList);
  renderArtistList();
  renderArtistList2();
  renderSongGrid();
  renderSongGrid2();
  renderFavorites2List();
  renderSingQueueList();
});


songQueueAddBtn.addEventListener("click", () => {
  if (!selectedSongKeys.size) return;
  addToSingQueue([...selectedSongKeys]);
});

const SING_QUEUE_KEY = "songbook-sing-queue";
let singQueueOrder = [];
try {
  singQueueOrder = JSON.parse(localStorage.getItem(SING_QUEUE_KEY)) || [];
} catch {
  singQueueOrder = [];
}

function saveSingQueue() {
  localStorage.setItem(SING_QUEUE_KEY, JSON.stringify(singQueueOrder));
}

function addToSingQueue(keys) {
  keys.forEach((key) => {
    if (!singQueueOrder.includes(key)) singQueueOrder.push(key);
  });
  saveSingQueue();
  renderSingQueueList();
}

function removeFromSingQueue(key) {
  const idx = singQueueOrder.indexOf(key);
  if (idx === -1) return;
  singQueueOrder.splice(idx, 1);
  saveSingQueue();
  renderSingQueueList();
}

let draggedQueueKey = null;

function openMrLink(song) {
  if (!song.mr) return;
  window.open(song.mr, "_blank", "noopener,noreferrer");
}

function renderSingQueueList() {
  singQueueListEl.innerHTML = "";

  const queueSongs = singQueueOrder.map((key) => songByKey[key]).filter(Boolean);

  if (!queueSongs.length) {
    const empty = document.createElement("p");
    empty.className = "favorites-empty";
    empty.textContent = "대기열이 비어 있습니다.";
    singQueueListEl.appendChild(empty);
    return;
  }

  queueSongs.forEach((song) => {
    const key = albumArtCacheKey(song);

    const item = document.createElement("div");
    item.className = "queue-item" + (song.mr ? " has-mr" : "");
    item.draggable = true;

    const titleEl = document.createElement("div");
    titleEl.className = "favorite-item-title";
    titleEl.textContent = song.title;

    const artistEl = document.createElement("div");
    artistEl.className = "favorite-item-artist";
    artistEl.textContent = song.artist;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "queue-item-remove";
    removeBtn.setAttribute("aria-label", "대기열에서 제거");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => removeFromSingQueue(key));

    item.append(titleEl, artistEl);

    if (song.mr) {
      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "queue-item-play";
      playBtn.setAttribute("aria-label", "MR 재생");
      playBtn.textContent = "▶";
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openMrLink(song);
      });
      item.appendChild(playBtn);
    }

    item.appendChild(removeBtn);

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
      renderSingQueueList();
    });

    singQueueListEl.appendChild(item);
  });
}

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

let saveInFlightCount = 0;

function saveEvents(data) {
  const hadData = Object.keys(eventsCache || {}).some((k) => (eventsCache[k] || []).length > 0);
  const hasData = Object.keys(data || {}).some((k) => (data[k] || []).length > 0);
  if (hadData && !hasData) {
    const proceed = confirm("모든 일정이 사라진 상태로 저장하려고 합니다. 정말 이대로 저장할까요?");
    if (!proceed) return;
  }

  eventsCache = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const { username, password } = getStoredCreds();
  if (!password || !username) return;

  attemptSaveToServer(data, username, password, 0);
}

function attemptSaveToServer(data, username, password, retryCount) {
  saveInFlightCount++;
  apiPost({ action: "save", events: eventsObjectToFlat(data), username, password })
    .then((res) => {
      if (res && res.error === "refused_empty_overwrite") {
        alert("서버가 빈 데이터로 전체 덮어쓰기를 거부했습니다. 새로고침 후 다시 시도해주세요.");
        return;
      }
      if (res && res.ok) return;

      if (res && res.error === "unauthorized") {
        clearStoredCreds();
        isReadOnly = true;
        updateLockUi();
        alert("비밀번호가 만료되어 편집 잠금이 해제되었습니다. 다시 로그인해주세요.");
        return;
      }

      // 네트워크 오류 등 일시적 실패로 보고 재시도 (로그인 상태는 유지)
      if (retryCount < 2) {
        setTimeout(() => attemptSaveToServer(data, username, password, retryCount + 1), 1500);
      } else {
        alert("저장 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    })
    .finally(() => {
      saveInFlightCount--;
    });
}

async function syncEventsFromServer() {
  if (saveInFlightCount > 0) return; // 저장 중일 때는 동기화로 덮어쓰지 않음
  const flat = await apiGetEvents();
  if (!flat) return;

  const hadData = Object.keys(eventsCache || {}).length > 0;
  if (flat.length === 0 && hadData) {
    // 네트워크 오류 등으로 빈 응답이 온 것으로 보고, 기존 캐시를 지우지 않음
    return;
  }

  eventsCache = flatToEventsObject(flat);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsCache));
  refreshCurrentView();
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function initEvents() {
  const flat = await withTimeout(apiGetEvents(), 5000);
  if (flat && flat.length) {
    console.log("[events] initEvents using fresh fetch, total rows=", flat.length);
    eventsCache = flatToEventsObject(flat);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsCache));
  } else {
    console.log("[events] initEvents FELL BACK to stale localStorage cache. flat=", flat);
    eventsCache = loadEvents();
  }
  console.log("[events] final 2026-08-15 entries=", (eventsCache["2026-08-15"] || []).length, eventsCache["2026-08-15"]);
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

function getWeekStart(date) {
  const d = new Date(date);
  const diff = d.getDay(); // 0=일 ... 6=토 (이미 일요일 시작이므로 그대로 사용)
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function firstWeekOfMonth(monthIndex) {
  return getWeekStart(new Date(YEAR, monthIndex, 1));
}

function lastWeekOfMonth(monthIndex) {
  return getWeekStart(new Date(YEAR, monthIndex + 1, 0));
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const ATTENDEE_RE = /\s+w\.\s*(.+)$/i;

function getColorInfo(ev) {
  if (ev.sheetColor) return { hex: ev.sheetColor };
  if (ev.color) return { key: ev.color };
  if (ev.title.includes("휴방")) return { key: "hiatus" };
  if (ev.title.includes("합방")) return { key: "collab" };
  if (ev.title.includes("따이봤")) return { key: "gray" };
  return { key: "blue" };
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
  green: "게임 출시",
};

const EVENT_HEX_LABELS = {
  "#4285f4": "종겜",
  "#ff6d01": "노래관련",
  "#cc0000": "휴방",
  "#e951d0": "커머스",
  "#8a2be2": "종겜",
  "#9900ff": "종겜",
  "#ff6f00": "같이보기",
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
  const todayDay = String(new Date().getDate()).padStart(2, "0");
  document.getElementById("calendarPostDate").textContent =
    `${YEAR}.${String(currentMonth + 1).padStart(2, "0")}.${todayDay}`;
  prevBtn.disabled = currentMonth === 0;
  nextBtn.disabled = currentMonth === 11;

  grid.innerHTML = "";

  const firstDay = new Date(YEAR, currentMonth, 1).getDay(); // 0=일 ... 6=토
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

  const diffDays = Math.round((cardWeekStart - firstWeekOfMonth(currentMonth)) / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;
  monthTitle.textContent = `${currentMonth + 1}월 ${weekNum}째주`;
}

function resetCardWeekToMonth() {
  const first = firstWeekOfMonth(currentMonth);
  const last = lastWeekOfMonth(currentMonth);
  const todayWeek = getWeekStart(new Date());
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

const cafeNoticeCache = new Map();
function fetchCafeNoticeCached(key) {
  if (!cafeNoticeCache.has(key)) {
    cafeNoticeCache.set(
      key,
      fetch(`${CAFE_API_URL}?date=${key}`).then((res) => res.json())
    );
  }
  return cafeNoticeCache.get(key);
}

async function loadModalCafeNotice(key) {
  modalCafeNoticeTitle.textContent = "불러오는 중...";
  modalCafeNotice.classList.remove("hidden");
  try {
    const posts = await fetchCafeNoticeCached(key);
    if (selectedDateKey !== key) return;
    if (posts && posts.length) {
      modalCafeNoticeTitle.textContent = posts[0].title;
      modalCafeNotice.href = posts[0].url;
    } else {
      modalCafeNotice.classList.add("hidden");
    }
  } catch {
    cafeNoticeCache.delete(key);
    if (selectedDateKey === key) modalCafeNotice.classList.add("hidden");
  }
}

const SOOP_NOTICE_API_URL = "/api/soop-notice";
const modalSoopNotice = document.getElementById("modalSoopNotice");
const modalSoopNoticeTitle = document.getElementById("modalSoopNoticeTitle");
const modalSoopNoticeContent = document.getElementById("modalSoopNoticeContent");

const soopNoticeCache = new Map();
function fetchSoopNoticeCached(key) {
  if (!soopNoticeCache.has(key)) {
    soopNoticeCache.set(
      key,
      fetch(`${SOOP_NOTICE_API_URL}?date=${key}`).then((res) => res.json())
    );
  }
  return soopNoticeCache.get(key);
}

async function loadModalSoopNotice(key) {
  modalSoopNoticeTitle.textContent = "불러오는 중...";
  modalSoopNoticeContent.textContent = "";
  modalSoopNotice.classList.remove("hidden");
  try {
    const posts = await fetchSoopNoticeCached(key);
    if (selectedDateKey !== key) return;
    if (posts && posts.length) {
      modalSoopNoticeTitle.textContent = posts[0].title;
      modalSoopNoticeContent.textContent = posts[0].content;
      modalSoopNotice.href = posts[0].url;
    } else {
      modalSoopNotice.classList.add("hidden");
    }
  } catch {
    soopNoticeCache.delete(key);
    if (selectedDateKey === key) modalSoopNotice.classList.add("hidden");
  }
}

function prefetchTodayNotices() {
  const key = todayKey();
  fetchCafeNoticeCached(key).catch(() => cafeNoticeCache.delete(key));
  fetchSoopNoticeCached(key).catch(() => soopNoticeCache.delete(key));
}

function openModal(key) {
  selectedDateKey = key;
  const [, m, d] = key.split("-");
  modalDate.textContent = `${YEAR}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  modalDate.classList.toggle("clickable", !isReadOnly);
  managingMode = false;
  expandedIndex = null;
  modalManageActions.classList.add("hidden");
  resetForm();
  eventForm.classList.add("hidden");
  renderEventList();
  modalBackdrop.classList.remove("hidden");
  loadModalCafeNotice(key);
  loadModalSoopNotice(key);
}

modalDate.addEventListener("click", () => {
  if (isReadOnly) return;
  managingMode = !managingMode;
  expandedIndex = null;
  eventForm.classList.add("hidden");
  modalManageActions.classList.toggle("hidden", !managingMode);
  renderEventList();
});

newEventBtn.addEventListener("click", () => {
  if (isReadOnly) return;
  expandedIndex = -1;
  resetForm();
  eventForm.classList.remove("hidden");
  renderEventList();
  eventTitleInput.focus();
});

bulkDeleteBtn.addEventListener("click", () => {
  if (isReadOnly || !selectedDateKey) return;
  if (!confirm("이 날짜의 모든 일정을 삭제할까요?")) return;
  const events = loadEvents();
  delete events[selectedDateKey];
  saveEvents(events);
  expandedIndex = null;
  eventForm.classList.add("hidden");
  renderEventList();
  refreshCurrentView();
});

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

function buildEventCardContent(container, ev) {
  const match = ev.title.match(ATTENDEE_RE);
  const titleEl = document.createElement("div");
  titleEl.className = "event-card-title";
  titleEl.textContent = match ? ev.title.slice(0, match.index) : ev.title;
  container.appendChild(titleEl);

  const badgeLabel = getEventBadgeLabel(ev);
  if (badgeLabel) {
    const badgeEl = document.createElement("div");
    badgeEl.className = "event-card-badge";
    badgeEl.textContent = badgeLabel;
    applyEventColor(badgeEl, ev);
    container.appendChild(badgeEl);
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

      container.appendChild(attendeesWrap);
    }
  }
}

function renderEventList() {
  const events = loadEvents();
  const list = events[selectedDateKey] || [];
  const manageable = managingMode && !isReadOnly;

  eventList.innerHTML = "";

  if (manageable && expandedIndex === -1) {
    const newCard = document.createElement("div");
    newCard.className = "event-card manageable";
    const body = document.createElement("div");
    body.className = "event-card-body";
    body.appendChild(eventForm);
    eventForm.classList.remove("hidden");
    newCard.appendChild(body);
    eventList.appendChild(newCard);
  }

  if (!list.length) {
    if (!(manageable && expandedIndex === -1)) {
      const empty = document.createElement("p");
      empty.className = "event-empty";
      empty.textContent = "등록된 일정이 없습니다.";
      eventList.appendChild(empty);
    }
    return;
  }

  list.forEach((ev, idx) => {
    const card = document.createElement("div");
    card.className = "event-card";

    if (!manageable) {
      buildEventCardContent(card, ev);
      eventList.appendChild(card);
      return;
    }

    card.classList.add("manageable");
    card.draggable = true;

    card.addEventListener("dragstart", () => {
      draggedEventIndex = idx;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      draggedEventIndex = null;
      card.classList.remove("dragging");
    });
    card.addEventListener("dragover", (e) => e.preventDefault());
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      if (draggedEventIndex === null || draggedEventIndex === idx) return;
      const events = loadEvents();
      const dayList = events[selectedDateKey] || [];
      const [moved] = dayList.splice(draggedEventIndex, 1);
      dayList.splice(idx, 0, moved);
      events[selectedDateKey] = dayList;
      saveEvents(events);
      expandedIndex = null;
      eventForm.classList.add("hidden");
      renderEventList();
      refreshCurrentView();
    });

    const header = document.createElement("div");
    header.className = "event-card-header";

    const chevron = document.createElement("span");
    chevron.className = "event-card-chevron";
    chevron.textContent = expandedIndex === idx ? "▾" : "▸";
    header.appendChild(chevron);

    buildEventCardContent(header, ev);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "event-card-close";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteEvent(idx);
    });
    header.appendChild(delBtn);

    header.addEventListener("click", () => {
      if (expandedIndex === idx) {
        expandedIndex = null;
        eventForm.classList.add("hidden");
      } else {
        expandedIndex = idx;
        editEvent(idx);
      }
      renderEventList();
    });

    card.appendChild(header);

    if (expandedIndex === idx) {
      const body = document.createElement("div");
      body.className = "event-card-body";
      body.appendChild(eventForm);
      eventForm.classList.remove("hidden");
      card.appendChild(body);
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
  if (editingIndex === index || expandedIndex === index) {
    resetForm();
    expandedIndex = null;
    eventForm.classList.add("hidden");
  }
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
  console.log("[eventForm submit] selectedDateKey=", selectedDateKey, "editingIndex=", editingIndex, "newEvent=", newEvent);

  if (editingIndex !== null) {
    // 앱에서 직접 수정한 일정은 "app" 소유로 승격되어, 이후 월별 탭 동기화가 덮어쓰지 않음
    events[selectedDateKey][editingIndex] = newEvent;
  } else {
    events[selectedDateKey].push(newEvent);
  }
  saveEvents(events);

  expandedIndex = null;
  eventForm.classList.add("hidden");
  resetForm();
  renderEventList();
  refreshCurrentView();
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

const viewModeWeekBtn = document.getElementById("viewModeWeekBtn");
const viewModeMonthBtn = document.getElementById("viewModeMonthBtn");

function setViewMode(mode) {
  viewMode = mode;
  viewModeWeekBtn.classList.toggle("active", mode === "card");
  viewModeMonthBtn.classList.toggle("active", mode === "list");
  grid.classList.toggle("hidden", mode === "card");
  cardView.classList.toggle("hidden", mode !== "card");
  weekdayRow.classList.toggle("card-mode", mode === "card");
  calendarHeaderEl.classList.toggle("card-mode", mode === "card");
  if (mode === "card") {
    resetCardWeekToMonth();
    renderCardView();
  }
}

viewModeWeekBtn.addEventListener("click", () => setViewMode("card"));
viewModeMonthBtn.addEventListener("click", () => setViewMode("list"));

const mobileViewQuery = window.matchMedia("(max-width: 700px)");

function applyDefaultMobileViewMode() {
  if (mobileViewQuery.matches && viewMode !== "card") setViewMode("card");
}

closeModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modalBackdrop.classList.contains("hidden")) closeModal();
});

function updateLockUi() {
  editLockBtn.classList.toggle("unlocked", !isReadOnly);
  const label = isReadOnly ? "로그인 (눌러서 편집 잠금 해제)" : "로그아웃 (눌러서 편집 잠그기)";
  editLockBtn.title = label;
  editLockBtn.setAttribute("aria-label", label);
  loginBtnLabel.textContent = isReadOnly ? "로그인" : "로그아웃";
  if (isReadOnly && songManageMode) closeSongManageMode();
  songManageBtn.classList.toggle("hidden", isReadOnly || songManageMode);
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

async function init() {
  const today = new Date();
  if (today.getFullYear() === YEAR) currentMonth = today.getMonth();

  const minDelay = new Promise((r) => setTimeout(r, LOADING_GIF_MS));
  await Promise.all([initEvents(), minDelay]);

  updateLockUi();
  renderGrid();
  applyDefaultMobileViewMode();

  loadingScreen.classList.add("hidden");

  prefetchTodayNotices();
  prefetchSongbookInBackground();
  loadSharedMemoList().then(() => showTodayMemoPopupIfNeeded(showTodayYoutubePopupIfNeeded));

  tryAutoUnlock().then(() => {
    updateLockUi();
    refreshCurrentView();
  });
}
init();

const liveAvatarEls = document.querySelectorAll(".back-menu-avatar, .cafe-photos-avatar, .calendar-post-avatar");
const SOOP_LIVE_URL = "https://play.sooplive.com/insome0319";

liveAvatarEls.forEach((el) => {
  el.addEventListener("click", () => {
    if (el.classList.contains("live")) window.open(SOOP_LIVE_URL, "_blank", "noopener");
  });
});

async function refreshSoopLiveStatus() {
  try {
    const res = await fetch("/api/soop-live");
    const data = await res.json();
    liveAvatarEls.forEach((el) => el.classList.toggle("live", Boolean(data.live)));
  } catch {
    // 실패 시 이전 상태 유지
  }
}
refreshSoopLiveStatus();
setInterval(refreshSoopLiveStatus, 60 * 1000);

const SYNC_INTERVAL_MS = 60 * 1000; // 1분

setInterval(() => {
  syncEventsFromServer();
}, SYNC_INTERVAL_MS);
