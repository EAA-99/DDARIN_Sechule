const API_URL = "https://script.google.com/macros/s/AKfycbwuOrjG9SZxN4CtkXb9EW2Hd_bt4x-ntPXjAFisw9VojI2X8lijwSZ2Prw5xaxkP8CYeg/exec";

const SPREADSHEET_ID = "1gCvMJMK52QUyo1M4FbFzWsJ_NZp3MUqgrDa0obhNIbY";
const SHEETS_API_KEY = "AIzaSyC0RsFfc5y9GmEaE29niGWD9hbSnpIc7rM";
const SHEETS_API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/AppEvents!A2:E?key=${SHEETS_API_KEY}`;

const SONGBOOK_SPREADSHEET_ID = "1NhImCLm5diXM0pA45SkB-g2PARivQiVN8bUKlniiOB8";
const SONGBOOK_CLIPS_SPREADSHEET_ID = "17EmfOEPVGesH9FXnh7xsKvBYYIhi2TrerSzY23E2N9A";


// 일정표는 2026·2027년 두 해를 오갈 수 있음 (처음엔 오늘이 속한 해)
const MIN_YEAR = 2026;
const MAX_YEAR = 2027;
let YEAR = Math.min(MAX_YEAR, Math.max(MIN_YEAR, new Date().getFullYear()));
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

const monthTitle = document.getElementById("monthTitle");
const grid = document.getElementById("grid");
const weekdayRow = document.querySelector(".weekday-row");
const calendarHeaderEl = document.querySelector(".calendar-header");
grid.addEventListener("scroll", () => {
  weekdayRow.scrollLeft = grid.scrollLeft;
});
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const yearSeg = document.getElementById("yearSeg");
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
const soopChatView = document.getElementById("soopChatView");
const soopChatDayView = document.getElementById("soopChatDayView");
const sideNavEl = document.querySelector(".side-nav");
const calendarPostMenuBtn = document.querySelector(".calendar-post-menu");
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
const songbookGwView = document.getElementById("songbookGwView");
const songbookGwBody = document.getElementById("songbookGwBody");
const song2SearchInput = document.getElementById("song2SearchInput");
const genre2Tabs = document.getElementById("genre2Tabs");
const artist2List = document.getElementById("artist2List");
const artist2Toggle = document.getElementById("artist2Toggle");
const artist2ToggleLabel = document.getElementById("artist2ToggleLabel");
const artist2Panel = document.getElementById("artist2Panel");
const song2CountEl = document.getElementById("song2Count");
const song2Table = document.getElementById("song2Table");
const song2GenreFilterToggle = document.getElementById("song2GenreFilterToggle");
const song2GenreFilterMenu = document.getElementById("song2GenreFilterMenu");
const song2Grid = document.getElementById("song2Grid");
const songbookTotalCountEl = document.getElementById("songbookTotalCount");
const favorites2ListEl = document.getElementById("favorites2List");
const favorites2OpenBtn = document.getElementById("favorites2OpenBtn");
const favorites2ModalBackdrop = document.getElementById("favorites2ModalBackdrop");
const closeFavorites2ModalBtn = document.getElementById("closeFavorites2ModalBtn");

function closeFavorites2Modal() {
  favorites2ModalBackdrop.classList.add("hidden");
}

favorites2OpenBtn.addEventListener("click", () => {
  renderFavorites2List();
  favorites2ModalBackdrop.classList.remove("hidden");
});
closeFavorites2ModalBtn.addEventListener("click", closeFavorites2Modal);
favorites2ModalBackdrop.addEventListener("click", (e) => {
  if (e.target === favorites2ModalBackdrop) closeFavorites2Modal();
});

// 다크모드(앱 전체): 기본은 라이트, 홈의 버튼으로 다크를 고른 경우에만 다크
const THEME_KEY = "app-theme";
const themeToggleBtn = document.getElementById("themeToggleBtn");
const THEME_ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const THEME_ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  themeToggleBtn.innerHTML = theme === "dark" ? THEME_ICON_SUN : THEME_ICON_MOON;
  themeToggleBtn.setAttribute("aria-label", theme === "dark" ? "라이트모드로 보기" : "다크모드로 보기");
}

themeToggleBtn.addEventListener("click", () => {
  localStorage.setItem(THEME_KEY, document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  applyTheme();
});
applyTheme();

let songbook2Genre = "전체";
let songbook2Artist = "전체";
let songSortMode2 = "artist";
let songSortDir2 = "asc";
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
  const allGenres = ["전체", ...genres];

  [genre2Tabs, song2GenreFilterMenu].forEach((container) => {
    container.innerHTML = "";
    allGenres.forEach((genre) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "genre-tab" + (songbook2Genre === genre ? " active" : "");
      btn.dataset.genre = genre;
      if (container === genre2Tabs) {
        const songs = allSongs || [];
        const nameEl = document.createElement("b");
        nameEl.textContent = genre;
        const countEl = document.createElement("span");
        countEl.textContent = `${genre === "전체" ? songs.length : songs.filter((s) => s.genre === genre).length}곡`;
        btn.append(nameEl, countEl);
      } else {
        btn.textContent = genre;
      }
      container.appendChild(btn);
    });
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

  const addLabel = (text) => {
    const label = document.createElement("div");
    label.className = "sb2-panel-label";
    label.textContent = text;
    artist2List.appendChild(label);
  };
  addLabel("한글");

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "artist-list-btn" + (songbook2Artist === "전체" ? " active" : "");
  allBtn.textContent = "전체";
  allBtn.addEventListener("click", () => {
    songbook2Artist = "전체";
    artist2Panel.classList.add("hidden");
    renderArtistList2();
    renderSongGrid2();
  });
  artist2List.appendChild(allBtn);

  let englishLabelAdded = false;
  [...CHOSEONG_GROUPS, ...ALPHABET_GROUPS].forEach((group) => {
    if (!presentGroups.has(group)) return;
    if (!englishLabelAdded && ALPHABET_GROUPS.includes(group)) {
      addLabel("영어");
      englishLabelAdded = true;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "artist-list-btn" + (songbook2Artist === group ? " active" : "");
    btn.textContent = group;
    btn.addEventListener("click", () => {
      songbook2Artist = group;
      artist2Panel.classList.add("hidden");
      renderArtistList2();
      renderSongGrid2();
    });
    artist2List.appendChild(btn);
  });

  updateArtist2Toggle();
}

function updateArtist2Toggle() {
  artist2ToggleLabel.textContent = `가수 ${songbook2Artist === "전체" ? "ㄱ–ㅎ" : songbook2Artist}`;
  artist2Toggle.classList.toggle("on", songbook2Artist !== "전체" || !artist2Panel.classList.contains("hidden"));
}

artist2Toggle.addEventListener("click", (e) => {
  e.stopPropagation();
  artist2Panel.classList.toggle("hidden");
  updateArtist2Toggle();
});

document.addEventListener("click", (e) => {
  if (artist2Panel.classList.contains("hidden") || artist2Panel.contains(e.target)) return;
  artist2Panel.classList.add("hidden");
  updateArtist2Toggle();
});

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
    { value: "따린픽", label: "따린픽" },
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

const CLIP_SOURCE_POSTER_TITLES = { clip: "LIVE CLIP", youtube: "COVERS", playlist: "PLAYLIST" };

function groupSongsBy(songs, field) {
  const groups = [];
  songs.forEach((song) => {
    let group = groups.find((g) => g.name === song[field]);
    if (!group) {
      group = { name: song[field], songs: [] };
      groups.push(group);
    }
    group.songs.push(song);
  });
  return groups;
}

function renderClipSourcePoster(source, groups) {
  const poster = document.getElementById(`clipSourcePoster-${source}`);
  if (!poster) return;
  poster.innerHTML = "";

  const kicker = document.createElement("div");
  kicker.className = "clip-source-poster-kicker";
  kicker.textContent = "DDARIN";

  const title = document.createElement("div");
  title.className = "clip-source-poster-title";
  title.textContent = CLIP_SOURCE_POSTER_TITLES[source];

  const total = groups.reduce((sum, g) => sum + g.songs.length, 0);
  const meta = document.createElement("div");
  meta.className = "clip-source-poster-meta";
  meta.textContent = `${total} TRACKS · ${groups.length} LISTS`;

  poster.append(kicker, title, meta);

  // Fill the card: start with the mobile count and add a row per section while it still fits
  const minRows = groups.length <= 2 ? 5 : 3;
  const maxRows = Math.max(0, ...groups.slice(0, 3).map((g) => g.songs.length));
  const limit = poster.clientHeight - 16;
  const contentBottom = () => {
    const last = poster.lastElementChild;
    return last.offsetTop + last.offsetHeight;
  };

  let perSection = minRows;
  renderClipSourcePosterSections(poster, groups, perSection);
  while (perSection < maxRows) {
    renderClipSourcePosterSections(poster, groups, perSection + 1);
    if (contentBottom() > limit) {
      renderClipSourcePosterSections(poster, groups, perSection);
      break;
    }
    perSection++;
  }
}

function renderClipSourcePosterSections(poster, groups, perSection) {
  poster.querySelectorAll(".clip-source-poster-section").forEach((el) => el.remove());
  groups.slice(0, 3).forEach((group) => {
    const section = document.createElement("div");
    section.className = "clip-source-poster-section";

    const head = document.createElement("div");
    head.className = "clip-source-poster-section-head";
    const nameEl = document.createElement("span");
    nameEl.textContent = group.name;
    const countEl = document.createElement("span");
    countEl.textContent = `${group.songs.length}곡`;
    head.append(nameEl, countEl);
    section.appendChild(head);

    group.songs.slice(0, perSection).forEach((song, i) => {
      const row = document.createElement("div");
      row.className = "clip-source-poster-track";

      const num = document.createElement("span");
      num.className = "clip-source-poster-num";
      num.textContent = String(i + 1).padStart(2, "0");

      const name = document.createElement("span");
      name.className = "clip-source-poster-name";
      const artist = document.createElement("span");
      artist.className = "clip-source-poster-artist";
      artist.textContent = ` · ${song.artist.replace(/\s*-\s*Topic$/, "")}`;
      name.append(song.title, artist);

      row.append(num, name);
      section.appendChild(row);
    });

    poster.appendChild(section);
  });
}

const clipSourcePosterGroups = {};

window.addEventListener("resize", () => {
  Object.entries(clipSourcePosterGroups).forEach(([source, groups]) => renderClipSourcePoster(source, groups));
});

async function renderClipSourcePreviews() {
  for (const source of CLIP_SOURCE_ORDER) {
    let song;
    if (source === "clip") {
      song = pickRandomSong();
      const clipSongs = (allSongs || []).filter((s) => !s.deletedFromLiveClip && thumbMap && thumbMap[albumArtCacheKey(s)]);
      clipSourcePosterGroups[source] = groupSongsBy(clipSongs, "genre");
    } else {
      const songs = await loadYoutubeGroup(source);
      song = songs && songs.length ? songs[Math.floor(Math.random() * songs.length)] : null;
      clipSourcePosterGroups[source] = groupSongsBy(songs || [], "source");
    }
    renderClipSourcePoster(source, clipSourcePosterGroups[source]);
    if (!song) continue;

    const artEl = document.getElementById(`clipSourceArt-${source}`);
    if (artEl) {
      if (source === "clip") {
        const key = albumArtCacheKey(song);
        artEl.src = (thumbMap && thumbMap[key]) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
      } else {
        artEl.src = song.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
      }
    }
  }
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
  if (open) document.getElementById("clipSourceSongListTitle").textContent = CLIP_SOURCE_POSTER_TITLES[songSource];
}

document.getElementById("clipSourceSongListClose").addEventListener("click", () => setSongListOpen(false));

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
    const field = songSortMode2 === "title" ? "title" : "artist";
    const cmp = a[field].localeCompare(b[field], "ko");
    return songSortDir2 === "asc" ? cmp : -cmp;
  });

  return filtered;
}

function buildSongRow2(song, num) {
  const key = albumArtCacheKey(song);
  const tr = document.createElement("tr");

  const favTd = document.createElement("td");
  favTd.className = "song2-col-fav";
  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "song2-fav-btn" + (isSongFavorite(key) ? " active" : "");
  favBtn.textContent = isSongFavorite(key) ? "★" : "☆";
  favBtn.addEventListener("click", () => {
    toggleSongFavorite(key);
    favBtn.classList.toggle("active");
    favBtn.textContent = isSongFavorite(key) ? "★" : "☆";
    renderFavorites2List();
  });
  favTd.appendChild(favBtn);

  const numTd = document.createElement("td");
  numTd.className = "song2-col-num";
  numTd.textContent = num;

  const titleTd = document.createElement("td");
  titleTd.className = "song2-col-title";
  titleTd.textContent = song.title;

  // dotted leader between title and artist, like a book's table of contents
  const leadTd = document.createElement("td");
  leadTd.className = "song2-col-lead";

  const genreDot = () => {
    const dot = document.createElement("i");
    dot.className = "song2-dot";
    dot.dataset.g = song.genre;
    return dot;
  };

  const artistTd = document.createElement("td");
  artistTd.className = "song2-col-artist";
  artistTd.append(genreDot(), song.artist);

  const genreTd = document.createElement("td");
  genreTd.className = "song2-col-genre";
  genreTd.append(genreDot(), song.genre);

  tr.append(favTd, numTd, titleTd, leadTd, artistTd, genreTd);
  return tr;
}

function renderSongGrid2() {
  const filtered = getFilteredSongs2();

  songbookTotalCountEl.textContent = `${(allSongs || []).length} TRACKS · 따린이 부를 수 있는 노래`;
  song2CountEl.textContent = `${filtered.length}곡`;

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

  let lastGroup = null;
  filtered.forEach((song, i) => {
    if (songSortMode2 === "artist") {
      const group = getArtistInitialGroup(song.artist) || "#";
      if (group !== lastGroup) {
        const groupTr = document.createElement("tr");
        groupTr.className = "song2-group-row";
        const groupTd = document.createElement("td");
        groupTd.colSpan = 6;
        groupTd.textContent = group;
        groupTr.appendChild(groupTd);
        song2Grid.appendChild(groupTr);
        lastGroup = group;
      }
    }
    song2Grid.appendChild(buildSongRow2(song, i + 1));
  });
}

let currentMainView = "calendar";

function applyHomeMatchedHeight(el) {
  if (window.innerWidth <= 900) {
    el.style.height = "";
    return;
  }
  // songbookView/cafePhotosView share the same "width:100%; max-width:640px" sizing
  // inside .page, so always derive the height from .page's width (always rendered,
  // unlike the cards themselves which are hidden when not active) instead of each
  // card's own measured width — that way playlist always matches photo, even before
  // photo has ever been opened.
  const pageWidth = document.querySelector(".page").getBoundingClientRect().width;
  const width = Math.min(pageWidth, 640);
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
new ResizeObserver((entries) => {
  entries.forEach((entry) => applyHomeMatchedHeight(entry.target));
}).observe(backMenuView);

function showMainView(view) {
  if (view === "backmenu" && currentMainView !== "backmenu") homeSelectedKey = null;
  if (view === "backmenu") renderHome();
  appViewEl.classList.toggle("hidden", view !== "calendar");
  songbookView.classList.toggle("hidden", view !== "songbook");
  songbook2View.classList.toggle("hidden", view !== "songbook2");
  songbookGwView.classList.toggle("hidden", view !== "songbookgw");
  gameView.classList.toggle("hidden", view !== "game");
  backMenuView.classList.toggle("hidden", view !== "backmenu");
  cafePhotosView.classList.toggle("hidden", view !== "cafephotos");
  soopChatView.classList.toggle("hidden", view !== "soopchat");
  soopChatDayView.classList.toggle("hidden", view !== "soopchatday");
  youtubeView.classList.toggle("hidden", view !== "youtube");
  document.body.classList.toggle("youtube-view-open", view === "youtube");

  if (view === "backmenu") applyHomeMatchedHeight(backMenuView);
  if (view === "calendar" && viewMode === "card") requestAnimationFrame(fitWeekView);
  if (view === "calendar") requestAnimationFrame(fitMonthNew);
  if (view === "songbook") applyHomeMatchedHeight(songbookView);
  if (view === "cafephotos") applyHomeMatchedHeight(cafePhotosView);
  if (view === "soopchat") loadSoopChatView();
  if (view === "soopchatday") renderSoopChatDayView();
  sideNavEl.classList.toggle(
    "hidden",
    view === "backmenu" ||
      view === "cafephotos" ||
      view === "songbook" ||
      view === "songbook2" ||
      view === "songbookgw" ||
      view === "soopchat" ||
      view === "soopchatday" ||
      view === "youtube"
  );
  backToCalendarBtn.classList.toggle(
    "hidden",
    view === "backmenu" ||
      view === "cafephotos" ||
      view === "songbook" ||
      view === "calendar" ||
      view === "soopchat" ||
      view === "soopchatday" ||
      view === "youtube"
  );

  if (currentMainView === "backmenu" && view !== "backmenu") {
    const openedViewEl = { songbook: songbookView, songbook2: songbook2View, songbookgw: songbookGwView, cafephotos: cafePhotosView }[view];
    if (openedViewEl) {
      openedViewEl.classList.remove("view-opening");
      void openedViewEl.offsetWidth;
      openedViewEl.classList.add("view-opening");
    }
  }
  currentMainView = view;
  if (view !== "backmenu") armBackNav();
}

let backNavArmed = false;

function armBackNav() {
  if (backNavArmed) return;
  backNavArmed = true;
  history.pushState({ ddarinNav: true }, "", location.href);
}

window.addEventListener("popstate", () => {
  backNavArmed = false;
  if (currentMainView !== "backmenu") {
    showMainView("backmenu");
  }
});

if (currentMainView !== "backmenu") armBackNav();

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

let songbookGwHamburgerBtn = null;
let songbookGwNavMenu = null;

const SONGBOOK_GW_NAV_ACTIONS = {
  home: () => showMainView("backmenu"),
  calendar: () => showMainView("calendar"),
  playlist: openSongbook,
  Photo: () => {
    switchCafePhotosTab(cafePhotosTabEls[0], { menuId: "27", titleContains: "" });
    showMainView("cafephotos");
  },
  songbook: openSongbook2Table,
  mail: () => showMainView("soopchat"),
};

function openSongbook2() {
  const clone = songbookView.cloneNode(true);
  clone.removeAttribute("id");
  clone.classList.remove("hidden", "view-opening");
  clone.classList.add("songbook-view-clone");
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));

  songbookGwHamburgerBtn = clone.querySelector(".back-menu-hamburger");
  songbookGwNavMenu = clone.querySelector(".back-menu-nav-menu");
  if (songbookGwHamburgerBtn && songbookGwNavMenu) {
    songbookGwHamburgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      songbookGwNavMenu.classList.toggle("hidden");
    });
    Object.entries(SONGBOOK_GW_NAV_ACTIONS).forEach(([label, action]) => {
      const btn = songbookGwNavMenu.querySelector(`[aria-label="${label}"]`);
      if (btn) btn.addEventListener("click", action);
    });
  }

  const backMenuName = clone.querySelector(".back-menu-name");
  if (backMenuName) {
    const gwLinkBtn = document.createElement("button");
    gwLinkBtn.type = "button";
    gwLinkBtn.className = "songbook-gw-inline-link";
    gwLinkBtn.innerHTML =
      '노래책 보기 <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    gwLinkBtn.addEventListener("click", openSongbook2Table);
    backMenuName.appendChild(gwLinkBtn);
  }

  songbookGwBody.innerHTML = "";
  songbookGwBody.appendChild(clone);
  showMainView("songbookgw");
}

document.addEventListener("click", (e) => {
  if (
    songbookGwNavMenu &&
    !songbookGwNavMenu.classList.contains("hidden") &&
    !songbookGwNavMenu.contains(e.target) &&
    e.target !== songbookGwHamburgerBtn
  ) {
    songbookGwNavMenu.classList.add("hidden");
  }
});

async function openSongbook2Table() {
  showMainView("songbook2");

  if (!allSongs) {
    song2Grid.innerHTML = `<div class="song-empty">불러오는 중...</div>`;
    await ensureSongbookSongs();
  }

  renderSongGrid2();
  renderFavorites2List();
  renderArtistList2();
}


document.getElementById("calendarBtn").addEventListener("click", () => showMainView("backmenu"));

const backToCalendarBtn = document.getElementById("backToCalendarBtn");
backToCalendarBtn.addEventListener("click", () => showMainView("backmenu"));
// 홈: 따린 카드(오늘 일정) + 이번 주 달력 + 메뉴
const HOME_DOT_COLORS = {
  blue: "#4a7fd6",
  gray: "#9a9a9a",
  pink: "#e0558d",
  green: "#3cb46e",
  purple: "#8a6cf0",
  orange: "#e8913a",
  hiatus: "#d0607a",
  collab: "#7a62c9",
  yellow: "#e0b830",
};

function homeDotColor(ev) {
  const info = getColorInfo(ev);
  const rgb = info.hex && hexToRgb(info.hex);
  return rgb ? rgbToHex(mix(rgb, 0, 0.1)) : HOME_DOT_COLORS[info.key] || HOME_DOT_COLORS.blue;
}

function splitEventTitle(title) {
  const match = title.match(ATTENDEE_RE);
  return match ? [title.slice(0, match.index), `w. ${match[1]}`] : [title, ""];
}

// 홈 이번 주 달력에서 고른 날 (홈에 다시 들어오면 오늘로)
let homeSelectedKey = null;

function renderHome() {
  const events = loadEvents();
  const now = new Date();
  const selectedKey = homeSelectedKey || todayKey();
  const isToday = selectedKey === todayKey();
  const [sy, sm, sd] = selectedKey.split("-").map(Number);
  const selectedDate = new Date(sy, sm - 1, sd);
  const dayEvents = events[selectedKey] || [];

  document.getElementById("homeKicker").textContent = isToday ? "DDARIN · TODAY" : "DDARIN · SCHEDULE";
  const dateEl = document.getElementById("homeTodayDate");
  dateEl.textContent = `${sm}.${sd}`;
  const dowEl = document.createElement("small");
  dowEl.textContent = `${WEEKDAY_LABELS[selectedDate.getDay()]}요일`;
  dateEl.appendChild(dowEl);

  const badgeEl = document.getElementById("homeTodayBadge");
  const isHiatus = dayEvents.some((ev) => ev.title.includes("휴방"));
  const dayWord = isToday ? "오늘" : "이날";
  badgeEl.classList.toggle("hidden", !dayEvents.length);
  badgeEl.classList.toggle("hiatus", isHiatus);
  badgeEl.querySelector("span").textContent = isHiatus ? `${dayWord}은 휴방이에요` : `${dayWord} 방송 있어요`;

  const [title, withText] = dayEvents.length ? splitEventTitle(dayEvents[0].title) : [`${dayWord}은 일정이 없어요`, ""];
  document.getElementById("homeTodayTitle").textContent = dayEvents.length > 1 ? `${title} 외 ${dayEvents.length - 1}개` : title;
  document.getElementById("homeTodayWith").textContent = withText;

  const weekStrip = document.getElementById("homeWeekStrip");
  weekStrip.innerHTML = "";
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEl = document.createElement("button");
    dayEl.type = "button";
    dayEl.className = "home-day" + (key === selectedKey ? " on" : "") + (key === todayKey() ? " today" : "");
    dayEl.addEventListener("click", () => {
      homeSelectedKey = key;
      renderHome();
    });
    const dowLabel = document.createElement("span");
    dowLabel.textContent = WEEKDAY_LABELS[d.getDay()];
    const numEl = document.createElement("b");
    numEl.textContent = d.getDate();
    const dotsEl = document.createElement("i");
    (events[key] || []).slice(0, 3).forEach((ev) => {
      const dot = document.createElement("em");
      dot.style.background = homeDotColor(ev);
      dotsEl.appendChild(dot);
    });
    dayEl.append(dowLabel, numEl, dotsEl);
    weekStrip.appendChild(dayEl);
  }

  const upcomingEl = document.getElementById("homeUpcoming");
  upcomingEl.innerHTML = "";
  Object.keys(events)
    .filter((key) => key > todayKey())
    .sort()
    .flatMap((key) => events[key].map((ev) => [key, ev]))
    .slice(0, 3)
    .forEach(([key, ev]) => {
      const [y, m, d] = key.split("-").map(Number);
      const row = document.createElement("div");
      row.className = "home-ev";
      const dayEl = document.createElement("span");
      dayEl.className = "home-ev-day";
      dayEl.textContent = `${m}.${d} ${WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]}`;
      const bar = document.createElement("i");
      bar.className = "home-ev-bar";
      bar.style.background = homeDotColor(ev);
      const [evTitle, evWith] = splitEventTitle(ev.title);
      const textEl = document.createElement("div");
      textEl.className = "home-ev-text";
      const titleEl = document.createElement("b");
      titleEl.textContent = evTitle;
      textEl.appendChild(titleEl);
      if (evWith) {
        const withEl = document.createElement("span");
        withEl.textContent = evWith;
        textEl.appendChild(withEl);
      }
      row.append(dayEl, bar, textEl);
      upcomingEl.appendChild(row);
    });
}

document.getElementById("homeAllScheduleBtn").addEventListener("click", () => showMainView("calendar"));
document.getElementById("homePlaylistBtn").addEventListener("click", openSongbook);
document.getElementById("homeSongbookBtn").addEventListener("click", openSongbook2Table);
document.getElementById("homeYoutubeBtn").addEventListener("click", () => openYoutubeView("backmenu"));

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
  document.getElementById(`${prefix}SongbookBtn`).addEventListener("click", openSongbook2Table);
  document.getElementById(`${prefix}MailBtn`).addEventListener("click", () => showMainView("soopchat"));
}

wireNavMenu("cafePhotosNav", "cafePhotosHamburgerBtn", "cafePhotosNavMenu");
wireNavMenu("songbookNav", "songbookHamburgerBtn", "songbookNavMenu");
wireNavMenu("soopChatNav", "soopChatHamburgerBtn", "soopChatNavMenu");

const cafePhotosList = document.getElementById("cafePhotosList");

const cafePhotoLightbox = document.getElementById("cafePhotoLightbox");
const cafePhotoLightboxImg = document.getElementById("cafePhotoLightboxImg");
const cafePhotoLightboxLink = document.getElementById("cafePhotoLightboxLink");
const cafePhotoPostEl = document.querySelector(".cafe-photo-post");
const cafePhotoLikeCount = document.getElementById("cafePhotoLikeCount");
const cafePhotoCommentCount = document.getElementById("cafePhotoCommentCount");
const cafePhotoWriter = document.getElementById("cafePhotoWriter");
const cafePhotoTitle = document.getElementById("cafePhotoTitle");
const cafePhotoDate = document.getElementById("cafePhotoDate");

function closeCafePhotoLightbox() {
  cafePhotoLightbox.classList.add("hidden");
  cafePhotoPostEl.classList.remove("zoomed");
}
cafePhotoLightbox.addEventListener("click", (e) => {
  if (e.target === cafePhotoLightbox) closeCafePhotoLightbox();
});
document.getElementById("cafePhotoCloseBtn").addEventListener("click", closeCafePhotoLightbox);

// ===== 일정표 공지 팝업 =====
const calendarAnnounceBackdrop = document.getElementById("calendarAnnounceBackdrop");
const calendarAnnounceLikeCountEl = document.getElementById("calendarAnnounceLikeCount");
const calendarAnnounceCommentCountEl = document.getElementById("calendarAnnounceCommentCount");
const CALENDAR_ANNOUNCE_VIDEO_ID = "FVIbkuZhtq0";
const CALENDAR_ANNOUNCE_HIDE_KEY = "calendarAnnounceHideUntil";
const CALENDAR_ANNOUNCE_EXPIRE = new Date("2026-09-16T00:00:00+09:00");

async function loadCalendarAnnounceStats() {
  try {
    const res = await fetch(`/api/youtube-video-stats?id=${CALENDAR_ANNOUNCE_VIDEO_ID}`);
    const data = await res.json();
    calendarAnnounceLikeCountEl.textContent = (data.likeCount || 0).toLocaleString();
    calendarAnnounceCommentCountEl.textContent = (data.commentCount || 0).toLocaleString();
  } catch {
    // 실패 시 기존 값 유지
  }
}

function shouldShowCalendarAnnounce() {
  const now = new Date();
  if (now >= CALENDAR_ANNOUNCE_EXPIRE) return false;
  const hideUntil = localStorage.getItem(CALENDAR_ANNOUNCE_HIDE_KEY);
  if (hideUntil && now < new Date(hideUntil)) return false;
  return true;
}

function openCalendarAnnounce() {
  if (!shouldShowCalendarAnnounce()) return;
  loadCalendarAnnounceStats();
  calendarAnnounceBackdrop.classList.remove("hidden");
}

function closeCalendarAnnounce() {
  const popup = calendarAnnounceBackdrop.querySelector(".cafe-photo-post");
  const icon = document.getElementById("homeYoutubeBtn");

  if (!popup || !icon) {
    calendarAnnounceBackdrop.classList.add("hidden");
    return;
  }

  const popupRect = popup.getBoundingClientRect();
  const iconRect = icon.getBoundingClientRect();
  const dx = iconRect.left + iconRect.width / 2 - (popupRect.left + popupRect.width / 2);
  const dy = iconRect.top + iconRect.height / 2 - (popupRect.top + popupRect.height / 2);

  popup.style.transition = "transform 0.2s ease-in, opacity 0.2s ease-in";
  popup.style.transform = `translate(${dx}px, ${dy}px) scale(0.05)`;
  popup.style.opacity = "0";

  calendarAnnounceBackdrop.style.transition = "background-color 0.2s ease-in";
  calendarAnnounceBackdrop.style.backgroundColor = "rgba(0, 0, 0, 0)";

  setTimeout(() => {
    calendarAnnounceBackdrop.classList.add("hidden");
    calendarAnnounceBackdrop.style.transition = "";
    calendarAnnounceBackdrop.style.backgroundColor = "";
    popup.style.transition = "";
    popup.style.transform = "";
    popup.style.opacity = "";
  }, 200);
}

calendarAnnounceBackdrop.addEventListener("click", (e) => {
  if (e.target === calendarAnnounceBackdrop) closeCalendarAnnounce();
});
document.getElementById("calendarAnnounceCloseBtn").addEventListener("click", closeCalendarAnnounce);
document.getElementById("calendarAnnounceHideWeekBtn").addEventListener("click", () => {
  const until = new Date();
  until.setDate(until.getDate() + 7);
  localStorage.setItem(CALENDAR_ANNOUNCE_HIDE_KEY, until.toISOString());
  closeCalendarAnnounce();
});
// ================================================

document.getElementById("cafePhotoGotoPostBtn").addEventListener("click", () => {
  const item = cafePhotoItems[cafePhotoIndex];
  if (item) window.open(item.url, "_blank", "noopener");
});

let cafePhotoItems = [];
let cafePhotoIndex = 0;

function renderCafePhotoLightbox() {
  const item = cafePhotoItems[cafePhotoIndex];
  if (!item) return;
  cafePhotoLightboxImg.src = `/api/naver-image?url=${encodeURIComponent(item.image)}`;
  cafePhotoLikeCount.textContent = (item.likeCount || 0).toLocaleString();
  cafePhotoCommentCount.textContent = (item.commentCount || 0).toLocaleString();
  cafePhotoWriter.textContent = item.writer || "";
  cafePhotoTitle.textContent = item.title || "";
  cafePhotoDate.textContent = item.published ? new Date(item.published).toLocaleDateString("ko-KR") : "";
  cafePhotoBookmarkBtn.classList.toggle("pinned", isCafePhotoPinned(item.url));
}

const cafePhotoBookmarkBtn = document.getElementById("cafePhotoBookmarkBtn");
cafePhotoBookmarkBtn.addEventListener("click", () => {
  const item = cafePhotoItems[cafePhotoIndex];
  if (!item) return;
  toggleCafePhotoPinned(item.url);
  cafePhotoBookmarkBtn.classList.toggle("pinned", isCafePhotoPinned(item.url));
  renderCafePhotosGrid();
});

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
let cafePhotosRequestId = 0;

const CAFE_PHOTOS_PINNED_KEY = "cafe-photos-pinned";

function getPinnedCafePhotos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CAFE_PHOTOS_PINNED_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isCafePhotoPinned(url) {
  return getPinnedCafePhotos().includes(url);
}

function toggleCafePhotoPinned(url) {
  const pinned = getPinnedCafePhotos();
  const idx = pinned.indexOf(url);
  if (idx === -1) pinned.unshift(url);
  else pinned.splice(idx, 1);
  localStorage.setItem(CAFE_PHOTOS_PINNED_KEY, JSON.stringify(pinned));
}

function renderCafePhotosGrid() {
  const pinned = getPinnedCafePhotos();
  const sorted = [...cafePhotosAllItems].sort((a, b) => {
    const aPinned = pinned.includes(a.url) ? 1 : 0;
    const bPinned = pinned.includes(b.url) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return a._order - b._order;
  });

  const scrollTop = cafePhotosList.scrollTop;
  cafePhotosList.innerHTML = "";
  sorted.forEach((item, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "cafe-photo-card" + (pinned.includes(item.url) ? " pinned" : "");

    const tape = document.createElement("i");
    tape.className = "cafe-photo-tape";

    const img = document.createElement("img");
    img.className = "cafe-photo-img";
    img.src = `/api/naver-image?url=${encodeURIComponent(item.image)}`;
    img.alt = "";

    const titleEl = document.createElement("b");
    titleEl.className = "cafe-photo-card-title";
    titleEl.textContent = item.title || "";

    const metaEl = document.createElement("span");
    metaEl.className = "cafe-photo-card-meta";
    const writerEl = document.createElement("span");
    writerEl.textContent = item.writer || "";
    const likeEl = document.createElement("span");
    likeEl.textContent = `♡ ${(item.likeCount || 0).toLocaleString()}`;
    metaEl.append(writerEl, likeEl);

    card.append(tape, img, titleEl, metaEl);

    card.addEventListener("click", () => openCafePhotoLightbox(sorted, index));
    cafePhotosList.appendChild(card);
  });
  cafePhotosList.scrollTop = scrollTop;

  document.getElementById("cafePhotosPostCount").textContent = cafePhotosAllItems.length;
}

async function loadCafePhotosPage() {
  if (cafePhotosLoading || !cafePhotosHasMore) return;
  cafePhotosLoading = true;
  const requestId = cafePhotosRequestId;

  try {
    const params = new URLSearchParams({ page: cafePhotosPage, menuId: cafePhotosSource.menuId });
    if (cafePhotosSource.titleContains) params.set("titleContains", cafePhotosSource.titleContains);
    const res = await fetch(`/api/cafe-photos?${params}`);
    const data = await res.json();
    if (requestId !== cafePhotosRequestId) return;
    const items = data.items || [];
    cafePhotosHasMore = Boolean(data.hasMore);
    cafePhotosPage += 1;

    items.forEach((item) => {
      item._order = cafePhotosAllItems.length;
      cafePhotosAllItems.push(item);
    });
    renderCafePhotosGrid();

    if (!cafePhotosAllItems.length && !cafePhotosHasMore) {
      cafePhotosList.innerHTML = `<p class="cafe-photos-status">게시글을 불러오지 못했습니다.</p>`;
    }
  } catch {
    cafePhotosHasMore = false;
  } finally {
    cafePhotosLoading = false;
  }

  if (
    requestId === cafePhotosRequestId &&
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
  cafePhotosRequestId += 1;
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

document.getElementById("homePhotoBtn").addEventListener("click", () => {
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

const YOUTUBE_RECENT_API_URL = "/api/youtube-recent";
let youtubeRecentVideos = null;

async function loadYoutubeRecentVideos() {
  if (youtubeRecentVideos) return youtubeRecentVideos;
  try {
    const res = await fetch(YOUTUBE_RECENT_API_URL);
    youtubeRecentVideos = res.ok ? await res.json() : [];
  } catch {
    youtubeRecentVideos = [];
  }
  return youtubeRecentVideos;
}

// ===== 홈 메뉴 유튜브 아이콘 새 영상 알림 점 =====
const YOUTUBE_SIDEBAR_SEEN_KEY = "sidebar-youtube-seen-until";
const youtubeNewBadge = document.getElementById("youtubeNewBadge");

async function refreshYoutubeSidebarBadge() {
  const videos = await loadYoutubeRecentVideos();
  const latest = (videos || [])[0];
  const seenUntil = localStorage.getItem(YOUTUBE_SIDEBAR_SEEN_KEY) || "";
  youtubeNewBadge.classList.toggle("hidden", !latest || latest.published <= seenUntil);
}

refreshYoutubeSidebarBadge();
// ================================================

// ===== 유튜브 업로드(WATCH) 화면 =====
const youtubeView = document.getElementById("youtubeView");
const youtubeBackBtn = document.getElementById("youtubeBackBtn");
const youtubeChannelToggle = document.getElementById("youtubeChannelToggle");
const youtubeCardTrack = document.getElementById("youtubeCardTrack");
const youtubeChannelLink = document.getElementById("youtubeChannelLink");
const youtubeHeroBadge = document.getElementById("youtubeHeroBadge");
const YOUTUBE_CHANNEL_NAMES = { shorts: "따린", longform: "세이브따린" };
const YOUTUBE_SEEN_KEY = "youtube-seen-videos";

function getSeenYoutubeIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(YOUTUBE_SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markYoutubeSeen(id) {
  const seen = getSeenYoutubeIds();
  seen.add(id);
  localStorage.setItem(YOUTUBE_SEEN_KEY, JSON.stringify([...seen].slice(-200)));
}

function youtubeMonthLabel(isoDate) {
  const d = new Date(isoDate);
  const now = new Date();
  if (d.getFullYear() !== now.getFullYear()) return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  return d.getMonth() === now.getMonth() ? `${d.getMonth() + 1}월 · 이번 달` : `${d.getMonth() + 1}월`;
}
const youtubeHeroCard = document.getElementById("youtubeHeroCard");
const youtubeHeroThumb = document.getElementById("youtubeHeroThumb");
const youtubeHeroTitle = document.getElementById("youtubeHeroTitle");
const youtubeHeroChannel = document.getElementById("youtubeHeroChannel");
const youtubeHeroTime = document.getElementById("youtubeHeroTime");
const YOUTUBE_CHANNEL_URLS = {
  shorts: "https://www.youtube.com/channel/UCuROXT7djegOJSyVp1lhx-w",
  longform: "https://www.youtube.com/channel/UC5YFkTsmwnAm__Cvt66BRhA",
};
let youtubeActiveGroup = "shorts";

function formatTimeAgo(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${Math.max(minutes, 0)}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}주 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

// 고른 채널의 최신 영상은 위에 크게, 나머지는 달별로 묶어 목록으로 (쇼츠는 세로 카드, 풀영상은 가로 줄)
function renderYoutubeCards() {
  const videos = (youtubeRecentVideos || []).filter((v) => v.group === youtubeActiveGroup).slice(1);
  const seen = getSeenYoutubeIds();
  youtubeCardTrack.innerHTML = "";
  youtubeCardTrack.classList.toggle("tall", youtubeActiveGroup === "shorts");

  if (!videos.length) {
    const empty = document.createElement("p");
    empty.className = "yt-empty";
    empty.textContent = "업로드된 영상이 없습니다.";
    youtubeCardTrack.appendChild(empty);
    return;
  }

  let lastMonth = null;
  videos.forEach((v) => {
    const month = youtubeMonthLabel(v.published);
    if (month !== lastMonth) {
      const divider = document.createElement("div");
      divider.className = "yt-month";
      divider.textContent = month;
      youtubeCardTrack.appendChild(divider);
      lastMonth = month;
    }

    const card = document.createElement("a");
    card.className = "yt-vid" + (seen.has(v.id) ? " seen" : "");
    card.href = v.url;
    card.target = "_blank";
    card.rel = "noopener";
    card.addEventListener("click", () => {
      markYoutubeSeen(v.id);
      card.classList.add("seen");
    });

    const thumbWrap = document.createElement("span");
    thumbWrap.className = "yt-vid-thumb";
    const thumb = document.createElement("img");
    thumb.src = v.thumbnailLarge || v.thumbnail;
    thumb.alt = "";
    thumb.loading = "lazy";
    const seenMark = document.createElement("span");
    seenMark.className = "yt-seen-mark";
    seenMark.textContent = "✓ 본 영상";
    thumbWrap.append(thumb, seenMark);

    const text = document.createElement("span");
    text.className = "yt-vid-text";
    const title = document.createElement("b");
    title.textContent = v.title;
    const time = document.createElement("span");
    time.className = "yt-vid-time";
    time.textContent = formatTimeAgo(v.published);
    // 쇼츠는 시간을 썸네일 오른쪽 아래에 얹음
    if (youtubeActiveGroup === "shorts") thumbWrap.appendChild(time);
    else text.appendChild(time);
    text.prepend(title);

    card.append(thumbWrap, text);
    youtubeCardTrack.appendChild(card);
  });
}

function renderYoutubeHero() {
  const latest = (youtubeRecentVideos || []).find((v) => v.group === youtubeActiveGroup);
  if (!latest) {
    youtubeHeroCard.classList.add("hidden");
    return;
  }
  youtubeHeroCard.classList.remove("hidden");
  youtubeHeroCard.href = latest.url;
  youtubeHeroCard.onclick = () => markYoutubeSeen(latest.id);
  youtubeHeroThumb.onerror = () => {
    youtubeHeroThumb.onerror = null;
    youtubeHeroThumb.src = latest.thumbnailLarge || latest.thumbnail;
  };
  youtubeHeroThumb.src = `https://i.ytimg.com/vi/${latest.id}/maxresdefault.jpg`;
  youtubeHeroTitle.textContent = latest.title;
  youtubeHeroChannel.textContent = YOUTUBE_CHANNEL_NAMES[latest.group] || "";
  youtubeHeroTime.textContent = formatTimeAgo(latest.published);
  const fresh = Date.now() - new Date(latest.published).getTime() <= 7 * 86400000;
  youtubeHeroBadge.classList.toggle("fresh", fresh);
  youtubeHeroBadge.textContent = fresh ? "NEW" : "최신";
}

