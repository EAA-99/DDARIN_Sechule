const API_URL = "https://script.google.com/macros/s/AKfycbwuOrjG9SZxN4CtkXb9EW2Hd_bt4x-ntPXjAFisw9VojI2X8lijwSZ2Prw5xaxkP8CYeg/exec";

const SPREADSHEET_ID = "1gCvMJMK52QUyo1M4FbFzWsJ_NZp3MUqgrDa0obhNIbY";
const SHEETS_API_KEY = "AIzaSyC0RsFfc5y9GmEaE29niGWD9hbSnpIc7rM";
const SHEETS_API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/AppEvents!A2:D?key=${SHEETS_API_KEY}`;

const SONGBOOK_SPREADSHEET_ID = "1NhImCLm5diXM0pA45SkB-g2PARivQiVN8bUKlniiOB8";
const SONGBOOK_CLIPS_SPREADSHEET_ID = "17EmfOEPVGesH9FXnh7xsKvBYYIhi2TrerSzY23E2N9A";

const YEAR = 2026;
const STORAGE_KEY = "calendar-events-2026";
const SHEET_URL_KEY = "calendar-sheet-url-2026";
const EDIT_PW_KEY = "calendar-edit-pw-2026";

let currentMonth = 0; // 0 = January
let selectedDateKey = null;
let isReadOnly = true;

const loadingScreen = document.getElementById("loadingScreen");
const monthTitle = document.getElementById("monthTitle");
const grid = document.getElementById("grid");
const weekdayRow = document.querySelector(".weekday-row");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const listViewBtn = document.getElementById("listViewBtn");
const cardViewBtn = document.getElementById("cardViewBtn");
const cardView = document.getElementById("cardView");
const cardList = document.getElementById("cardList");
const weekPrevBtn = document.getElementById("weekPrevBtn");
const weekNextBtn = document.getElementById("weekNextBtn");
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
const colorSwatches = document.querySelectorAll(".color-swatch");
let selectedColor = "blue";
let editingIndex = null;

const editLockBtn = document.getElementById("editLockBtn");
const loginBtnLabel = document.getElementById("loginBtnLabel");

const pageEl = document.querySelector(".page");
const songbookBtn = document.getElementById("songbookBtn");
const songbookView = document.getElementById("songbookView");
const songbookBackBtn = document.getElementById("songbookBackBtn");
const songSearchInput = document.getElementById("songSearchInput");
const genreTabs = document.getElementById("genreTabs");
const playerEmpty = document.getElementById("playerEmpty");
const playerNoClip = document.getElementById("playerNoClip");
const playerNoClipSong = document.getElementById("playerNoClipSong");
const playerFrameWrap = document.getElementById("playerFrameWrap");
const playerFrame = document.getElementById("playerFrame");
const playerCurrentTitle = document.getElementById("playerCurrentTitle");
const playerPlayBtn = document.getElementById("playerPlayBtn");
const songGrid = document.getElementById("songGrid");
let allSongs = null;
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

function albumArtCacheKey(song) {
  return `${song.artist}|${song.title}`.toLowerCase();
}

let songbookSongsPromise = null;

function ensureSongbookSongs() {
  if (!songbookSongsPromise) {
    songbookSongsPromise = fetchSongbookSongs().then((songs) => {
      allSongs = songs;
      const genres = [...new Set(songs.map((s) => s.genre))];
      renderGenreTabs(genres);
      return songs;
    });
  }
  return songbookSongsPromise;
}

async function prefetchSongbookInBackground() {
  await ensureSongbookSongs();
  await ensureSongMeta();
  if (!songbookView.classList.contains("hidden")) renderSongGrid();
}

let clipMap = null;
let artMap = null;
let songMetaPromise = null;

async function fetchSongMeta() {
  const clips = {};
  const art = {};
  try {
    const range = encodeURIComponent("시트1!A2:D");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SONGBOOK_CLIPS_SPREADSHEET_ID}/values/${range}?key=${SHEETS_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      (data.values || []).forEach((row) => {
        const [artist, title, link, artUrl] = row;
        if (!title) return;
        const key = `${artist || ""}|${title}`.toLowerCase();
        if (link) {
          const m = /player\/(\d+)/.exec(link);
          if (m) clips[key] = m[1];
        }
        if (artUrl) art[key] = artUrl;
      });
    }
  } catch {
    // clipMap/artMap stay as whatever was parsed so far
  }
  clipMap = clips;
  artMap = art;
  return { clips, art };
}

function ensureSongMeta() {
  if (!songMetaPromise) songMetaPromise = fetchSongMeta();
  return songMetaPromise;
}

function buildEmbedUrl(clipId, autoPlay) {
  return `https://vod.sooplive.com/player/${clipId}/embed?type=catch&autoPlay=${autoPlay}&showChat=false&mutePlay=false`;
}

