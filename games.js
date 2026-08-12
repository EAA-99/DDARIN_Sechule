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

function buildResultCard(label, contentEl) {
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
  winnerLabel.textContent = "WINNER";

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
        fromEl.textContent = names[startCol];
        const arrowEl = document.createElement("span");
        arrowEl.className = "ladder-result-arrow";
        arrowEl.textContent = "→";
        const toEl = document.createElement("span");
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
      fromEl.textContent = names[i];
      const arrowEl = document.createElement("span");
      arrowEl.className = "ladder-result-arrow";
      arrowEl.textContent = "→";
      const toEl = document.createElement("span");
      toEl.textContent = resultLabels[endCol];

      row.append(fromEl, arrowEl, toEl);
      rowsWrap.appendChild(row);
    }
    resultModalList.innerHTML = "";
    resultModalList.appendChild(buildResultCard("", rowsWrap));
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

// ===== 핀볼 (마블 레이스) =====
(function pinballGame() {
  const stage = document.getElementById("pinballStage");
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

  const PINBALL_HEIGHT = 700;
  const ROWS = 8;
  const PEG_RADIUS = 5;
  const BALL_RADIUS = 8;
  const RACE_TIMEOUT_MS = 15000;

  let W = 600;
  let H = PINBALL_HEIGHT;
  let PEG_TOP = 60;
  let PEG_BOTTOM = H - 160;
  let FINISH_Y = H - 60;

  let names = [];
  let engine = null;
  let pegBodies = [];
  let marbles = [];
  let racing = false;
  let finishOrder = [];
  let raceStartTime = 0;
  let rafId = null;
  let darkMode = true;
  let winnerType = "first";
  let winningRank = 1;

  function resizeCanvas() {
    W = Math.round(stage.offsetWidth) || 600;
    H = PINBALL_HEIGHT;
    PEG_TOP = 60;
    PEG_BOTTOM = H - 160;
    FINISH_Y = H - 60;
    canvas.width = W;
    canvas.height = H;
  }

  function buildBoard() {
    resizeCanvas();
    engine = Engine.create();
    const world = engine.world;

    pegBodies = [];
    const rowGap = (PEG_BOTTOM - PEG_TOP) / (ROWS - 1);
    for (let r = 0; r < ROWS; r++) {
      const count = 4 + r;
      const y = PEG_TOP + r * rowGap;
      const colGap = W / (count + 1);
      for (let c = 1; c <= count; c++) {
        pegBodies.push(
          Bodies.circle(c * colGap, y, PEG_RADIUS, {
            isStatic: true,
            restitution: 0.6,
            friction: 0.05,
          })
        );
      }
    }

    const walls = [
      Bodies.rectangle(-5, H / 2, 10, H, { isStatic: true }),
      Bodies.rectangle(W + 5, H / 2, 10, H, { isStatic: true }),
      Bodies.rectangle(W / 2, H + 5, W, 10, { isStatic: true }),
    ];

    Composite.add(world, pegBodies.concat(walls));
    marbles = [];
    finishOrder = [];
  }

  function updateWinningRankUi() {
    winningRankInput.value = winningRank;
    firstWinnerBtn.classList.toggle("active", winnerType === "first");
    lastWinnerBtn.classList.toggle("active", winnerType === "last");
    winningRankInput.classList.toggle("active", winnerType === "custom");
  }

  function drawBoard() {
    const palette = darkMode ? PALETTE.dark : PALETTE.light;

    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = palette.peg;
    pegBodies.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, PEG_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    if (pegBodies.length) {
      ctx.strokeStyle = palette.finishLine;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, FINISH_Y);
      ctx.lineTo(W, FINISH_Y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.font = "bold 11px sans-serif";
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

    marbles = names.map((name, i) => {
      const startX = ((i + 0.5) / names.length) * W + (Math.random() - 0.5) * 10;
      const clampedX = Math.max(BALL_RADIUS + 2, Math.min(W - BALL_RADIUS - 2, startX));
      const body = Bodies.circle(clampedX, 20, BALL_RADIUS, {
        restitution: 0.5,
        friction: 0.02,
        frictionAir: 0.001,
      });
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 1.5, y: 0 });
      Composite.add(engine.world, body);
      return { name, color: MARBLE_COLORS[i % MARBLE_COLORS.length], body, finished: false };
    });

    raceStartTime = performance.now();

    function step() {
      Engine.update(engine, 1000 / 60);
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
    if (racing) {
      resizeCanvas();
      drawBoard();
      return;
    }
    buildBoard();
    drawBoard();
  };
  window.addEventListener("resize", () => {
    if (racing) return;
    buildBoard();
    drawBoard();
  });

  buildBoard();
  drawBoard();
})();