// 뒤로 가기는 들어온 곳으로 (홈 메뉴 → 홈, 사이드바 → 일정표)
let youtubeReturnView = "calendar";

async function openYoutubeView(returnView = "calendar") {
  youtubeReturnView = returnView;
  localStorage.setItem(YOUTUBE_SIDEBAR_SEEN_KEY, new Date().toISOString());
  youtubeNewBadge.classList.add("hidden");

  showMainView("youtube");
  await loadYoutubeRecentVideos();
  renderYoutubeHero();
  renderYoutubeCards();
}

youtubeBackBtn.addEventListener("click", () => showMainView(youtubeReturnView));

youtubeChannelToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".youtube-channel-seg");
  if (!btn) return;
  youtubeActiveGroup = btn.dataset.group;
  youtubeChannelToggle.querySelectorAll(".youtube-channel-seg").forEach((el) => el.classList.toggle("active", el === btn));
  youtubeChannelLink.href = YOUTUBE_CHANNEL_URLS[youtubeActiveGroup];
  document.getElementById("youtubeMoreLabel").textContent = `${YOUTUBE_CHANNEL_NAMES[youtubeActiveGroup]} 채널에서 더 보기`;
  youtubeCardTrack.parentElement.scrollTop = 0;
  renderYoutubeHero();
  renderYoutubeCards();
});
// ================================================

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

