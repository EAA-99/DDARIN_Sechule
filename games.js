function showGameError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}

const GAME_WIN_IMAGES = ["룰렛 이미지.png", "룰렛 이미지2.png", "룰렛 이미지3.png"];
const GAME_MISS_IMAGES = ["룰렛 꽝 이미지.png", "룰렛 꽝 이미지 2.png", "룰렛 꽝 이미지3.png"];

GAME_WIN_IMAGES.concat(GAME_MISS_IMAGES).forEach((src) => {
  const preload = new Image();
  preload.src = src;
});

function getResultImages(label) {
  return (label || "").trim() === "꽝" ? GAME_MISS_IMAGES : GAME_WIN_IMAGES;
}

function buildResultCard(label, contentEl, winnerText = "WINNER") {
  const card = document.createElement("div");
  card.className = "result-card";

  const avatar = document.createElement("div");
  avatar.className = "result-avatar";
  const options = getResultImages(label);
  const img = document.createElement("img");
  img.src = options[Math.floor(Math.random() * options.length)];
  img.alt = "";
  avatar.appendChild(img);

  const winnerLabel = document.createElement("div");
  winnerLabel.className = "result-winner-label";
  winnerLabel.textContent = winnerText;

  card.append(avatar, winnerLabel, contentEl);
  return card;
}

let redrawLadderCanvas = function () {};
let redrawRouletteWheel = function () {};
let redrawPinballCanvas = function () {};

document.querySelectorAll(".game-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.game;
    document.querySelectorAll(".game-tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.getElementById("ladderPanel").classList.toggle("hidden", target !== "ladder");
    document.getElementById("roulettePanel").classList.toggle("hidden", target !== "roulette");
    document.getElementById("pinballPanel").classList.toggle("hidden", target !== "pinball");
    if (target === "ladder") redrawLadderCanvas();
    if (target === "roulette") redrawRouletteWheel();
    if (target === "pinball") redrawPinballCanvas();
  });
});

