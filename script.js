const COLS = 10;
const ROWS = 20;
const CELL = 30;
const SCORE_BY_LINES = [0, 100, 300, 500, 800];
const BEST_SCORE_KEY = "tetris-best-score";

const PIECES = {
  I: { color: "#54d9ff", matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  J: { color: "#6885ff", matrix: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { color: "#ffae5c", matrix: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
  O: { color: "#ffe05b", matrix: [[1, 1], [1, 1]] },
  S: { color: "#71e48d", matrix: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  T: { color: "#bd7bff", matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  Z: { color: "#ff7084", matrix: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
};

const boardCanvas = document.querySelector("#game-board");
const boardContext = boardCanvas.getContext("2d");
const previewCanvas = document.querySelector("#next-piece");
const previewContext = previewCanvas.getContext("2d");
const overlay = document.querySelector("#screen-overlay");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const levelElement = document.querySelector("#level");
const linesElement = document.querySelector("#lines");
const statusChip = document.querySelector("#status-chip");
const statusText = statusChip.querySelector("strong");
const primaryAction = document.querySelector("#primary-action");
const sessionNumber = document.querySelector("#session-number");

let board = createBoard();
let currentPiece = null;
let nextType = null;
let bag = [];
let score = 0;
let bestScore = readBestScore();
let lines = 0;
let level = 1;
let phase = "start";
let dropCounter = 0;
let lastTime = 0;
let session = 0;
let newRecord = false;
let animationFrame;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function shuffledBag() {
  const types = Object.keys(PIECES);
  for (let i = types.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

function takeFromBag() {
  if (bag.length === 0) bag = shuffledBag();
  return bag.pop();
}

function createPiece(type) {
  const matrix = PIECES[type].matrix.map((row) => [...row]);
  return {
    type,
    matrix,
    color: PIECES[type].color,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  };
}

function startGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropCounter = 0;
  newRecord = false;
  bag = [];
  currentPiece = createPiece(takeFromBag());
  nextType = takeFromBag();
  session += 1;
  sessionNumber.textContent = `SESSION ${String(session).padStart(3, "0")}`;
  setPhase("playing");
  updateStats();
  draw();
}

function setPhase(nextPhase) {
  phase = nextPhase;
  const labels = { start: "READY", playing: "PLAYING", paused: "PAUSED", over: "GAME OVER" };
  statusText.textContent = labels[nextPhase];
  statusChip.dataset.state = nextPhase;
  primaryAction.textContent = nextPhase === "playing" ? "일시정지" : nextPhase === "paused" ? "계속하기" : "게임 시작";
  const arrow = document.createElement("span");
  arrow.textContent = nextPhase === "playing" || nextPhase === "paused" ? "Ⅱ" : "↗";
  primaryAction.append(arrow);
  renderOverlay();
}

function renderOverlay() {
  if (phase === "playing") {
    overlay.hidden = true;
    return;
  }

  overlay.hidden = false;
  if (phase === "start") {
    overlay.innerHTML = `
      <div class="overlay-card">
        <p class="overlay-kicker">READY WHEN YOU ARE</p>
        <h2>Make your move.</h2>
        <p>블록을 쌓고, 줄을 지우고,<br /><strong>최고 기록을 갱신하세요.</strong></p>
        <div class="overlay-actions"><button class="overlay-button" data-action="start">게임 시작 <span>↗</span></button></div>
      </div>`;
  } else if (phase === "paused") {
    overlay.innerHTML = `
      <div class="overlay-card">
        <p class="overlay-kicker">RUN ON HOLD</p>
        <h2>일시정지</h2>
        <p>잠시 멈췄습니다.<br />준비되면 게임을 이어가세요.</p>
        <div class="overlay-actions"><button class="overlay-button" data-action="resume">계속하기</button><button class="overlay-button secondary" data-action="restart">처음부터 다시 시작</button></div>
      </div>`;
  } else {
    overlay.innerHTML = `
      <div class="overlay-card">
        <p class="overlay-kicker">RUN COMPLETE</p>
        <h2>GAME OVER</h2>
        <p>최종 점수 <strong>${formatNumber(score)}</strong><br />${newRecord ? "새로운 최고 기록입니다!" : `최고 점수 ${formatNumber(bestScore)}`}</p>
        <div class="overlay-actions"><button class="overlay-button" data-action="restart">다시 시작 <span>↗</span></button><button class="overlay-button secondary" data-action="home">시작 화면으로</button></div>
      </div>`;
  }
}

function togglePause() {
  if (phase === "playing") setPhase("paused");
  else if (phase === "paused") setPhase("playing");
}

function formatNumber(value) {
  return String(value).padStart(6, "0");
}

function readBestScore() {
  const value = Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10);
  return Number.isFinite(value) ? value : 0;
}

function updateStats() {
  scoreElement.textContent = formatNumber(score);
  bestScoreElement.textContent = formatNumber(Math.max(bestScore, score));
  levelElement.textContent = String(level).padStart(2, "0");
  linesElement.textContent = String(lines).padStart(3, "0");
}

function collides(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue;
      const x = piece.x + col + offsetX;
      const y = piece.y + row + offsetY;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

function move(horizontal) {
  if (phase !== "playing" || collides(currentPiece, horizontal, 0)) return;
  currentPiece.x += horizontal;
  draw();
}

function softDrop() {
  if (phase !== "playing") return;
  if (!collides(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    score += 1;
  } else {
    lockPiece();
  }
  dropCounter = 0;
  updateStats();
  draw();
}

function hardDrop() {
  if (phase !== "playing") return;
  let distance = 0;
  while (!collides(currentPiece, 0, distance + 1)) distance += 1;
  currentPiece.y += distance;
  score += distance * 2;
  lockPiece();
  dropCounter = 0;
  updateStats();
  draw();
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function rotate() {
  if (phase !== "playing") return;
  const rotated = rotateMatrix(currentPiece.matrix);
  const kicks = [0, -1, 1, -2, 2];
  const kick = kicks.find((offset) => !collides(currentPiece, offset, 0, rotated));
  if (kick === undefined) return;
  currentPiece.x += kick;
  currentPiece.matrix = rotated;
  draw();
}

function mergePiece() {
  currentPiece.matrix.forEach((row, rowIndex) => row.forEach((filled, colIndex) => {
    if (!filled) return;
    const y = currentPiece.y + rowIndex;
    const x = currentPiece.x + colIndex;
    if (y >= 0) board[y][x] = currentPiece.color;
  }));
}

function clearLines() {
  const completeRows = board.reduce((count, row) => count + (row.every(Boolean) ? 1 : 0), 0);
  if (!completeRows) return;
  board = board.filter((row) => !row.every(Boolean));
  while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
  score += SCORE_BY_LINES[completeRows] * level;
  lines += completeRows;
  level = Math.min(10, Math.floor(lines / 10) + 1);
}

function lockPiece() {
  mergePiece();
  clearLines();
  currentPiece = createPiece(nextType);
  nextType = takeFromBag();
  if (collides(currentPiece)) {
    endGame();
  }
}

function endGame() {
  phase = "over";
  newRecord = score > bestScore;
  if (newRecord) {
    bestScore = score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
  updateStats();
  setPhase("over");
}

function drawCell(context, x, y, size, color, ghost = false) {
  const gap = Math.max(2, size * 0.08);
  const left = x * size + gap;
  const top = y * size + gap;
  const dimension = size - gap * 2;
  context.save();
  if (ghost) {
    context.strokeStyle = color;
    context.globalAlpha = 0.36;
    context.lineWidth = Math.max(1, size * 0.07);
    context.strokeRect(left + 1, top + 1, dimension - 2, dimension - 2);
  } else {
    context.fillStyle = color;
    context.globalAlpha = 1;
    context.fillRect(left, top, dimension, dimension);
    context.fillStyle = "rgba(255, 255, 255, .24)";
    context.fillRect(left + 2, top + 2, dimension - 4, Math.max(2, dimension * .11));
    context.fillStyle = "rgba(0, 0, 0, .17)";
    context.fillRect(left + 2, top + dimension - 4, dimension - 4, 2);
  }
  context.restore();
}

function drawGrid() {
  boardContext.fillStyle = "#0b121d";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.strokeStyle = "rgba(86, 112, 143, .17)";
  boardContext.lineWidth = 1;
  for (let x = 0; x <= COLS; x += 1) {
    boardContext.beginPath(); boardContext.moveTo(x * CELL + .5, 0); boardContext.lineTo(x * CELL + .5, ROWS * CELL); boardContext.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    boardContext.beginPath(); boardContext.moveTo(0, y * CELL + .5); boardContext.lineTo(COLS * CELL, y * CELL + .5); boardContext.stroke();
  }
}

function drawMatrix(piece, ghost = false) {
  piece.matrix.forEach((row, rowIndex) => row.forEach((filled, colIndex) => {
    if (filled && piece.y + rowIndex >= 0) drawCell(boardContext, piece.x + colIndex, piece.y + rowIndex, CELL, piece.color, ghost);
  }));
}

function draw() {
  drawGrid();
  board.forEach((row, rowIndex) => row.forEach((color, colIndex) => {
    if (color) drawCell(boardContext, colIndex, rowIndex, CELL, color);
  }));
  if (currentPiece) {
    const ghost = { ...currentPiece, y: currentPiece.y };
    while (!collides(ghost, 0, 1)) ghost.y += 1;
    drawMatrix(ghost, true);
    drawMatrix(currentPiece);
  }
  drawPreview();
}

function drawPreview() {
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  if (!nextType) return;
  const piece = PIECES[nextType];
  const size = 25;
  const height = piece.matrix.length * size;
  const width = piece.matrix[0].length * size;
  const offsetX = (previewCanvas.width - width) / 2;
  const offsetY = (previewCanvas.height - height) / 2;
  piece.matrix.forEach((row, rowIndex) => row.forEach((filled, colIndex) => {
    if (!filled) return;
    drawCellAtPreview(offsetX + colIndex * size, offsetY + rowIndex * size, size, piece.color);
  }));
}

function drawCellAtPreview(left, top, size, color) {
  const gap = 2;
  previewContext.fillStyle = color;
  previewContext.fillRect(left + gap, top + gap, size - gap * 2, size - gap * 2);
  previewContext.fillStyle = "rgba(255,255,255,.25)";
  previewContext.fillRect(left + gap + 2, top + gap + 2, size - gap * 2 - 4, 3);
}

function gameLoop(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  if (phase === "playing") {
    dropCounter += delta;
    const interval = Math.max(90, 850 * Math.pow(0.83, level - 1));
    if (dropCounter > interval) {
      if (!collides(currentPiece, 0, 1)) currentPiece.y += 1;
      else lockPiece();
      dropCounter = 0;
      updateStats();
      draw();
    }
  }
  animationFrame = requestAnimationFrame(gameLoop);
}

function goHome() {
  phase = "start";
  board = createBoard();
  currentPiece = null;
  nextType = null;
  updateStats();
  setPhase("start");
  draw();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ((phase === "start" || phase === "over") && key === "enter") {
    event.preventDefault(); startGame(); return;
  }
  if ((key === "p" || key === "escape") && (phase === "playing" || phase === "paused")) {
    event.preventDefault(); togglePause(); return;
  }
  if (phase !== "playing") return;
  if (["arrowleft", "arrowright", "arrowdown", "arrowup", " "].includes(event.key.toLowerCase())) event.preventDefault();
  if (key === "arrowleft") move(-1);
  if (key === "arrowright") move(1);
  if (key === "arrowdown") softDrop();
  if (key === "arrowup") rotate();
  if (event.code === "Space" && !event.repeat) hardDrop();
});

primaryAction.addEventListener("click", () => {
  if (phase === "start" || phase === "over") startGame();
  else togglePause();
});

overlay.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "start" || action === "restart") startGame();
  if (action === "resume") togglePause();
  if (action === "home") goHome();
});

document.querySelectorAll("[data-control]").forEach((button) => {
  button.addEventListener("click", () => {
    const control = button.dataset.control;
    if (control === "left") move(-1);
    if (control === "right") move(1);
    if (control === "down") softDrop();
    if (control === "rotate") rotate();
    if (control === "drop") hardDrop();
  });
});

bestScoreElement.textContent = formatNumber(bestScore);
updateStats();
setPhase("start");
draw();
lastTime = performance.now();
animationFrame = requestAnimationFrame(gameLoop);