const soopChatList = document.getElementById("soopChatList");
const soopChatDayList = document.getElementById("soopChatDayList");
let currentSoopChatDayItems = [];

let activeSoopChatDeleteBtn = null;
let activeSoopChatDeleteBtnJustShown = false;

document.addEventListener("click", (e) => {
  if (!activeSoopChatDeleteBtn) return;
  if (activeSoopChatDeleteBtnJustShown) {
    activeSoopChatDeleteBtnJustShown = false;
    return;
  }
  if (!activeSoopChatDeleteBtn.contains(e.target)) {
    activeSoopChatDeleteBtn.remove();
    activeSoopChatDeleteBtn = null;
  }
});

const SOOP_CHAT_SEEN_KEY = "soopChatSeenUntil";

function getSoopChatSeenUntil() {
  return localStorage.getItem(SOOP_CHAT_SEEN_KEY) || "";
}

function setSoopChatSeenUntil(iso) {
  if (iso) localStorage.setItem(SOOP_CHAT_SEEN_KEY, iso);
}

const SOOP_CHAT_HIDDEN_KEY = "soopChatHiddenTimes";

function getSoopChatHiddenTimes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SOOP_CHAT_HIDDEN_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hideSoopChatMessageLocally(time) {
  const hidden = getSoopChatHiddenTimes();
  if (!hidden.includes(time)) hidden.push(time);
  localStorage.setItem(SOOP_CHAT_HIDDEN_KEY, JSON.stringify(hidden));
}

function formatSoopChatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatSoopChatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

const SOOP_CHAT_RETENTION_DAYS = 7;

function soopChatDateKeySeoul(input) {
  const d = input ? new Date(input) : new Date();
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function soopChatDaysUntilDeletion(iso) {
  const msgDate = new Date(`${soopChatDateKeySeoul(iso)}T00:00:00+09:00`);
  const today = new Date(`${soopChatDateKeySeoul()}T00:00:00+09:00`);
  const daysSince = Math.round((today - msgDate) / (24 * 60 * 60 * 1000));
  return SOOP_CHAT_RETENTION_DAYS - daysSince;
}

function groupSoopChatByDate(items) {
  const groups = [];
  items.forEach((item) => {
    const dateKey = formatSoopChatDate(item.time);
    const groupKey = item.broadcastId || dateKey;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.groupKey === groupKey) {
      lastGroup.items.push(item);
    } else {
      groups.push({ groupKey, dateKey, items: [item] });
    }
  });
  return groups;
}

async function loadSoopChatView() {
  soopChatList.innerHTML = `<div class="memo-card-empty">불러오는 중...</div>`;

  try {
    const res = await fetch("/api/soop-chat");
    const data = await res.json();
    const hiddenTimes = getSoopChatHiddenTimes();
    const items = ((data && data.items) || []).filter((it) => !hiddenTimes.includes(it.time));
    const seenUntil = getSoopChatSeenUntil();
    soopChatList.innerHTML = "";
    groupSoopChatByDate(items).forEach((group) => {
      const [first, ...rest] = group.items;
      const isUnread = group.items.some((it) => it.time > seenUntil);

      const card = document.createElement("div");
      card.className = "soop-chat-row";

      const avatar = document.createElement("span");
      avatar.className = "back-menu-avatar soop-chat-avatar";

      const info = document.createElement("div");
      info.className = "soop-chat-info";

      const infoTop = document.createElement("div");
      infoTop.className = "soop-chat-info-top";

      const nameEl = document.createElement("span");
      nameEl.className = "soop-chat-name";
      nameEl.textContent = "DDARIN";

      const retentionNote = document.createElement("span");
      retentionNote.className = "soop-chat-retention-note";
      retentionNote.textContent = `${soopChatDaysUntilDeletion(first.time)}일 후 삭제`;
      nameEl.appendChild(retentionNote);

      const dateEl = document.createElement("span");
      dateEl.className = "soop-chat-date";
      dateEl.textContent = group.dateKey;

      const messageEl = document.createElement("div");
      messageEl.className = "soop-chat-message";
      messageEl.textContent = `${formatSoopChatTime(first.time)}  ${first.message}`;

      infoTop.append(nameEl, dateEl);
      info.append(infoTop, messageEl);
      card.append(avatar, info);
      let badge = null;
      if (isUnread) {
        badge = document.createElement("span");
        badge.className = "soop-chat-badge";
        card.appendChild(badge);
      }
      soopChatList.appendChild(card);

      card.style.cursor = "pointer";

      let longPressTimer = null;
      let longPressed = false;

      card.addEventListener("pointerdown", () => {
        longPressed = false;
        longPressTimer = setTimeout(() => {
          longPressed = true;
          if (card.querySelector(".soop-chat-delete-btn")) return;
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "soop-chat-delete-btn";
          delBtn.textContent = "삭제";
          delBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            group.items.forEach((it) => hideSoopChatMessageLocally(it.time));
            activeSoopChatDeleteBtn = null;
            loadSoopChatView();
          });
          card.appendChild(delBtn);
          activeSoopChatDeleteBtn = delBtn;
          activeSoopChatDeleteBtnJustShown = true;
        }, 500);
      });
      card.addEventListener("pointerup", () => clearTimeout(longPressTimer));
      card.addEventListener("pointerleave", () => clearTimeout(longPressTimer));

      card.addEventListener("click", () => {
        if (longPressed) return;
        if (badge) badge.remove();
        const groupMaxTime = group.items.reduce((max, it) => (it.time > max ? it.time : max), "");
        if (groupMaxTime > getSoopChatSeenUntil()) {
          setSoopChatSeenUntil(groupMaxTime);
        }
        if (rest.length) {
          currentSoopChatDayItems = group.items;
          showMainView("soopchatday");
        }
      });
    });
  } catch {
    soopChatList.innerHTML = "";
  }
}