// ===== 사다리타기 =====
(function ladderGame() {
  const namesRow = document.getElementById("ladderNamesRow");
  const resultsRow = document.getElementById("ladderResultsRow");
  const canvas = document.getElementById("ladderCanvas");
  const errorEl = document.getElementById("ladderError");
  const toolbarEl = document.querySelector("#ladderPanel .ladder-toolbar");
  const LADDER_TARGET_HEIGHT = 740;
  const countLabel = document.getElementById("ladderCountLabel");
  const countMinus = document.getElementById("ladderCountMinus");
  const countPlus = document.getElementById("ladderCountPlus");
  const startBtn = document.getElementById("ladderStartBtn");
  const resultBtn = document.getElementById("ladderResultBtn");
  const shuffleBtn = document.getElementById("ladderShuffleBtn");
  const resetIconBtn = document.getElementById("ladderResetBtn");
  const speedSlider = document.getElementById("ladderSpeedSlider");
  const blindBtn = document.getElementById("ladderBlindBtn");
  const resultModalBackdrop = document.getElementById("ladderResultModalBackdrop");
  const resultModalList = document.getElementById("ladderResultModalList");
  const closeResultModalBtn = document.getElementById("closeLadderResultModalBtn");
  const ctx = canvas.getContext("2d");

  const ROWS = 14;
  const MIN_COUNT = 2;
  const MAX_COUNT = 10;
  const COL_WIDTH = 150;
  const COL_GAP = 8;
  const PATH_COLORS = ["#4a7fd6", "#e05a5a", "#2e9e5b", "#b3691a", "#6b4bad", "#ad3f68", "#1c5fa8", "#8a6d1f"];

  let count = 2;
  let rungs = [];
  let started = false;
  let animationToken = 0;
  let blindMode = false;

  function updateCountLabel() {
    countLabel.textContent = `항목 ${count}개`;
  }

  function updateStartButtonState() {
    const filled = getLabels(namesRow).every(Boolean) && getLabels(resultsRow).every(Boolean);
    startBtn.disabled = !filled;
  }

  function setColumnsReadonly(readonly) {
    namesRow.querySelectorAll(".ladder-col-input").forEach((input) => (input.readOnly = readonly));
    resultsRow.querySelectorAll(".ladder-col-input").forEach((input) => (input.readOnly = readonly));
  }

  function renderColumns() {
    namesRow.innerHTML = "";
    resultsRow.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const col = document.createElement("div");
      col.className = "ladder-col";
      const avatar = document.createElement("div");
      avatar.className = "ladder-avatar";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "ladder-col-input";
      input.placeholder = `항목${i + 1}`;
      input.addEventListener("input", updateStartButtonState);
      const arrow = document.createElement("div");
      arrow.className = "ladder-col-arrow";
      arrow.textContent = "▼";
      col.append(avatar, input, arrow);
      col.addEventListener("click", () => {
        if (started) animateTrace(i);
      });
      namesRow.appendChild(col);

      const rCol = document.createElement("div");
      rCol.className = "ladder-col";
      const rInput = document.createElement("input");
      rInput.type = "text";
      rInput.className = "ladder-col-input";
      rInput.placeholder = "결과";
      rInput.addEventListener("input", updateStartButtonState);
      rCol.appendChild(rInput);
      resultsRow.appendChild(rCol);
    }
    updateStartButtonState();
  }

  function colX(i) {
    const rawWidth = (canvas.width - (count - 1) * COL_GAP) / count;
    const colWidth = Math.min(COL_WIDTH, rawWidth);
    const contentWidth = count * colWidth + (count - 1) * COL_GAP;
    const startX = (canvas.width - contentWidth) / 2;
    return startX + i * (colWidth + COL_GAP) + colWidth / 2;
  }

  function generateRungs() {
    rungs = Array.from({ length: ROWS }, () => new Set());
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < count - 1; c++) {
        if (rungs[r].has(c - 1)) continue;
        if (Math.random() < 0.35) rungs[r].add(c);
      }
    }

    // 어떤 항목도 줄과 하나도 연결되지 않은 채로 남지 않도록 보정
    for (let c = 0; c < count - 1; c++) {
      const hasRung = rungs.some((row) => row.has(c));
      if (hasRung) continue;
      const candidateRows = [];
      for (let r = 0; r < ROWS; r++) {
        if (!rungs[r].has(c - 1) && !rungs[r].has(c + 1)) candidateRows.push(r);
      }
      if (candidateRows.length) {
        const r = candidateRows[Math.floor(Math.random() * candidateRows.length)];
        rungs[r].add(c);
      }
    }
  }

  function drawLadder(paths) {
    canvas.width = namesRow.offsetWidth || 480;
    const nonCanvasHeight =
      toolbarEl.offsetHeight + 20 +
      errorEl.offsetHeight + (errorEl.offsetHeight > 0 ? 8 : 0) +
      namesRow.offsetHeight +
      resultsRow.offsetHeight +
      12;
    canvas.height = Math.max(300, LADDER_TARGET_HEIGHT - nonCanvasHeight);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 2;
    for (let c = 0; c < count; c++) {
      ctx.beginPath();
      ctx.moveTo(colX(c), 0);
      ctx.lineTo(colX(c), canvas.height);
      ctx.stroke();
    }

    if (rungs.length && !blindMode) {
      ctx.strokeStyle = "#bbb";
      const rowH = canvas.height / ROWS;
      for (let r = 0; r < ROWS; r++) {
        const y = r * rowH + rowH / 2;
        rungs[r].forEach((c) => {
          ctx.beginPath();
          ctx.moveTo(colX(c), y);
          ctx.lineTo(colX(c + 1), y);
          ctx.stroke();
        });
      }
    }

    if (paths) {
      paths.forEach((path, idx) => {
        ctx.strokeStyle = PATH_COLORS[idx % PATH_COLORS.length];
        ctx.lineWidth = 3;
        ctx.beginPath();
        path.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      });
    }
  }

  function tracePath(startCol) {
    const rowH = canvas.height / ROWS;
    let col = startCol;
    const pts = [{ x: colX(col), y: 0 }];
    for (let r = 0; r < ROWS; r++) {
      const y1 = r * rowH;
      const y2 = y1 + rowH;
      const midY = y1 + rowH / 2;
      if (rungs[r].has(col)) {
        pts.push({ x: colX(col), y: midY });
        col += 1;
        pts.push({ x: colX(col), y: midY });
      } else if (rungs[r].has(col - 1)) {
        pts.push({ x: colX(col), y: midY });
        col -= 1;
        pts.push({ x: colX(col), y: midY });
      }
      pts.push({ x: colX(col), y: y2 });
    }
    return { path: pts, endCol: col };
  }

  function getLabels(row) {
    return Array.from(row.querySelectorAll(".ladder-col-input")).map((input) => input.value.trim());
  }

  function resetBoard() {
    rungs = [];
    started = false;
    animationToken += 1;
    setColumnsReadonly(false);
    namesRow.querySelectorAll(".ladder-col-input").forEach((input) => (input.value = ""));
    resultsRow.querySelectorAll(".ladder-col-input").forEach((input) => (input.value = ""));
    errorEl.classList.add("hidden");
    updateStartButtonState();
    drawLadder(null);
  }

  function pathLength(path) {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return len;
  }

  function drawPartialPath(path, progress, color) {
    const target = pathLength(path) * progress;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      const segLen = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      if (acc + segLen <= target) {
        ctx.lineTo(path[i].x, path[i].y);
        acc += segLen;
      } else {
        const ratio = segLen === 0 ? 0 : (target - acc) / segLen;
        ctx.lineTo(path[i - 1].x + (path[i].x - path[i - 1].x) * ratio, path[i - 1].y + (path[i].y - path[i - 1].y) * ratio);
        break;
      }
    }
    ctx.stroke();
  }

  function animateTrace(startCol) {
    const { path, endCol } = tracePath(startCol);
    const color = PATH_COLORS[startCol % PATH_COLORS.length];
    const speed = parseInt(speedSlider.value, 10) || 5;
    const duration = 1700 - speed * 140;
    const startTime = performance.now();
    const myToken = ++animationToken;

    function frame(now) {
      if (myToken !== animationToken) return;
      const progress = Math.min(1, (now - startTime) / duration);
      drawLadder(null);
      drawPartialPath(path, progress, color);
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        const names = getLabels(namesRow).map((v, i) => v || `항목${i + 1}`);
        const resultLabels = getLabels(resultsRow).map((v) => v || "결과");

        const row = document.createElement("div");
        row.className = "ladder-result-row";
        row.style.color = color;
        const fromEl = document.createElement("span");
        fromEl.className = "ladder-result-from";
        fromEl.textContent = names[startCol];
        const arrowEl = document.createElement("span");
        arrowEl.className = "ladder-result-arrow";
        arrowEl.textContent = "→";
        const toEl = document.createElement("span");
        toEl.className = "ladder-result-to";
        toEl.textContent = resultLabels[endCol];
        row.append(fromEl, arrowEl, toEl);

        resultModalList.innerHTML = "";
        resultModalList.appendChild(buildResultCard(resultLabels[endCol], row));
        resultModalBackdrop.classList.remove("hidden");
      }
    }
    requestAnimationFrame(frame);
  }

  countMinus.addEventListener("click", () => {
    if (count <= MIN_COUNT) return;
    count -= 1;
    updateCountLabel();
    renderColumns();
    resetBoard();
  });

  countPlus.addEventListener("click", () => {
    if (count >= MAX_COUNT) return;
    count += 1;
    updateCountLabel();
    renderColumns();
    resetBoard();
  });

  startBtn.addEventListener("click", () => {
    if (startBtn.disabled) return;
    if (!rungs.length) generateRungs();
    started = true;
    animationToken += 1;
    setColumnsReadonly(true);
    errorEl.classList.add("hidden");
    drawLadder(null);
  });

  shuffleBtn.addEventListener("click", () => {
    generateRungs();
    started = false;
    animationToken += 1;
    setColumnsReadonly(false);
    errorEl.classList.add("hidden");
    drawLadder(null);
  });

  blindBtn.addEventListener("click", () => {
    blindMode = !blindMode;
    blindBtn.classList.toggle("active", blindMode);
    drawLadder(null);
  });

  resetIconBtn.addEventListener("click", resetBoard);

  resultBtn.addEventListener("click", () => {
    if (!rungs.length) {
      showGameError(errorEl, "먼저 START를 눌러 사다리를 만들어주세요.");
      return;
    }
    errorEl.classList.add("hidden");
    animationToken += 1;

    const names = getLabels(namesRow).map((v, i) => v || `항목${i + 1}`);
    const resultLabels = getLabels(resultsRow).map((v) => v || "결과");
    const paths = [];
    const rowsWrap = document.createElement("div");
    rowsWrap.className = "ladder-result-rows";
    for (let i = 0; i < count; i++) {
      const { path, endCol } = tracePath(i);
      paths.push(path);

      const row = document.createElement("div");
      row.className = "ladder-result-row";
      row.style.color = PATH_COLORS[i % PATH_COLORS.length];

      const fromEl = document.createElement("span");
      fromEl.className = "ladder-result-from";
      fromEl.textContent = names[i];
      const arrowEl = document.createElement("span");
      arrowEl.className = "ladder-result-arrow";
      arrowEl.textContent = "→";
      const toEl = document.createElement("span");
      toEl.className = "ladder-result-to";
      toEl.textContent = resultLabels[endCol];

      row.append(fromEl, arrowEl, toEl);
      rowsWrap.appendChild(row);
    }
    resultModalList.innerHTML = "";
    resultModalList.appendChild(buildResultCard("", rowsWrap, "결과가 나왔어요"));
    drawLadder(paths);
    resultModalBackdrop.classList.remove("hidden");
  });

  closeResultModalBtn.addEventListener("click", () => {
    resultModalBackdrop.classList.add("hidden");
  });
  resultModalBackdrop.addEventListener("click", (e) => {
    if (e.target === resultModalBackdrop) resultModalBackdrop.classList.add("hidden");
  });

  redrawLadderCanvas = () => {
    drawLadder(null);
  };
  window.addEventListener("resize", () => {
    drawLadder(null);
  });

  updateCountLabel();
  renderColumns();
  drawLadder(null);
})();