let currentClipId = null;

async function playSong(song) {
  if (!clipMap) await ensureSongMeta();
  const key = albumArtCacheKey(song);
  const clipId = clipMap[key];

  playerEmpty.classList.add("hidden");
  currentClipId = clipId || null;

  if (!clipId) {
    playerFrameWrap.classList.add("hidden");
    playerFrame.src = "";
    playerPlayBtn.disabled = true;
    playerNoClip.classList.remove("hidden");
    playerNoClipSong.textContent = `${song.title} - ${song.artist}`;
    return;
  }

  playerNoClip.classList.add("hidden");
  playerFrameWrap.classList.remove("hidden");
  playerCurrentTitle.textContent = `${song.title} - ${song.artist}`;
  playerFrame.src = buildEmbedUrl(clipId, false);
  playerPlayBtn.disabled = false;
}

playerPlayBtn.addEventListener("click", () => {
  if (!currentClipId) return;
  playerFrame.src = buildEmbedUrl(currentClipId, true);
});

function renderSongGrid() {
  const query = songSearchInput.value.trim().toLowerCase();

  const filtered = (allSongs || []).filter((song) => {
    if (songbookGenre !== "전체" && song.genre !== songbookGenre) return false;
    if (query && !song.title.toLowerCase().includes(query) && !song.artist.toLowerCase().includes(query)) return false;
    return true;
  });

  songGrid.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "song-empty";
    empty.textContent = "곡이 없습니다.";
    songGrid.appendChild(empty);
    return;
  }

  filtered.forEach((song) => {
    const card = document.createElement("div");
    card.className = "song-card";

    const artEl = document.createElement("img");
    artEl.className = "song-card-art";
    artEl.alt = "";

    const titleEl = document.createElement("div");
    titleEl.className = "song-card-title";
    titleEl.textContent = song.title;

    const artistEl = document.createElement("div");
    artistEl.className = "song-card-artist";
    artistEl.textContent = song.artist;

    const genreEl = document.createElement("span");
    genreEl.className = "song-card-genre";
    genreEl.textContent = song.genre;

    card.append(artEl, titleEl, artistEl, genreEl);
    card.addEventListener("click", () => playSong(song));
    songGrid.appendChild(card);

    const key = albumArtCacheKey(song);
    if (artMap && artMap[key]) artEl.src = artMap[key];
  });
}

async function openSongbook() {
  pageEl.classList.add("hidden");
  songbookView.classList.remove("hidden");

  if (!allSongs) {
    songGrid.innerHTML = `<div class="song-empty">불러오는 중...</div>`;
    await ensureSongbookSongs();
  }
  if (!clipMap) await ensureSongMeta();

  renderSongGrid();
}

function closeSongbook() {
  songbookView.classList.add("hidden");
  pageEl.classList.remove("hidden");
}