function renderSoopChatDayView() {
  soopChatDayList.innerHTML = "";
  currentSoopChatDayItems.forEach((item, index) => {
    const next = currentSoopChatDayItems[index + 1];
    const sameMinuteAsNext = next && formatSoopChatTime(item.time) === formatSoopChatTime(next.time);

    const row = document.createElement("div");
    row.className = "soop-chat-bubble-row";

    const avatar = document.createElement("span");
    avatar.className = "back-menu-avatar soop-chat-bubble-avatar";

    const bubble = document.createElement("div");
    bubble.className = "soop-chat-bubble";
    bubble.textContent = item.message;

    const timeEl = document.createElement("span");
    timeEl.className = "soop-chat-bubble-time";
    timeEl.textContent = sameMinuteAsNext ? "" : formatSoopChatTime(item.time);

    row.append(avatar, bubble, timeEl);
    soopChatDayList.appendChild(row);

    let longPressTimer = null;
    row.addEventListener("pointerdown", () => {
      longPressTimer = setTimeout(() => {
        if (row.querySelector(".soop-chat-delete-btn")) return;
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "soop-chat-delete-btn";
        delBtn.textContent = "삭제";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          hideSoopChatMessageLocally(item.time);
          activeSoopChatDeleteBtn = null;
          currentSoopChatDayItems = currentSoopChatDayItems.filter((it) => it.time !== item.time);
          if (currentSoopChatDayItems.length) {
            renderSoopChatDayView();
          } else {
            showMainView("soopchat");
          }
        });
        row.appendChild(delBtn);
        activeSoopChatDeleteBtn = delBtn;
        activeSoopChatDeleteBtnJustShown = true;
      }, 500);
    });
    row.addEventListener("pointerup", () => clearTimeout(longPressTimer));
    row.addEventListener("pointerleave", () => clearTimeout(longPressTimer));
  });
}

document.getElementById("soopChatDayBackBtn").addEventListener("click", () => showMainView("soopchat"));

memoBtn.addEventListener("click", openMemoPanel);

async function hardRefreshApp() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } finally {
    // location.reload()는 브라우저 HTTP 캐시를 그대로 쓸 수 있어서, 쿼리스트링을 바꿔
    // 강제로 새 URL처럼 취급되게 만들어 Ctrl+Shift+R(강력 새로고침)과 동일하게 동작시킨다.
    location.replace(location.pathname + "?_=" + Date.now());
  }
}

calendarPostMenuBtn.addEventListener("click", hardRefreshApp);

// ===== 일정 검색 (이전 달 포함 전체 일정에서 제목 검색) =====
const scheduleSearchBtn = document.getElementById("scheduleSearchBtn");
const scheduleSearchModalBackdrop = document.getElementById("scheduleSearchModalBackdrop");
const closeScheduleSearchModalBtn = document.getElementById("closeScheduleSearchModalBtn");
const scheduleSearchInput = document.getElementById("scheduleSearchInput");
const scheduleSearchResults = document.getElementById("scheduleSearchResults");

function closeScheduleSearchModal() {
  scheduleSearchModalBackdrop.classList.add("hidden");
}

function renderScheduleSearchResults(query) {
  scheduleSearchResults.innerHTML = "";
  const q = query.trim().toLowerCase();
  if (!q) return;

  const events = loadEvents();
  const matches = [];
  Object.keys(events).forEach((date) => {
    events[date].forEach((ev) => {
      if (ev.title.toLowerCase().includes(q)) matches.push({ date, title: ev.title });
    });
  });
  matches.sort((a, b) => (a.date < b.date ? 1 : -1));

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "schedule-search-empty";
    empty.textContent = "검색 결과가 없습니다.";
    scheduleSearchResults.appendChild(empty);
    return;
  }

  matches.forEach((m) => {
    const [, mo, d] = m.date.split("-");
    const item = document.createElement("button");
    item.type = "button";
    item.className = "schedule-search-result";

    const dateEl = document.createElement("span");
    dateEl.className = "schedule-search-result-date";
    dateEl.textContent = `${parseInt(mo)}.${parseInt(d)}`;

    const titleEl = document.createElement("span");
    titleEl.className = "schedule-search-result-title";
    titleEl.textContent = m.title;

    item.append(dateEl, titleEl);
    item.addEventListener("click", () => {
      closeScheduleSearchModal();
      const y = parseInt(m.date);
      if (y >= MIN_YEAR && y <= MAX_YEAR) YEAR = y;
      currentMonth = parseInt(mo) - 1;
      setViewMode("list");
      renderGrid();
      showMainView("calendar");
      openDayPopup(m.date);
    });

    scheduleSearchResults.appendChild(item);
  });
}