// ===== 룰렛 =====
(function rouletteGame() {
  const errorEl = document.getElementById("rouletteError");
  const canvas = document.getElementById("rouletteCanvas");
  const wheelWrap = document.querySelector(".roulette-wheel-wrap");
  const countLabel = document.getElementById("rouletteCountLabel");
  const countMinus = document.getElementById("rouletteCountMinus");
  const countPlus = document.getElementById("rouletteCountPlus");
  const settingsBtn = document.getElementById("rouletteSettingsBtn");
  const settingsModalBackdrop = document.getElementById("rouletteSettingsModalBackdrop");
  const settingsInputs = document.getElementById("rouletteSettingsInputs");
  const settingsCloseBtn = document.getElementById("rouletteSettingsCloseBtn");
  const closeSettingsModalBtn = document.getElementById("closeRouletteSettingsModalBtn");
  const startBtn = document.getElementById("rouletteStartBtn");
  const resetBtn = document.getElementById("rouletteResetBtn");
  const resultModalBackdrop = document.getElementById("rouletteResultModalBackdrop");
  const resultCardWrap = document.getElementById("rouletteResultCard");
  const closeResultModalBtn = document.getElementById("closeRouletteResultModalBtn");
  const ctx = canvas.getContext("2d");

  const COLORS = ["#7fd6c8", "#8fd67f", "#f0b95a", "#7fb8e0", "#cfe8fb", "#fbeeaa", "#e5d9fb", "#d3f3d8", "#fde3c7", "#f5d6db"];
  const MIN_COUNT = 2;
  const MAX_COUNT = 10;

  let count = 4;
  let names = ["", "", "", ""];
  let currentRotation = 0;
  let spinning = false;

  function displayName(i) {
    return names[i] || `항목${i + 1}`;
  }

  function updateCountLabel() {
    countLabel.textContent = `항목 ${count}개`;
  }

  function syncNamesLength() {
    while (names.length < count) names.push("");
    names.length = count;
  }

  function renderSettingsInputs() {
    settingsInputs.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = names[i];
      input.placeholder = `항목${i + 1}`;
      input.addEventListener("input", () => {
        names[i] = input.value.trim();
        drawWheel();
      });
      settingsInputs.appendChild(input);
    }
  }

  function drawWheel() {
    const size = Math.round(wheelWrap.offsetWidth) || 520;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    const sliceAngle = (2 * Math.PI) / count;
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < count; i++) {
      const start = i * sliceAngle - Math.PI / 2;
      const end = start + sliceAngle;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(displayName(i), radius - 20, 6);
      ctx.restore();
    }
  }

  countMinus.addEventListener("click", () => {
    if (count <= MIN_COUNT) return;
    count -= 1;
    updateCountLabel();
    syncNamesLength();
    renderSettingsInputs();
    drawWheel();
  });

  countPlus.addEventListener("click", () => {
    if (count >= MAX_COUNT) return;
    count += 1;
    updateCountLabel();
    syncNamesLength();
    renderSettingsInputs();
    drawWheel();
  });

  settingsBtn.addEventListener("click", () => {
    settingsModalBackdrop.classList.remove("hidden");
  });

  function closeSettingsModal() {
    settingsModalBackdrop.classList.add("hidden");
  }
  settingsCloseBtn.addEventListener("click", closeSettingsModal);
  closeSettingsModalBtn.addEventListener("click", closeSettingsModal);
  settingsModalBackdrop.addEventListener("click", (e) => {
    if (e.target === settingsModalBackdrop) closeSettingsModal();
  });

  closeResultModalBtn.addEventListener("click", () => {
    resultModalBackdrop.classList.add("hidden");
  });
  resultModalBackdrop.addEventListener("click", (e) => {
    if (e.target === resultModalBackdrop) resultModalBackdrop.classList.add("hidden");
  });

  startBtn.addEventListener("click", () => {
    if (spinning) return;
    spinning = true;
    errorEl.classList.add("hidden");

    const sliceDeg = 360 / count;
    const targetIndex = Math.floor(Math.random() * count);
    const sliceCenter = targetIndex * sliceDeg + sliceDeg / 2;
    const targetMod = (360 - sliceCenter + 360) % 360;
    const currentMod = ((currentRotation % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const finalRotation = currentRotation + delta + extraSpins * 360;

    canvas.style.transition = "transform 4s cubic-bezier(0.17, 0.84, 0.44, 1)";
    canvas.style.transform = `rotate(${finalRotation}deg)`;
    currentRotation = finalRotation;

    setTimeout(() => {
      spinning = false;
      const winnerLabel = displayName(targetIndex);
      const nameEl = document.createElement("div");
      nameEl.className = "result-winner-text";
      nameEl.textContent = winnerLabel;
      resultCardWrap.innerHTML = "";
      resultCardWrap.appendChild(buildResultCard(winnerLabel, nameEl));
      resultModalBackdrop.classList.remove("hidden");
    }, 4100);
  });

  resetBtn.addEventListener("click", () => {
    spinning = false;
    canvas.style.transition = "none";
    canvas.style.transform = "rotate(0deg)";
    currentRotation = 0;
    names = names.map(() => "");
    renderSettingsInputs();
    drawWheel();
  });

  redrawRouletteWheel = drawWheel;
  window.addEventListener("resize", drawWheel);

  updateCountLabel();
  renderSettingsInputs();
  drawWheel();
})();

