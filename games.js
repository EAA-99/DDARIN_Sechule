function showGameError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}

document.querySelectorAll(".side-nav-submenu-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    etcSubmenu.classList.add("hidden");
    if (btn.dataset.etc === "ladder") openLadderModal();
    if (btn.dataset.etc === "roulette") openRouletteModal();
    if (btn.dataset.etc === "pinball") openPinballModal();
  });
});

// ===== 사다리타기 =====
let openLadderModal, closeLadderModal;
(function ladderGame() {
  const backdrop = document.getElementById("ladderModalBackdrop");
  const namesInput = document.getElementById("ladderNamesInput");
  const resultsInput = document.getElementById("ladderResultsInput");
  const errorEl = document.getElementById("ladderError");
  const startBtn = document.getElementById("ladderStartBtn");
  const canvas = document.getElementById("ladderCanvas");
  const resultEl = document.getElementById("ladderResult");
  const closeBtn = document.getElementById("closeLadderModalBtn");
  const ctx = canvas.getContext("2d");

  const ROWS = 14;
  const ROW_H = 28;
  const COL_GAP = 60;
  const SIDE_PAD = 30;
  const TOP_PAD = 40;
  const BOTTOM_PAD = 40;

  let names = [];
  let results = [];
  let rungs = [];

  openLadderModal = function () {
    backdrop.classList.remove("hidden");
  };

  closeLadderModal = function () {
    backdrop.classList.add("hidden");
    canvas.classList.add("hidden");
    errorEl.classList.add("hidden");
    resultEl.textContent = "";
  };

  function colX(c) {
    return SIDE_PAD + c * COL_GAP;
  }

  function drawLadder(highlightPath) {
    const n = names.length;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#2a2a2a";
    for (let c = 0; c < n; c++) {
      ctx.fillText(names[c], colX(c), TOP_PAD - 14);
      ctx.fillText(results[c], colX(c), TOP_PAD + ROWS * ROW_H + 26);
    }

    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 2;
    for (let c = 0; c < n; c++) {
      ctx.beginPath();
      ctx.moveTo(colX(c), TOP_PAD);
      ctx.lineTo(colX(c), TOP_PAD + ROWS * ROW_H);
      ctx.stroke();
    }

    ctx.strokeStyle = "#bbb";
    for (let r = 0; r < ROWS; r++) {
      const y = TOP_PAD + r * ROW_H + ROW_H / 2;
      rungs[r].forEach((c) => {
        ctx.beginPath();
        ctx.moveTo(colX(c), y);
        ctx.lineTo(colX(c + 1), y);
        ctx.stroke();
      });
    }

    if (highlightPath) {
      ctx.strokeStyle = "#4a7fd6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      highlightPath.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }
  }

  function tracePath(startCol) {
    let col = startCol;
    const pts = [{ x: colX(col), y: TOP_PAD }];
    for (let r = 0; r < ROWS; r++) {
      const y1 = TOP_PAD + r * ROW_H;
      const y2 = y1 + ROW_H;
      const midY = y1 + ROW_H / 2;
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

  startBtn.addEventListener("click", () => {
    names = namesInput.value.split("\n").map((s) => s.trim()).filter(Boolean);
    results = resultsInput.value.split("\n").map((s) => s.trim()).filter(Boolean);
    resultEl.textContent = "";

    if (names.length < 2) {
      showGameError(errorEl, "참가자를 2명 이상 입력해주세요.");
      canvas.classList.add("hidden");
      return;
    }
    if (names.length !== results.length) {
      showGameError(errorEl, "참가자 수와 결과 수가 같아야 합니다.");
      canvas.classList.add("hidden");
      return;
    }
    errorEl.classList.add("hidden");

    const n = names.length;
    rungs = Array.from({ length: ROWS }, () => new Set());
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < n - 1; c++) {
        if (rungs[r].has(c - 1)) continue;
        if (Math.random() < 0.35) rungs[r].add(c);
      }
    }

    canvas.width = Math.max(320, n * COL_GAP + SIDE_PAD);
    canvas.height = TOP_PAD + BOTTOM_PAD + ROWS * ROW_H;
    canvas.classList.remove("hidden");
    drawLadder(null);
  });

  canvas.addEventListener("click", (e) => {
    if (!names.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (y > TOP_PAD) return;
    let col = Math.round((x - SIDE_PAD) / COL_GAP);
    col = Math.max(0, Math.min(names.length - 1, col));
    const { path, endCol } = tracePath(col);
    drawLadder(path);
    resultEl.textContent = `${names[col]} → ${results[endCol]}`;
  });

  closeBtn.addEventListener("click", closeLadderModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeLadderModal();
  });
})();

// ===== 룰렛 =====
let openRouletteModal, closeRouletteModal;
(function rouletteGame() {
  const backdrop = document.getElementById("rouletteModalBackdrop");
  const optionsInput = document.getElementById("rouletteOptionsInput");
  const errorEl = document.getElementById("rouletteError");
  const buildBtn = document.getElementById("rouletteBuildBtn");
  const wheelWrap = document.getElementById("rouletteWheelWrap");
  const canvas = document.getElementById("rouletteCanvas");
  const spinBtn = document.getElementById("rouletteSpinBtn");
  const resultEl = document.getElementById("rouletteResult");
  const closeBtn = document.getElementById("closeRouletteModalBtn");
  const ctx = canvas.getContext("2d");

  const COLORS = ["#cfe8fb", "#fbeeaa", "#e5d9fb", "#d3f3d8", "#fde3c7", "#f5d6db", "#e2e2e2", "#fbe0f6"];
  let options = [];
  let currentRotation = 0;
  let spinning = false;

  openRouletteModal = function () {
    backdrop.classList.remove("hidden");
  };

  closeRouletteModal = function () {
    backdrop.classList.add("hidden");
    wheelWrap.classList.add("hidden");
    spinBtn.classList.add("hidden");
    resultEl.textContent = "";
    errorEl.classList.add("hidden");
    canvas.style.transition = "none";
    canvas.style.transform = "rotate(0deg)";
    currentRotation = 0;
    spinning = false;
  };

  function drawWheel() {
    const n = options.length;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    const sliceAngle = (2 * Math.PI) / n;
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < n; i++) {
      const start = i * sliceAngle - Math.PI / 2;
      const end = start + sliceAngle;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#333";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(options[i], radius - 10, 4);
      ctx.restore();
    }
  }

  buildBtn.addEventListener("click", () => {
    options = optionsInput.value.split("\n").map((s) => s.trim()).filter(Boolean);
    if (options.length < 2) {
      showGameError(errorEl, "항목을 2개 이상 입력해주세요.");
      wheelWrap.classList.add("hidden");
      spinBtn.classList.add("hidden");
      return;
    }
    errorEl.classList.add("hidden");
    resultEl.textContent = "";
    canvas.style.transition = "none";
    canvas.style.transform = "rotate(0deg)";
    currentRotation = 0;
    drawWheel();
    wheelWrap.classList.remove("hidden");
    spinBtn.classList.remove("hidden");
  });

  spinBtn.addEventListener("click", () => {
    if (spinning || !options.length) return;
    spinning = true;
    resultEl.textContent = "";

    const n = options.length;
    const sliceDeg = 360 / n;
    const targetIndex = Math.floor(Math.random() * n);
    const sliceCenter = targetIndex * sliceDeg + sliceDeg / 2;
    const targetMod = (360 - sliceCenter + 360) % 360;
    const currentMod = ((currentRotation % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const finalRotation = currentRotation + delta + extraSpins * 360;

    canvas.style.transition = "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)";
    canvas.style.transform = `rotate(${finalRotation}deg)`;
    currentRotation = finalRotation;

    setTimeout(() => {
      spinning = false;
      resultEl.textContent = `당첨: ${options[targetIndex]}`;
    }, 4100);
  });

  closeBtn.addEventListener("click", closeRouletteModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeRouletteModal();
  });
})();

// ===== 핀볼 =====
let openPinballModal, closePinballModal;
(function pinballGame() {
  const backdrop = document.getElementById("pinballModalBackdrop");
  const slotsInput = document.getElementById("pinballSlotsInput");
  const errorEl = document.getElementById("pinballError");
  const buildBtn = document.getElementById("pinballBuildBtn");
  const canvas = document.getElementById("pinballCanvas");
  const dropBtn = document.getElementById("pinballDropBtn");
  const resultEl = document.getElementById("pinballResult");
  const closeBtn = document.getElementById("closePinballModalBtn");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;
  const ROWS = 8;
  const PEG_TOP = 40;
  const PEG_BOTTOM = H - 70;
  const SLOT_Y = H - 50;

  let slots = [];
  let pegs = [];
  let dropping = false;
  let ball = null;

  openPinballModal = function () {
    backdrop.classList.remove("hidden");
  };

  closePinballModal = function () {
    backdrop.classList.add("hidden");
    canvas.classList.add("hidden");
    dropBtn.classList.add("hidden");
    resultEl.textContent = "";
    errorEl.classList.add("hidden");
    dropping = false;
  };

  function drawBoard() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#cfe2f7";
    pegs.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const n = slots.length;
    const slotW = W / n;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = "#ddd";
      ctx.strokeRect(i * slotW, SLOT_Y, slotW, H - SLOT_Y);
      ctx.fillStyle = "#4a7fd6";
      ctx.fillText(slots[i], i * slotW + slotW / 2, SLOT_Y + 20);
    }

    if (ball) {
      ctx.beginPath();
      ctx.fillStyle = "#e05a5a";
      ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  buildBtn.addEventListener("click", () => {
    slots = slotsInput.value.split("\n").map((s) => s.trim()).filter(Boolean);
    if (slots.length < 2) {
      showGameError(errorEl, "슬롯을 2개 이상 입력해주세요.");
      canvas.classList.add("hidden");
      dropBtn.classList.add("hidden");
      return;
    }
    errorEl.classList.add("hidden");
    resultEl.textContent = "";

    pegs = [];
    const rowGap = (PEG_BOTTOM - PEG_TOP) / (ROWS - 1);
    for (let r = 0; r < ROWS; r++) {
      const count = 4 + r;
      const y = PEG_TOP + r * rowGap;
      const colGap = W / (count + 1);
      for (let c = 1; c <= count; c++) {
        pegs.push({ x: c * colGap, y });
      }
    }

    ball = null;
    canvas.classList.remove("hidden");
    dropBtn.classList.remove("hidden");
    drawBoard();
  });

  dropBtn.addEventListener("click", () => {
    if (dropping || !slots.length) return;
    dropping = true;
    resultEl.textContent = "";
    ball = { x: W / 2, y: 10, vy: 2 };
    let lastRow = -1;
    const rowGap = (PEG_BOTTOM - PEG_TOP) / (ROWS - 1);

    function step() {
      ball.y += ball.vy;
      ball.vy = Math.min(ball.vy + 0.15, 6);

      const rowIndex = Math.round((ball.y - PEG_TOP) / rowGap);
      if (
        rowIndex >= 0 &&
        rowIndex < ROWS &&
        rowIndex !== lastRow &&
        Math.abs(ball.y - (PEG_TOP + rowIndex * rowGap)) < 2
      ) {
        lastRow = rowIndex;
        ball.x += (Math.random() < 0.5 ? -1 : 1) * (W / (ROWS * 6));
        ball.x = Math.max(10, Math.min(W - 10, ball.x));
      }

      drawBoard();

      if (ball.y < SLOT_Y) {
        requestAnimationFrame(step);
      } else {
        ball.y = SLOT_Y + 15;
        drawBoard();
        const n = slots.length;
        const slotW = W / n;
        let idx = Math.floor(ball.x / slotW);
        idx = Math.max(0, Math.min(n - 1, idx));
        dropping = false;
        resultEl.textContent = `당첨: ${slots[idx]}`;
      }
    }
    requestAnimationFrame(step);
  });

  closeBtn.addEventListener("click", closePinballModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closePinballModal();
  });
})();