scheduleSearchBtn.addEventListener("click", () => {
  scheduleSearchModalBackdrop.classList.remove("hidden");
  scheduleSearchInput.value = "";
  scheduleSearchResults.innerHTML = "";
  scheduleSearchInput.focus();
});
closeScheduleSearchModalBtn.addEventListener("click", closeScheduleSearchModal);
scheduleSearchModalBackdrop.addEventListener("click", (e) => {
  if (e.target === scheduleSearchModalBackdrop) closeScheduleSearchModal();
});
scheduleSearchInput.addEventListener("input", () => renderScheduleSearchResults(scheduleSearchInput.value));
// ================================================

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
  songRouletteFilterMenu.querySelectorAll(".genre-tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.genre === songRouletteGenre);
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
  const now = new Date();
  document.getElementById("calendarPostDate").textContent =
    `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  prevBtn.disabled = YEAR === MIN_YEAR && currentMonth === 0;
  nextBtn.disabled = YEAR === MAX_YEAR && currentMonth === 11;
  yearSeg.querySelectorAll("[data-year]").forEach((b) => b.classList.toggle("active", Number(b.dataset.year) === YEAR));

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

  if (!monthNewView.classList.contains("hidden")) renderMonthNew();
}

// 주간 일정: 세로 타임라인. 모바일은 일정을 누르면 그 자리에서 펼치고, PC는 오른쪽에 고른 날 상세
const wkDetail = document.getElementById("wkDetail");
const wideWeekQuery = window.matchMedia("(min-width: 901px)");
let wkOpenId = null;
let wkSelKey = null;

function weekEventTime(title) {
  const match = title.match(/^(\d{1,2})시\s*/);
  if (!match) return ["", title];
  const hour = Number(match[1]);
  return [`${String(hour < 12 ? hour + 12 : hour).padStart(2, "0")}:00`, title.slice(match[0].length)];
}

function weekEventKind(ev) {
  if (getColorInfo(ev).key === "green") return "release";
  return getEventBadgeLabel(ev) === "휴방" ? "hiatus" : "broadcast";
}

// 공지사항(SOOP)·따카오톡(카페) 상자를 비동기로 채움
function fillWeekNotices(container, key) {
  // 응답 순서와 상관없이 공지사항 → 따카오톡 순서로, 뒤에 붙는 버튼보다 앞에 놓이게 자리를 먼저 잡아둠
  const slots = [document.createElement("span"), document.createElement("span")];
  slots.forEach((slot) => {
    slot.className = "wk-box-slot";
    container.appendChild(slot);
  });
  const addBox = (slot, label, title, content, url) => {
    const box = document.createElement("a");
    box.className = "wk-box";
    box.href = url;
    box.target = "_blank";
    box.rel = "noopener";
    box.addEventListener("click", (e) => e.stopPropagation());
    const head = document.createElement("span");
    head.className = "wk-box-head";
    head.innerHTML = `<span>${label}</span><span>바로가기 ↗</span>`;
    const titleEl = document.createElement("b");
    titleEl.textContent = title;
    box.append(head, titleEl);
    if (content) {
      const p = document.createElement("p");
      p.textContent = content;
      box.appendChild(p);
    }
    slot.replaceWith(box);
  };
  fetchSoopNoticeCached(key)
    .then((posts) => posts && posts.length && addBox(slots[0], "공지사항", posts[0].title, posts[0].content, posts[0].url))
    .catch(() => soopNoticeCache.delete(key));
  fetchCafeNoticeCached(key)
    .then((posts) => posts && posts.length && addBox(slots[1], "따카오톡", posts[0].title, "", posts[0].url))
    .catch(() => cafeNoticeCache.delete(key));
}

function buildWeekEvent(ev, key, withMore, tag = "button") {
  const el = document.createElement(tag);
  if (tag === "button") el.type = "button";
  el.style.setProperty("--c", homeDotColor(ev));

  const [rawTitle, withText] = splitEventTitle(ev.title);
  const [time, title] = weekEventTime(rawTitle);
  const top = document.createElement("span");
  top.className = "wk-ev-top";
  if (time) {
    const timeEl = document.createElement("span");
    timeEl.className = "wk-ev-time";
    timeEl.textContent = time;
    top.appendChild(timeEl);
  }
  const titleEl = document.createElement("b");
  titleEl.textContent = title;
  top.appendChild(titleEl);

  const meta = document.createElement("span");
  meta.className = "wk-ev-meta";
  const kindEl = document.createElement("span");
  kindEl.className = "wk-ev-kind";
  kindEl.textContent = getEventBadgeLabel(ev) || "방송";
  meta.appendChild(kindEl);
  if (withText) {
    const withEl = document.createElement("span");
    withEl.className = "wk-ev-with";
    withEl.textContent = `· ${withText.replace(/^w\.\s*/, "")}`;
    meta.appendChild(withEl);
  }
  el.append(top, meta);

  if (withMore) {
    const more = document.createElement("span");
    more.className = "wk-more";
    fillWeekNotices(more, key);
    const detailBtn = document.createElement("span");
    detailBtn.className = "wk-detail-btn";
    detailBtn.setAttribute("role", "button");
    detailBtn.textContent = "자세히 보기 ›";
    detailBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDayPopup(key);
    });
    more.appendChild(detailBtn);
    el.appendChild(more);
  }
  return el;
}

function renderWeekDetail(key) {
  const events = loadEvents()[key] || [];
  const [y, m, d] = key.split("-").map(Number);
  wkDetail.innerHTML = "";

  const kicker = document.createElement("div");
  kicker.className = "wk-det-k";
  kicker.textContent = key === todayKey() ? "TODAY" : "SCHEDULE";
  const dateEl = document.createElement("div");
  dateEl.className = "wk-det-d";
  dateEl.textContent = `${m}월 ${d}일`;
  const dowEl = document.createElement("em");
  dowEl.textContent = `${WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]}요일`;
  dateEl.appendChild(dowEl);
  wkDetail.append(kicker, dateEl);

  if (!events.length) {
    const none = document.createElement("div");
    none.className = "wk-det-none";
    none.textContent = "이날은 일정이 없어요";
    wkDetail.appendChild(none);
  }
  const list = document.createElement("div");
  list.className = "wk-det-list";
  events.forEach((ev) => {
    const card = buildWeekEvent(ev, key, false, "div");
    card.classList.add("wk-det-ev");
    list.appendChild(card);
  });
  wkDetail.appendChild(list);

  const notices = document.createElement("div");
  notices.className = "wk-det-notices";
  fillWeekNotices(notices, key);
  wkDetail.appendChild(notices);

  const detailBtn = document.createElement("button");
  detailBtn.type = "button";
  detailBtn.className = "wk-detail-btn";
  detailBtn.textContent = "자세히 보기 ›";
  detailBtn.addEventListener("click", () => openDayPopup(key));
  wkDetail.appendChild(detailBtn);
}

function renderCardView() {
  const events = loadEvents();
  const today = todayKey();
  cardList.innerHTML = "";

  const weekKeys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(cardWeekStart.getFullYear(), cardWeekStart.getMonth(), cardWeekStart.getDate() + i);
    weekKeys.push(dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  if (!weekKeys.includes(wkSelKey)) wkSelKey = weekKeys.includes(today) ? today : weekKeys[0];

  const counts = { broadcast: 0, release: 0, hiatus: 0 };

  weekKeys.forEach((key, i) => {
    const [y, m, d] = key.split("-").map(Number);
    const dayEvents = events[key] || [];
    dayEvents.forEach((ev) => counts[weekEventKind(ev)]++);

    const row = document.createElement("div");
    row.className = "wk-day";
    if (key === today) row.classList.add("today");
    if (key < today) row.classList.add("past");
    if (key === wkSelKey) row.classList.add("sel");
    row.addEventListener("click", () => {
      if (!wideWeekQuery.matches) return;
      wkSelKey = key;
      renderCardView();
    });

    const dateEl = document.createElement("button");
    dateEl.type = "button";
    dateEl.className = "wk-date" + (i === 0 ? " sun" : i === 6 ? " sat" : "");
    dateEl.innerHTML = `<b>${d}</b><span>${key === today ? "오늘" : WEEKDAY_LABELS[i]}</span>`;
    dateEl.addEventListener("click", (e) => {
      e.stopPropagation();
      openDayPopup(key);
    });

    const dot = document.createElement("i");
    dot.className = "wk-dot";
    if (dayEvents.length) {
      dot.classList.add("has");
      dot.style.setProperty("--c", homeDotColor(dayEvents[0]));
    }

    const body = document.createElement("div");
    body.className = "wk-body";
    if (!dayEvents.length) {
      const none = document.createElement("button");
      none.type = "button";
      none.className = "wk-none";
      none.textContent = "일정 없음";
      none.addEventListener("click", (e) => {
        if (wideWeekQuery.matches) return;
        e.stopPropagation();
        openDayPopup(key);
      });
      body.appendChild(none);
    }
    dayEvents.forEach((ev, index) => {
      const id = `${key}#${index}`;
      const open = !wideWeekQuery.matches && wkOpenId === id;
      const evEl = buildWeekEvent(ev, key, open);
      evEl.className = "wk-ev" + (open ? " open" : "");
      evEl.addEventListener("click", (e) => {
        if (wideWeekQuery.matches) return;
        e.stopPropagation();
        wkOpenId = wkOpenId === id ? null : id;
        renderCardView();
      });
      body.appendChild(evEl);
    });

    row.append(dateEl, dot, body);
    cardList.appendChild(row);
  });

  cardList.classList.toggle("has-open", cardList.querySelector(".wk-ev.open") !== null);
  renderWeekDetail(wkSelKey);

  const summary = document.getElementById("wkSummary");
  summary.innerHTML = "";
  [
    ["broadcast", "방송"],
    ["release", "출시"],
    ["hiatus", "휴방"],
  ].forEach(([kind, label]) => {
    const item = document.createElement("span");
    item.className = `wk-sum-item ${kind}`;
    item.innerHTML = `<i></i>${label} <b>${counts[kind]}</b>`;
    summary.appendChild(item);
  });

  const [fy, fm, fd] = weekKeys[0].split("-").map(Number);
  const [ly, lm, ld] = weekKeys[6].split("-").map(Number);
  document.getElementById("wkRange").textContent = `${fm}.${fd} 일 – ${lm}.${ld} 토`;

  weekPrevBtn.disabled = YEAR === MIN_YEAR && currentMonth === 0 && cardWeekStart <= firstWeekOfMonth(0);
  weekNextBtn.disabled = YEAR === MAX_YEAR && currentMonth === 11 && cardWeekStart >= lastWeekOfMonth(11);

  const diffDays = Math.round((cardWeekStart - firstWeekOfMonth(currentMonth)) / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;
  monthTitle.textContent = `${currentMonth + 1}월 ${weekNum}째주`;
  document.getElementById("wkTitle").textContent = monthTitle.textContent;
  fitWeekView();
}