// ===== 핀볼 (마블 레이스) - lazygyu/roulette "Wheel of fortune" 맵 좌표 그대로 이식 =====
(function pinballGame() {
  const slotsInput = document.getElementById("pinballSlotsInput");
  const errorEl = document.getElementById("pinballError");
  const buildBtn = document.getElementById("pinballBuildBtn");
  const canvas = document.getElementById("pinballCanvas");
  const dropBtn = document.getElementById("pinballDropBtn");
  const resultEl = document.getElementById("pinballResult");
  const settingsPanel = document.getElementById("pinballSettings");
  const toggleSettingsBtn = document.getElementById("pinballToggleSettingsBtn");
  const toggleArrow = toggleSettingsBtn.querySelector(".pinball-toggle-arrow");
  const collapsibleRows = document.getElementById("pinballCollapsibleRows");
  const darkModeToggle = document.getElementById("pinballDarkModeToggle");
  const firstWinnerBtn = document.getElementById("pinballFirstWinnerBtn");
  const lastWinnerBtn = document.getElementById("pinballLastWinnerBtn");
  const winningRankInput = document.getElementById("pinballWinningRankInput");
  const ctx = canvas.getContext("2d");

  const { Engine, Bodies, Body, Composite } = Matter;

  const PALETTE = {
    dark: { bg: "#0e1116", peg: "#4a7fd6", finishLine: "#555", label: "#cfe2f7" },
    light: { bg: "#fafafa", peg: "#cfe2f7", finishLine: "#ddd", label: "#4a7fd6" },
  };
  const MARBLE_COLORS = ["#e05a5a", "#4a7fd6", "#2e9e5b", "#b3691a", "#6b4bad", "#ad3f68", "#1c5fa8", "#8a6d1f", "#e0577a", "#3fa796"];

  // lazygyu/roulette src/data/maps.ts 의 'Wheel of fortune' 맵 좌표 (박스2D 유닛).
  // 위쪽 낙하 구간(-300)은 화면 밖이라 -5로 잘라서 사용.
  const GOAL_Y = 111;
  const WHEEL_MAP = {
    walls: [
      [[16.5, -5], [9.25, -5], [9.25, 8.5], [2, 19.25], [2, 26], [9.75, 30], [9.75, 33.5], [1.25, 41], [1.25, 53.75], [8.25, 58.75], [8.25, 63], [9.25, 64], [8.25, 65], [8.25, 99.25], [15.1, 106.75], [15.1, 111.75]],
      [[16.5, -5], [16.5, 9.25], [9.5, 20], [9.5, 22.5], [17.5, 26], [17.5, 33.5], [24, 38.5], [19, 45.5], [19, 55.5], [24, 59.25], [24, 63], [23, 64], [24, 65], [24, 100.5], [16, 106.75], [16, 111.75]],
      [[12.75, 37.5], [7, 43.5], [7, 49.75], [12.75, 53.75], [12.75, 37.5]],
      [[14.75, 37.5], [14.75, 43], [17.5, 40.25], [14.75, 37.5]],
    ],
    boxes: [
      { x: 15.5, y: 30, w: 0.2, h: 0.2, angle: -Math.PI / 4 },
      { x: 15.5, y: 32, w: 0.2, h: 0.2, angle: -Math.PI / 4 },
      { x: 15.5, y: 28, w: 0.2, h: 0.2, angle: -Math.PI / 4 },
      { x: 12.5, y: 30, w: 0.2, h: 0.2, angle: -Math.PI / 4 },
      { x: 12.5, y: 32, w: 0.2, h: 0.2, angle: -Math.PI / 4 },
      { x: 12.5, y: 28, w: 0.2, h: 0.2, angle: -Math.PI / 4 },
      ...[9.4, 11.3, 13.2, 15.1, 17, 18.9, 20.7, 22.7].map((x) => ({ x, y: 66.6, w: 0.6, h: 0.1, angle: Math.PI / 4 })),
      ...[9.4, 11.3, 13.2, 15.1, 17, 18.9, 20.7, 22.7].map((x) => ({ x, y: 69.1, w: 0.6, h: 0.1, angle: -Math.PI / 4 })),
      ...[9.5, 12.75, 16, 19.25, 22.5].map((x) => ({ x, y: 92, w: 0.25, h: 0.25, angle: Math.PI / 4 })),
      ...[11, 14.25, 17.5, 20.75].map((x) => ({ x, y: 95, w: 0.25, h: 0.25, angle: Math.PI / 4 })),
      ...[9.5, 12.75, 16, 19.25, 22.5].map((x) => ({ x, y: 98, w: 0.25, h: 0.25, angle: Math.PI / 4 })),
    ],
    wheels: [
      { x: 8, y: 75, w: 2, h: 0.1, spin: 3.5 },
      { x: 12, y: 75, w: 2, h: 0.1, spin: -3.5 },
      { x: 16, y: 75, w: 2, h: 0.1, spin: 3.5 },
      { x: 20, y: 75, w: 2, h: 0.1, spin: -3.5 },
      { x: 24, y: 75, w: 2, h: 0.1, spin: 3.5 },
      { x: 14, y: 106.75, w: 2, h: 0.1, spin: -1.2 },
    ],
  };

  const MAP_SCALE = 14;
  const MAP_MARGIN = 30;
  const Y_MIN = -5;
  const Y_MAX = 111.75;
  const X_MAX = 26;

  function mapToPx(mx, my) {
    return { x: MAP_MARGIN + mx * MAP_SCALE, y: MAP_MARGIN + (my - Y_MIN) * MAP_SCALE };
  }

  const CANVAS_W = Math.round(MAP_MARGIN * 2 + X_MAX * MAP_SCALE);
  const CONTENT_H = Math.round(MAP_MARGIN * 2 + (Y_MAX - Y_MIN) * MAP_SCALE);
  const VIEWPORT_H = 700;
  const BALL_RADIUS = 6;
  const RACE_TIMEOUT_MS = 20000;
  const FINISH_Y = mapToPx(13, GOAL_Y).y;
  const START_POINT = mapToPx(12.875, 2);

  let W = CANVAS_W;
  let H = VIEWPORT_H;

  let names = [];
  let engine = null;
  let obstacles = [];
  let spinners = [];
  let marbles = [];
  let racing = false;
  let finishOrder = [];
  let raceStartTime = 0;
  let rafId = null;
  let darkMode = true;
  let winnerType = "first";
  let winningRank = 1;
  let cameraY = 0;

  function initCanvasSize() {
    W = CANVAS_W;
    H = VIEWPORT_H;
    canvas.width = W;
    canvas.height = H;
  }

  function makeObstacle(x, y, w, h, angle, extra) {
    const body = Bodies.rectangle(x, y, w, h, Object.assign({ isStatic: true, angle, restitution: 0.4, friction: 0.02 }, extra));
    body.renderW = w;
    body.renderH = h;
    return body;
  }

  function addPolylineWalls(points) {
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = mapToPx(points[i][0], points[i][1]);
      const p2 = mapToPx(points[i + 1][0], points[i + 1][1]);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.hypot(dx, dy);
      if (length < 1) continue;
      const angle = Math.atan2(dy, dx);
      const seg = makeObstacle((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, length, 5, angle, { restitution: 0.1 });
      obstacles.push(seg);
    }
  }

  function buildBoard() {
    initCanvasSize();
    engine = Engine.create();
    engine.gravity.y = 1;
    const world = engine.world;

    obstacles = [];
    spinners = [];

    WHEEL_MAP.walls.forEach(addPolylineWalls);

    WHEEL_MAP.boxes.forEach((b) => {
      const p = mapToPx(b.x, b.y);
      obstacles.push(makeObstacle(p.x, p.y, b.w * MAP_SCALE, b.h * MAP_SCALE, b.angle));
    });

    WHEEL_MAP.wheels.forEach((wd) => {
      const p = mapToPx(wd.x, wd.y);
      const spinner = makeObstacle(p.x, p.y, wd.w * MAP_SCALE, wd.h * MAP_SCALE, 0, { restitution: 0.4, friction: 0.02 });
      spinner.spinSpeed = wd.spin / 60;
      spinners.push(spinner);
      obstacles.push(spinner);
    });

    // 안전망 (맵 좌우/바닥)
    const walls = [
      Bodies.rectangle(-10, CONTENT_H / 2, 20, CONTENT_H, { isStatic: true }),
      Bodies.rectangle(W + 10, CONTENT_H / 2, 20, CONTENT_H, { isStatic: true }),
      Bodies.rectangle(W / 2, CONTENT_H + 10, W, 20, { isStatic: true }),
    ];

    Composite.add(world, obstacles.concat(walls));
    marbles = [];
    finishOrder = [];
    cameraY = 0;
  }

  function updateWinningRankUi() {
    winningRankInput.value = winningRank;
    firstWinnerBtn.classList.toggle("active", winnerType === "first");
    lastWinnerBtn.classList.toggle("active", winnerType === "last");
    winningRankInput.classList.toggle("active", winnerType === "custom");
  }

  function updateCamera() {
    if (!racing || !marbles.length) {
      cameraY = 0;
      return;
    }
    let leaderY = START_POINT.y;
    marbles.forEach((m) => {
      if (!m.finished) leaderY = Math.max(leaderY, m.body.position.y);
    });
    const target = leaderY - H * 0.4;
    cameraY = Math.max(0, Math.min(CONTENT_H - H, target));
  }

  function drawBoard() {
    const palette = darkMode ? PALETTE.dark : PALETTE.light;

    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(0, -cameraY);

    ctx.fillStyle = palette.peg;
    obstacles.forEach((o) => {
      ctx.save();
      ctx.translate(o.position.x, o.position.y);
      ctx.rotate(o.angle);
      ctx.fillRect(-o.renderW / 2, -o.renderH / 2, o.renderW, o.renderH);
      ctx.restore();
    });

    ctx.strokeStyle = palette.finishLine;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, FINISH_Y);
    ctx.lineTo(W, FINISH_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    marbles.forEach((m) => {
      const pos = m.body.position;
      ctx.beginPath();
      ctx.fillStyle = m.color;
      ctx.arc(pos.x, pos.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.label;
      ctx.fillText(m.name, pos.x, pos.y - BALL_RADIUS - 4);
    });

    ctx.restore();
  }

  buildBtn.addEventListener("click", () => {
    names = slotsInput.value.split("\n").map((s) => s.trim()).filter(Boolean);
    if (names.length < 2) {
      showGameError(errorEl, "이름을 2명 이상 입력해주세요.");
      dropBtn.disabled = true;
      return;
    }
    errorEl.classList.add("hidden");
    resultEl.innerHTML = "";
    settingsPanel.classList.remove("hide");

    if (rafId) cancelAnimationFrame(rafId);
    racing = false;
    marbles = [];
    finishOrder = [];
    cameraY = 0;

    winningRankInput.max = names.length;
    if (winnerType === "last") winningRank = names.length;
    if (winningRank > names.length) winningRank = names.length;
    updateWinningRankUi();

    buildBtn.disabled = false;
    dropBtn.disabled = false;
    drawBoard();
  });

  firstWinnerBtn.addEventListener("click", () => {
    winnerType = "first";
    winningRank = 1;
    updateWinningRankUi();
  });

  lastWinnerBtn.addEventListener("click", () => {
    winnerType = "last";
    winningRank = names.length || 1;
    updateWinningRankUi();
  });

  winningRankInput.addEventListener("change", () => {
    const v = parseInt(winningRankInput.value, 10);
    winnerType = "custom";
    winningRank = Math.max(1, Math.min(names.length || 1, isNaN(v) ? 1 : v));
    updateWinningRankUi();
  });

  function finishRace() {
    racing = false;
    buildBtn.disabled = false;
    resultEl.innerHTML = "";
    finishOrder.forEach((m, i) => {
      const rank = i + 1;
      const isWinner = rank === winningRank;
      const row = document.createElement("div");
      row.className = "pinball-result-row" + (isWinner ? " winner" : "");
      const rankEl = document.createElement("span");
      rankEl.className = "pinball-result-rank";
      rankEl.textContent = `${rank}등`;
      const labelEl = document.createElement("span");
      labelEl.textContent = m.name + (isWinner ? " 🏆" : "");
      row.append(rankEl, labelEl);
      resultEl.appendChild(row);
    });
    setTimeout(() => settingsPanel.classList.remove("hide"), 1200);
  }

  dropBtn.addEventListener("click", () => {
    if (racing || !names.length || !engine) return;
    racing = true;
    buildBtn.disabled = true;
    resultEl.innerHTML = "";
    finishOrder = [];
    settingsPanel.classList.add("hide");

    const corridorMin = mapToPx(9.5, 2).x;
    const corridorMax = mapToPx(16, 2).x;
    marbles = names.map((name, i) => {
      const startX = Math.max(corridorMin, Math.min(corridorMax, START_POINT.x + (Math.random() - 0.5) * (corridorMax - corridorMin)));
      const body = Bodies.circle(startX, START_POINT.y, BALL_RADIUS, {
        restitution: 0.4,
        friction: 0.02,
        frictionAir: 0.001,
      });
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 1.5, y: 0 });
      Composite.add(engine.world, body);
      return { name, color: MARBLE_COLORS[i % MARBLE_COLORS.length], body, finished: false };
    });

    raceStartTime = performance.now();

    function step() {
      spinners.forEach((s) => Body.rotate(s, s.spinSpeed));
      Engine.update(engine, 1000 / 60);
      updateCamera();
      drawBoard();

      marbles.forEach((m) => {
        if (m.finished) return;
        if (m.body.position.y > FINISH_Y) {
          m.finished = true;
          finishOrder.push(m);
        }
      });

      if (finishOrder.length >= marbles.length) {
        finishRace();
        return;
      }

      if (performance.now() - raceStartTime > RACE_TIMEOUT_MS) {
        marbles
          .filter((m) => !m.finished)
          .sort((a, b) => b.body.position.y - a.body.position.y)
          .forEach((m) => {
            m.finished = true;
            finishOrder.push(m);
          });
        finishRace();
        return;
      }

      rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
  });

  toggleSettingsBtn.addEventListener("click", () => {
    collapsibleRows.classList.toggle("collapsed");
    toggleArrow.textContent = collapsibleRows.classList.contains("collapsed") ? "▲" : "▼";
  });

  darkModeToggle.addEventListener("change", () => {
    darkMode = darkModeToggle.checked;
    drawBoard();
  });

  redrawPinballCanvas = () => {
    updateCamera();
    drawBoard();
  };

  buildBoard();
  drawBoard();
})();