songbookBtn.addEventListener("click", openSongbook);
songbookBackBtn.addEventListener("click", closeSongbook);
songSearchInput.addEventListener("input", renderSongGrid);
genreTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".genre-tab");
  if (!btn) return;
  songbookGenre = btn.dataset.genre;
  genreTabs.querySelectorAll(".genre-tab").forEach((el) => el.classList.toggle("active", el === btn));
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

  const password = localStorage.getItem(EDIT_PW_KEY);
  if (!password) return;

  apiPost({ action: "save", events: eventsObjectToFlat(data), password }).then((res) => {
    if (!res || !res.ok) {
      localStorage.removeItem(EDIT_PW_KEY);
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

async function initEvents() {
  const flat = await apiGetEvents();
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
  if (ATTENDEE_RE.test(ev.title) || ev.title.includes("합방")) return { key: "collab" };
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

    const dayEvents = events[key] || [];

    if (dayEvents.length === 1) {
      const single = document.createElement("div");
      single.className = "event-single";
      applyEventColor(single, dayEvents[0]);
      const singleText = document.createElement("span");
      singleText.className = "event-single-text";
      fillEventContent(singleText, dayEvents[0].title);
      single.appendChild(singleText);
      cell.appendChild(single);
    } else if (dayEvents.length > 1) {
      const dotsWrap = document.createElement("div");
      dotsWrap.className = "event-dots";
      const shown = dayEvents.slice(0, 5);
      shown.forEach((ev) => {
        const dot = document.createElement("div");
        dot.className = "event-dot";
        applyEventColor(dot, ev);
        const dotText = document.createElement("span");
        dotText.className = "event-dot-text";
        fillEventContent(dotText, ev.title);
        dot.appendChild(dotText);
        dotsWrap.appendChild(dot);
      });
      if (dayEvents.length > shown.length) {
        const more = document.createElement("div");
        more.className = "event-more";
        more.textContent = `+${dayEvents.length - shown.length}`;
        dotsWrap.appendChild(more);
      }
      cell.appendChild(dotsWrap);
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

function setViewMode(mode) {
  viewMode = mode;
  const isCard = mode === "card";
  cardViewBtn.classList.toggle("active", isCard);
  listViewBtn.classList.toggle("active", !isCard);
  cardView.classList.toggle("hidden", !isCard);
  grid.classList.toggle("hidden", isCard);
  weekdayRow.classList.toggle("hidden", isCard);
  if (isCard) {
    resetCardWeekToMonth();
    renderCardView();
  }
}

function selectColor(color) {
  selectedColor = color;
  colorSwatches.forEach((sw) => sw.classList.toggle("selected", sw.dataset.color === color));
}

function resetForm() {
  editingIndex = null;
  eventTitleInput.value = "";
  eventAttendeesInput.value = "";
  selectColor("blue");
  eventSubmitBtn.textContent = "추가";
}

function openModal(key) {
  selectedDateKey = key;
  const [, m, d] = key.split("-");
  modalDate.textContent = `${YEAR}년 ${parseInt(m)}월 ${parseInt(d)}일 일정`;
  renderEventList();
  resetForm();
  eventForm.classList.toggle("hidden", isReadOnly);
  modalBackdrop.classList.remove("hidden");
  if (!isReadOnly) eventTitleInput.focus();
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
  selectColor(ev.color || "blue");
  eventSubmitBtn.textContent = "수정";
  eventTitleInput.focus();
}

colorSwatches.forEach((sw) => {
  sw.addEventListener("click", () => selectColor(sw.dataset.color));
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
    applyEventColor(card, ev);
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

  if (editingIndex !== null) {
    events[selectedDateKey][editingIndex] = { title, color: selectedColor };
  } else {
    events[selectedDateKey].push({ title, color: selectedColor });
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

listViewBtn.addEventListener("click", () => setViewMode("list"));
cardViewBtn.addEventListener("click", () => setViewMode("card"));

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
  const pw = localStorage.getItem(EDIT_PW_KEY);
  if (!pw) {
    isReadOnly = true;
    return;
  }
  const res = await apiPost({ action: "checkPassword", password: pw });
  const ok = !!(res && res.ok);
  isReadOnly = !ok;
  if (!ok) localStorage.removeItem(EDIT_PW_KEY);
}

editLockBtn.addEventListener("click", async () => {
  if (!isReadOnly) {
    localStorage.removeItem(EDIT_PW_KEY);
    isReadOnly = true;
    updateLockUi();
    return;
  }

  const pw = prompt("편집 비밀번호를 입력하세요");
  if (pw === null || pw === "") return;

  const res = await apiPost({ action: "checkPassword", password: pw });
  if (res && res.ok) {
    localStorage.setItem(EDIT_PW_KEY, pw);
    isReadOnly = false;
    updateLockUi();
  } else {
    alert("비밀번호가 틀렸습니다.");
  }
});

async function init() {
  const today = new Date();
  if (today.getFullYear() === YEAR) currentMonth = today.getMonth();

  await Promise.all([tryAutoUnlock(), initEvents()]);

  updateLockUi();
  renderGrid();
  if (window.innerWidth <= 600) setViewMode("card");

  loadingScreen.classList.add("hidden");

  prefetchSongbookInBackground();
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
}, SYNC_INTERVAL_MS);