// 주간 일정이 스크롤 없이 화면 높이에 딱 맞게 (줌이 걸린 부모를 고려해 실제 보이는 크기로 계산)
function fitWeekView() {
  if (cardView.classList.contains("hidden")) return;
  // PC에선 기본 월간 달력과 같은 높이
  const classic = !mnMobileQuery.matches && classicAppHeight();
  if (classic) {
    cardView.style.height = `${classic - 6}px`;
    return;
  }
  const rect = cardView.getBoundingClientRect();
  const scale = cardView.offsetHeight ? rect.height / cardView.offsetHeight : 1;
  const available = window.innerHeight - rect.top - 16;
  cardView.style.height = `${Math.max(460, available / (scale || 1))}px`;
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
  modalDate.textContent = `${parseInt(key)}년 ${parseInt(m)}월 ${parseInt(d)}일`;
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
  if (colorPickerList.classList.contains("hidden")) {
    const rect = colorPickerBtn.getBoundingClientRect();
    colorPickerList.style.top = `${rect.bottom + 4}px`;
    colorPickerList.style.left = `${rect.left}px`;
    colorPickerList.style.width = `${rect.width}px`;
  }
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
  if (currentMainView === "backmenu") renderHome();
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

function switchCalendarYear(y) {
  const today = new Date();
  YEAR = y;
  currentMonth = today.getFullYear() === y ? today.getMonth() : 0;
  renderGrid();
  if (viewMode === "card") {
    resetCardWeekToMonth();
    renderCardView();
  }
}

yearSeg.addEventListener("click", (e) => {
  const b = e.target.closest("[data-year]");
  if (b && Number(b.dataset.year) !== YEAR) switchCalendarYear(Number(b.dataset.year));
});

prevBtn.addEventListener("click", () => {
  if (currentMonth > 0 || YEAR > MIN_YEAR) {
    if (currentMonth > 0) currentMonth--;
    else {
      YEAR--;
      currentMonth = 11;
    }
    renderGrid();
    if (viewMode === "card") {
      resetCardWeekToMonth();
      renderCardView();
    }
  }
});

nextBtn.addEventListener("click", () => {
  if (currentMonth < 11 || YEAR < MAX_YEAR) {
    if (currentMonth < 11) currentMonth++;
    else {
      YEAR++;
      currentMonth = 0;
    }
    renderGrid();
    if (viewMode === "card") {
      resetCardWeekToMonth();
      renderCardView();
    }
  }
});

// 주 이동: 달의 처음/끝을 넘어가면 옆 달로 넘어감
weekPrevBtn.addEventListener("click", () => {
  cardWeekStart.setDate(cardWeekStart.getDate() - 7);
  if (cardWeekStart < firstWeekOfMonth(currentMonth)) {
    if (currentMonth === 0 && YEAR === MIN_YEAR) {
      cardWeekStart.setDate(cardWeekStart.getDate() + 7);
      return;
    }
    if (currentMonth > 0) currentMonth--;
    else {
      YEAR--;
      currentMonth = 11;
    }
    renderGrid();
  }
  wkOpenId = null;
  renderCardView();
});

weekNextBtn.addEventListener("click", () => {
  cardWeekStart.setDate(cardWeekStart.getDate() + 7);
  if (cardWeekStart > lastWeekOfMonth(currentMonth)) {
    if (currentMonth === 11 && YEAR === MAX_YEAR) {
      cardWeekStart.setDate(cardWeekStart.getDate() - 7);
      return;
    }
    if (currentMonth < 11) currentMonth++;
    else {
      YEAR++;
      currentMonth = 0;
    }
    renderGrid();
  }
  wkOpenId = null;
  renderCardView();
});

document.getElementById("wkTodayBtn").addEventListener("click", () => {
  const today = new Date();
  const ty = today.getFullYear();
  if (ty < MIN_YEAR || ty > MAX_YEAR) return;
  YEAR = ty;
  currentMonth = today.getMonth();
  renderGrid();
  resetCardWeekToMonth();
  wkSelKey = todayKey();
  wkOpenId = null;
  renderCardView();
});

window.addEventListener("resize", () => {
  if (viewMode === "card") renderCardView();
  fitMonthNew();
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
  // 새 디자인 월간을 먼저 숨겨야 주간 높이를 제대로 잼
  syncMonthDesign();
  if (mode === "card") {
    resetCardWeekToMonth();
    renderCardView();
  } else {
    // 주간 제목("10월 5째주")이 월간에 남지 않게
    monthTitle.textContent = `${currentMonth + 1}월`;
  }
}

viewModeWeekBtn.addEventListener("click", () => setViewMode("card"));
viewModeMonthBtn.addEventListener("click", () => setViewMode("list"));
document.getElementById("wkMonthBtn").addEventListener("click", () => setViewMode("list"));

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
}

async function tryAutoUnlock() {
  const { username: user, password: pw } = getStoredCreds();
  if (!pw || !user) {
    isReadOnly = true;
    return;
  }
  const res = await apiPost({ action: "checkPassword", username: user, password: pw });
  if (res === null) {
    // 서버 응답을 못 받은 경우(네트워크 오류 등) - 자격 증명은 그대로 두고 이번 로드만 읽기 전용으로 처리
    isReadOnly = true;
    return;
  }
  const ok = !!res.ok;
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

// 월간 새 디자인: 맨 위 토글로 기본(지금 달력) ↔ 새 디자인. 처음엔 기본, 그 뒤엔 고른 걸 기억함
// (예전 키에 저장된 선택은 버리고 모두 기본에서 다시 시작)
// PC는 큰 달력 + 날짜를 누르면 왼쪽 일정 · 오른쪽 공지 창, 모바일은 작은 달력 + 주별 목록
const CAL_DESIGN_KEY = "calendar-month-design-v2";
const monthNewView = document.getElementById("monthNewView");
const calDesignToggle = document.getElementById("calDesignToggle");
const mnMobileQuery = window.matchMedia("(max-width: 700px)");
let calDesign = "classic";
try {
  localStorage.removeItem("calendar-month-design");
  if (localStorage.getItem(CAL_DESIGN_KEY) === "new") calDesign = "new";
} catch {}

const MN_KINDS = [
  ["gray", "갠방"],
  ["blue", "종겜"],
  ["purple", "합방"],
  ["yellow", "노래관련"],
  ["green", "게임 출시"],
  ["#cc0000", "휴방"],
  ["#e951d0", "커머스"],
  ["#ff6f00", "같이보기"],
];
const MN_ARROW = (dir) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="${dir < 0 ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}"/></svg>`;

function mnEsc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function mnMembers(title) {
  const match = title.match(ATTENDEE_RE);
  return match ? match[1].split(/[,、&]/).map((n) => n.trim()).filter(Boolean).join(", ") : "";
}

// 기본 월간 달력이 보였을 때의 판 높이 (잠깐 기본 상태로 바꿔서 재고 바로 되돌림)
function classicAppHeight() {
  const app = grid.closest(".app");
  const els = [grid, monthNewView, cardView, calendarHeaderEl, weekdayRow];
  const saved = els.map((el) => el.className);
  grid.classList.remove("hidden");
  monthNewView.classList.add("hidden");
  cardView.classList.add("hidden");
  calendarHeaderEl.classList.remove("card-mode", "mn-mode");
  weekdayRow.classList.remove("card-mode");
  const height = app.offsetHeight;
  els.forEach((el, i) => (el.className = saved[i]));
  return height;
}

// PC 새 디자인 월간도 기본 달력과 같은 높이 (일정이 많아 넘치면 그만큼 늘어남)
function fitMonthNew() {
  if (monthNewView.classList.contains("hidden")) return;
  const classic = !mnMobileQuery.matches && classicAppHeight();
  monthNewView.style.minHeight = classic ? `${classic - 6}px` : "";
}

function syncMonthDesign() {
  const isNew = calDesign === "new" && viewMode === "list";
  document.documentElement.classList.toggle("cal-new", calDesign === "new");
  calDesignToggle.querySelectorAll("[data-design]").forEach((b) => b.classList.toggle("on", b.dataset.design === calDesign));
  grid.classList.toggle("hidden", viewMode === "card" || isNew);
  monthNewView.classList.toggle("hidden", !isNew);
  calendarHeaderEl.classList.toggle("mn-mode", isNew);
  if (isNew) renderMonthNew();
}

calDesignToggle.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-design]");
  if (!btn) return;
  calDesign = btn.dataset.design;
  try {
    localStorage.setItem(CAL_DESIGN_KEY, calDesign);
  } catch {}
  syncMonthDesign();
});

function renderMonthNew() {
  const events = loadEvents();
  const today = todayKey();
  const firstDay = new Date(YEAR, currentMonth, 1).getDay();
  const daysInMonth = new Date(YEAR, currentMonth + 1, 0).getDate();
  const mobile = mnMobileQuery.matches;
  const dow = WEEKDAY_LABELS.map((l, i) => `<span class="${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${l}</span>`).join("");

  let body = "";
  if (!mobile) {
    let cells = "";
    for (let i = 0; i < firstDay; i++) cells += '<div class="mn-cell out"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(YEAR, currentMonth, day);
      const wd = (firstDay + day - 1) % 7;
      const dayEvents = events[key] || [];
      const chips = dayEvents
        .map((ev) => {
          const [title] = splitEventTitle(ev.title);
          return `<div class="mn-ev" style="--c:${homeDotColor(ev)}"><b>${mnEsc(title)}${mnMembers(ev.title) ? ' <i class="mn-mem">👥</i>' : ""}</b></div>`;
        })
        .join("");
      cells +=
        `<div class="mn-cell${wd === 0 ? " sun" : wd === 6 ? " sat" : ""}${key === today ? " today" : ""}" data-key="${key}">` +
        `<div class="mn-n"><span>${day}</span>${key === today ? "<em>오늘</em>" : ""}</div>` +
        (chips ? `<div class="mn-evs">${chips}</div>` : "") +
        "</div>";
    }
    body = `<div class="mn-cal"><div class="mn-dow">${dow}</div><div class="mn-grid">${cells}</div></div>`;
  } else {
    // 작은 달력: 일정 있는 날엔 색 점, 이번 주는 연보라
    const thisWeek = getWeekStart(new Date()).getTime();
    let mini = "";
    for (let i = 0; i < firstDay; i++) mini += "<span></span>";
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(YEAR, currentMonth, day);
      const wd = (firstDay + day - 1) % 7;
      const dayEvents = events[key] || [];
      const inWeek = getWeekStart(new Date(YEAR, currentMonth, day)).getTime() === thisWeek;
      mini +=
        `<button type="button" class="mn-mini-day${wd === 0 ? " sun" : wd === 6 ? " sat" : ""}${inWeek ? " week" : ""}${key === today ? " today" : ""}" data-key="${key}">` +
        `<b>${day}</b><i${dayEvents.length ? ` style="--c:${homeDotColor(dayEvents[0])}"` : ' class="none"'}></i></button>`;
    }
    // 주별 목록 (일정 없는 날은 빠짐)
    const weeks = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const wd = (firstDay + day - 1) % 7;
      if (day === 1 || wd === 0) weeks.push({ from: day, to: day, days: [] });
      const week = weeks[weeks.length - 1];
      week.to = day;
      const key = dateKey(YEAR, currentMonth, day);
      if ((events[key] || []).length) week.days.push({ key, day, wd });
    }
    const m = currentMonth + 1;
    const list = weeks
      .filter((w) => w.days.length)
      .map((w) => {
        const isThisWeek = getWeekStart(new Date(YEAR, currentMonth, w.from)).getTime() === thisWeek;
        const rows = w.days
          .map(({ key, day, wd }) => {
            const evs = events[key]
              .map((ev) => {
                const [title] = splitEventTitle(ev.title);
                const label = getEventBadgeLabel(ev);
                const members = mnMembers(ev.title);
                return (
                  `<div class="mn-li-ev" style="--c:${homeDotColor(ev)}"><b>${mnEsc(title)}</b>` +
                  `<small>${label ? `<span>${label}</span>` : ""}${members ? `${label ? " · " : ""}👥 ${mnEsc(members)}` : ""}</small></div>`
                );
              })
              .join("");
            return (
              `<button type="button" class="mn-li${key === today ? " today" : ""}" data-key="${key}">` +
              `<span class="mn-li-date${wd === 0 ? " sun" : wd === 6 ? " sat" : ""}"><b>${day}</b><small>${key === today ? "오늘" : WEEKDAY_LABELS[wd]}</small></span>` +
              `<span class="mn-li-evs">${evs}</span></button>`
            );
          })
          .join("");
        return (
          `<div class="mn-week"><div class="mn-week-h"><b>${weeks.indexOf(w) + 1}주차</b><span>${m}.${w.from} – ${m}.${w.to}</span>${isThisWeek ? "<em>이번 주</em>" : ""}</div>${rows}</div>`
        );
      })
      .join("");
    body =
      `<div class="mn-mini"><div class="mn-dow">${dow}</div><div class="mn-mini-grid">${mini}</div></div>` +
      `<div class="mn-list">${list || '<p class="mn-empty">이번 달은 일정이 없어요</p>'}</div>`;
  }

  monthNewView.innerHTML =
    '<div class="mn-hd"><div class="mn-hd-top"><small>DDARIN · MONTHLY</small>' +
    '<div class="mn-seg"><button type="button" data-mn="week">주간</button><button type="button" class="on">월간</button></div></div>' +
    `<div class="mn-nav"><div><b>${currentMonth + 1}월</b><span class="mn-year">` +
    [MIN_YEAR, MAX_YEAR].map((y) => `<button type="button" data-mn-year="${y}"${y === YEAR ? ' class="on"' : ""}>${y}</button>`).join("") +
    `</span></div>` +
    `<div class="mn-arrows"><button type="button" data-mn="prev" aria-label="이전 달"${prevBtn.disabled ? " disabled" : ""}>${MN_ARROW(-1)}</button>` +
    `<button type="button" data-mn="next" aria-label="다음 달"${nextBtn.disabled ? " disabled" : ""}>${MN_ARROW(1)}</button></div></div></div>` +
    body;
  fitMonthNew();
}

monthNewView.addEventListener("click", (e) => {
  const yearBtn = e.target.closest("[data-mn-year]");
  if (yearBtn) {
    const y = Number(yearBtn.dataset.mnYear);
    if (y !== YEAR) switchCalendarYear(y);
    return;
  }
  const action = e.target.closest("[data-mn]");
  if (action) {
    if (action.dataset.mn === "week") setViewMode("card");
    else if (action.dataset.mn === "prev") prevBtn.click();
    else if (action.dataset.mn === "next") nextBtn.click();
    return;
  }
  const day = e.target.closest("[data-key]");
  if (day) openMonthPopup(day.dataset.key);
});

mnMobileQuery.addEventListener("change", () => {
  if (!monthNewView.classList.contains("hidden")) renderMonthNew();
});

// 날짜 창: 왼쪽 일정(+관리·일정 추가), 오른쪽 공지사항·따카오톡. 크기는 날짜와 상관없이 같음
const mnPop = document.createElement("div");
mnPop.className = "mn-pop-bg hidden";
document.body.appendChild(mnPop);
let mnPopKey = null;

function mnPopHead(key, label) {
  const [y, m, d] = key.split("-").map(Number);
  const wd = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()];
  return (
    `<div class="mn-pop-head"><small>DDARIN · ${label}</small><div class="mn-pop-d">${m}월 ${d}일<em>${wd}요일${key === todayKey() ? " · 오늘" : ""}</em></div>` +
    '<button type="button" class="mn-pop-x" data-mnp="close" aria-label="닫기">✕</button></div>'
  );
}

function openMonthPopup(key) {
  mnPopKey = key;
  const dayEvents = loadEvents()[key] || [];
  // 모바일에서 일정 없는 날은 "일정 없음" 카드만 (공지가 있으면 그때만 아래에 붙음)
  const emptyMobile = !dayEvents.length && mnMobileQuery.matches;
  const evHtml = dayEvents.length
    ? dayEvents
        .map((ev) => {
          const [rawTitle] = splitEventTitle(ev.title);
          const [time, title] = weekEventTime(rawTitle);
          const label = getEventBadgeLabel(ev);
          const members = mnMembers(ev.title);
          return (
            `<div class="mn-pev" style="--c:${homeDotColor(ev)}"><div class="mn-pev-top">` +
            (time ? `<span class="mn-pev-time">${time}</span>` : "") +
            `<b>${mnEsc(title)}</b>${label ? `<span class="mn-pev-kind">${label}</span>` : ""}</div>` +
            (members ? `<div class="mn-pev-mem"><i>👥</i><span>${mnEsc(members)}</span></div>` : "") +
            "</div>"
          );
        })
        .join("")
    : emptyMobile
      ? '<div class="mn-pev mn-pev-none" style="--c:#9a9a9a"><div class="mn-pev-top"><b>일정 없음</b></div></div>'
      : '<div class="mn-none">이날은 일정이 없어요</div>';
  const actions = isReadOnly
    ? ""
    : '<div class="mn-pop-actions"><button type="button" data-mnp="manage">관리</button><button type="button" class="main" data-mnp="add">+ 일정 추가</button></div>';
  mnPop.innerHTML =
    `<div class="mn-pop${emptyMobile ? " mn-pop-empty" : ""}">` +
    mnPopHead(key, "SCHEDULE") +
    '<div class="mn-pop-body"><div class="mn-col mn-col-ev"><div class="mn-col-h">일정</div>' + evHtml + actions + "</div>" +
    '<div class="mn-col mn-col-nt"><div class="mn-col-h">공지</div><div class="mn-none mn-loading">불러오는 중...</div></div></div></div>';
  mnPop.classList.remove("hidden");

  const notes = mnPop.querySelector(".mn-col-nt");
  const boxes = [null, null];
  let pending = 2;
  const done = () => {
    if (--pending || mnPopKey !== key || !notes.isConnected) return;
    notes.querySelector(".mn-loading").remove();
    const found = boxes.filter(Boolean);
    notes.classList.toggle("has", found.length > 0);
    if (found.length) notes.append(...found);
    else if (!emptyMobile) notes.insertAdjacentHTML("beforeend", '<div class="mn-none">이날은 공지가 없어요</div>');
  };
  const makeBox = (label, post, withContent) => {
    const box = document.createElement("a");
    box.className = "mn-box";
    box.href = post.url;
    box.target = "_blank";
    box.rel = "noopener";
    box.innerHTML = `<span class="mn-box-head"><span>${label}</span><span>바로가기 ↗</span></span><b>${mnEsc(post.title)}</b>`;
    if (withContent && post.content) {
      const p = document.createElement("p");
      p.textContent = post.content;
      box.appendChild(p);
    }
    return box;
  };
  fetchSoopNoticeCached(key)
    .then((posts) => {
      if (posts && posts.length) boxes[0] = makeBox("공지사항", posts[0], true);
    })
    .catch(() => soopNoticeCache.delete(key))
    .finally(done);
  fetchCafeNoticeCached(key)
    .then((posts) => {
      if (posts && posts.length) boxes[1] = makeBox("따카오톡", posts[0], false);
    })
    .catch(() => cafeNoticeCache.delete(key))
    .finally(done);
}

// 일정 제목 · 유형 · 참여 멤버 입력칸 (ev가 있으면 그 값으로 채움)
function mnFormFields(ev) {
  const match = ev ? ev.title.match(ATTENDEE_RE) : null;
  const baseTitle = ev ? (match ? ev.title.slice(0, match.index).trim() : ev.title) : "";
  const info = ev ? getColorInfo(ev) : null;
  const current = !info ? "gray" : info.hex ? info.hex.toLowerCase() : { collab: "purple", hiatus: "#cc0000" }[info.key] || info.key;
  const selected = MN_KINDS.some(([value]) => value === current) ? current : "gray";
  return (
    `<label class="mn-field"><span>일정 제목</span><input name="title" value="${mnEsc(baseTitle)}" placeholder="예: 9시 메이플 보스 데이" required></label>` +
    '<div class="mn-field"><span>유형</span><div class="mn-kinds">' +
    MN_KINDS.map(
      ([value, label]) =>
        `<button type="button" class="${value === selected ? "on" : ""}" data-kind="${value}" style="--c:${homeDotColor(value.startsWith("#") ? { title: "", sheetColor: value } : { title: "", color: value })}">${label}</button>`
    ).join("") +
    "</div></div>" +
    `<label class="mn-field"><span>참여 멤버</span><div class="mn-with"><i>👤</i><input name="attendees" value="${mnEsc(match ? match[1].trim() : "")}" placeholder="쉼표로 구분"></div></label>`
  );
}

// 주간 · 검색에서 날짜를 열 때: 새 디자인이면 새 날짜 창, 기본이면 예전 창
function openDayPopup(key) {
  if (calDesign === "new") openMonthPopup(key);
  else openModal(key);
}

function openMonthAddForm(key) {
  mnPop.innerHTML =
    '<div class="mn-pop">' +
    mnPopHead(key, "일정 추가") +
    '<form class="mn-pop-body mn-form" data-idx="-1" autocomplete="off">' +
    mnFormFields(null) +
    '<div class="mn-pop-actions"><button type="button" data-mnp="back">취소</button><button type="submit" class="main">추가</button></div>' +
    "</form></div>";
  mnPop.querySelector("input[name=title]").focus();
}

// 일정 관리: 왼쪽 목록(수정 · 삭제 · 순서 바꾸기), PC는 오른쪽에서 수정 / 모바일은 고른 일정 바로 밑에서 수정
const MN_ICON = {
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
};
let mnDragIdx = null;

function openMonthManage(key, editIdx = null) {
  mnPopKey = key;
  const list = loadEvents()[key] || [];
  const mobile = mnMobileQuery.matches;
  const isNew = editIdx === -1;
  const form =
    editIdx === null
      ? ""
      : `<form class="mn-form mn-edit" data-idx="${editIdx}" autocomplete="off"><div class="mn-col-h">${isNew ? "새 일정" : "일정 수정"}</div>` +
        mnFormFields(isNew ? null : list[editIdx]) +
        `<div class="mn-pop-actions"><button type="button" data-mnp="edit-cancel">취소</button><button type="submit" class="main">${isNew ? "추가" : "저장"}</button></div></form>`;
  const cards =
    list
      .map((ev, i) => {
        const [rawTitle] = splitEventTitle(ev.title);
        const [time, title] = weekEventTime(rawTitle);
        const label = getEventBadgeLabel(ev);
        const members = mnMembers(ev.title);
        const move = mobile
          ? `<button type="button" data-mnp="up" data-idx="${i}" aria-label="위로"${i === 0 ? " disabled" : ""}>${MN_ICON.up}</button>` +
            `<button type="button" data-mnp="down" data-idx="${i}" aria-label="아래로"${i === list.length - 1 ? " disabled" : ""}>${MN_ICON.down}</button>`
          : "";
        return (
          `<div class="mn-mev${i === editIdx ? " on" : ""}"${mobile ? "" : ' draggable="true"'} data-idx="${i}" style="--c:${homeDotColor(ev)}">` +
          (mobile ? "" : `<span class="mn-grip" aria-hidden="true">${MN_ICON.grip}</span>`) +
          '<div class="mn-mev-main"><div class="mn-pev-top">' +
          (time ? `<span class="mn-pev-time">${time}</span>` : "") +
          `<b>${mnEsc(title)}</b>${label ? `<span class="mn-pev-kind">${label}</span>` : ""}</div>` +
          (members ? `<div class="mn-pev-mem"><i>👥</i><span>${mnEsc(members)}</span></div>` : "") +
          "</div>" +
          `<div class="mn-mev-btns">${move}<button type="button" data-mnp="edit" data-idx="${i}" aria-label="수정">${MN_ICON.pen}</button>` +
          `<button type="button" class="del" data-mnp="del" data-idx="${i}" aria-label="삭제">${MN_ICON.trash}</button></div></div>` +
          (mobile && i === editIdx ? form : "")
        );
      })
      .join("") || '<div class="mn-none">이날은 일정이 없어요</div>';
  const actions =
    '<div class="mn-pop-actions mn-manage-actions">' +
    (list.length ? '<button type="button" class="danger" data-mnp="bulk">일괄 삭제</button>' : "") +
    '<span></span><button type="button" data-mnp="new">+ 새 일정</button><button type="button" class="main" data-mnp="done">완료</button></div>';
  const right = mobile
    ? ""
    : '<div class="mn-col mn-col-nt mn-col-edit">' +
      (form ||
        `<div class="mn-edit-empty">${MN_ICON.pen}<b>왼쪽에서 일정을 고르면<br>여기서 바로 수정할 수 있어요</b><span>${MN_ICON.grip} 끌어서 순서를 바꿀 수 있어요</span></div>`) +
      "</div>";
  mnPop.innerHTML =
    '<div class="mn-pop mn-pop-manage">' +
    mnPopHead(key, "일정 관리") +
    `<div class="mn-pop-body"><div class="mn-col mn-col-ev"><div class="mn-col-h">일정 ${list.length}개</div>` +
    (mobile && isNew ? form : "") +
    cards +
    actions +
    "</div>" +
    right +
    "</div></div>";
  mnPop.classList.remove("hidden");
  const input = mnPop.querySelector(".mn-edit input[name=title]");
  if (input) input.focus();
}

// 관리 화면에서 목록을 바꾸고 저장 → 다시 그림
function mnUpdateDay(change) {
  if (isReadOnly || !mnPopKey) return;
  const events = loadEvents();
  const list = events[mnPopKey] || [];
  change(list);
  if (list.length) events[mnPopKey] = list;
  else delete events[mnPopKey];
  saveEvents(events);
  refreshCurrentView();
  openMonthManage(mnPopKey);
}

mnPop.addEventListener("dragstart", (e) => {
  const card = e.target.closest(".mn-mev");
  if (!card) return;
  mnDragIdx = Number(card.dataset.idx);
  card.classList.add("dragging");
});
mnPop.addEventListener("dragend", () => {
  mnDragIdx = null;
  mnPop.querySelectorAll(".mn-mev.dragging").forEach((c) => c.classList.remove("dragging"));
});
mnPop.addEventListener("dragover", (e) => {
  if (mnDragIdx !== null && e.target.closest(".mn-mev")) e.preventDefault();
});
mnPop.addEventListener("drop", (e) => {
  const card = e.target.closest(".mn-mev");
  if (!card || mnDragIdx === null) return;
  e.preventDefault();
  const from = mnDragIdx;
  const to = Number(card.dataset.idx);
  mnDragIdx = null;
  if (from !== to) mnUpdateDay((list) => list.splice(to, 0, list.splice(from, 1)[0]));
});

function closeMonthPopup() {
  mnPop.classList.add("hidden");
  mnPop.innerHTML = "";
  mnPopKey = null;
}

mnPop.addEventListener("click", (e) => {
  const kind = e.target.closest("[data-kind]");
  if (kind) {
    kind.parentElement.querySelectorAll("[data-kind]").forEach((b) => b.classList.toggle("on", b === kind));
    return;
  }
  const action = e.target.closest("[data-mnp]");
  if (e.target === mnPop || (action && action.dataset.mnp === "close")) closeMonthPopup();
  else if (!action) return;
  else if (action.dataset.mnp === "manage" || action.dataset.mnp === "edit-cancel") openMonthManage(mnPopKey);
  else if (action.dataset.mnp === "add") openMonthAddForm(mnPopKey);
  else if (action.dataset.mnp === "back" || action.dataset.mnp === "done") openMonthPopup(mnPopKey);
  else if (action.dataset.mnp === "new") openMonthManage(mnPopKey, -1);
  else if (action.dataset.mnp === "edit") {
    const idx = Number(action.dataset.idx);
    openMonthManage(mnPopKey, action.closest(".mn-mev.on") ? null : idx);
  } else if (action.dataset.mnp === "up" || action.dataset.mnp === "down") {
    const idx = Number(action.dataset.idx);
    const to = action.dataset.mnp === "up" ? idx - 1 : idx + 1;
    mnUpdateDay((list) => list.splice(to, 0, list.splice(idx, 1)[0]));
  } else if (action.dataset.mnp === "del") {
    const idx = Number(action.dataset.idx);
    const [title] = splitEventTitle((loadEvents()[mnPopKey] || [])[idx]?.title || "");
    if (confirm(`"${title.trim()}" 일정을 삭제할까요?`)) mnUpdateDay((list) => list.splice(idx, 1));
  } else if (action.dataset.mnp === "bulk") {
    if (confirm("이 날짜의 모든 일정을 삭제할까요?")) mnUpdateDay((list) => list.splice(0));
  }
});

mnPop.addEventListener("submit", (e) => {
  e.preventDefault();
  if (isReadOnly || !mnPopKey) return;
  const form = e.target;
  const baseTitle = form.elements.namedItem("title").value.trim();
  if (!baseTitle) return;
  const attendees = form.elements.namedItem("attendees").value.trim();
  const title = attendees ? `${baseTitle} w.${attendees}` : baseTitle;
  const kind = form.querySelector("[data-kind].on").dataset.kind;
  const newEvent = kind.startsWith("#") ? { title, sheetColor: kind } : { title, color: kind };
  const idx = Number(form.dataset.idx);
  const events = loadEvents();
  if (!events[mnPopKey]) events[mnPopKey] = [];
  if (idx >= 0) events[mnPopKey][idx] = newEvent;
  else events[mnPopKey].push(newEvent);
  saveEvents(events);
  refreshCurrentView();
  if (form.classList.contains("mn-edit")) openMonthManage(mnPopKey);
  else openMonthPopup(mnPopKey);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !mnPop.classList.contains("hidden")) closeMonthPopup();
});

async function init() {
  const today = new Date();
  if (today.getFullYear() === YEAR) currentMonth = today.getMonth();

  updateLockUi();
  renderGrid();
  applyDefaultMobileViewMode();
  syncMonthDesign();

  await initEvents();
  refreshCurrentView();
  openCalendarAnnounce();

  prefetchTodayNotices();
  prefetchSongbookInBackground();
  loadSharedMemoList().then(() => showTodayMemoPopupIfNeeded());

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
