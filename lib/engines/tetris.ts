// Tetris engine: a typed port of references/started-games/03-tetris/game.js.
// Helpers are pure and take the board / piece they need; every piece of mutable
// game state lives in the createTetris closure.

import { sameExtras, type EngineFactory, type EnginePhase, type EngineSnapshot } from "@/lib/engines/types";

// ── Canvas ────────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;

// Sizes the backing store to the device pixel ratio while keeping an 800×600
// logical coordinate space, so drawing stays sharp on HiDPI screens.
function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// ── Constants (verbatim from the reference) ───────────────────────────────────
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

type Shape = number[][];
type Board = number[][];
type Piece = { type: number; shape: Shape; x: number; y: number };

const PIECES: readonly (Shape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // Nut (hollow ring)
];

const KICKS = [0, -1, 1, -2, 2];
const LINE_SCORES = [0, 100, 300, 500, 800];
const MAX_SCORE = 10_000_000; // the scores table CHECK upper bound
const MAX_DT = 50; // ms

// ── Look ──────────────────────────────────────────────────────────────────────
const CYAN = "#00f5ff";
const COLORS = [
  "",
  CYAN, // I
  "#f5ff00", // O
  "#aa00ff", // T
  "#00ff88", // S
  "#ff006e", // Z
  "#3d7bff", // J
  "#ff7700", // L
  "#9e9e9e", // Nut
];
const GRID_LINE = "rgba(0, 245, 255, 0.08)";
const HIGHLIGHT = "rgba(255,255,255,0.12)";
const GHOST_ALPHA = 0.2;
const GLOW = 10;

// The well is centred at scale 1; NEXT sits in the right side space.
const WELL_X = (W - COLS * BLOCK) / 2; // 250
const WELL_Y = 0;
const NEXT_X = 590;
const NEXT_Y = 60;
const NEXT_CELLS = 4;

// ── Board and piece helpers ───────────────────────────────────────────────────
function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(board: Board, shape: Shape, ox: number, oy: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

// Clockwise rotation: transpose + reverse.
function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// Rotates in place, trying horizontal kicks in order; no vertical kicks.
function tryRotate(board: Board, piece: Piece): void {
  const rotated = rotateCW(piece.shape);
  for (const kick of KICKS) {
    if (!collide(board, rotated, piece.x + kick, piece.y)) {
      piece.shape = rotated;
      piece.x += kick;
      return;
    }
  }
}

function merge(board: Board, piece: Piece): void {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) board[piece.y + r][piece.x + c] = piece.shape[r][c];
}

// Removes full rows in place and returns how many were cleared.
function clearLines(board: Board): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array<number>(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

// Lowest y the piece can fall to without colliding.
function ghostY(board: Board, piece: Piece): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}

// ── Drawing ───────────────────────────────────────────────────────────────────
// The site's pixel font, resolved from the CSS custom property.
function pixelFont(canvas: HTMLCanvasElement): string {
  return getComputedStyle(canvas).getPropertyValue("--pixel").trim() || "monospace";
}

// One cell with the reference look: 1 px inset and a 4 px highlight strip.
function drawBlock(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  col: number,
  row: number,
  colorIndex: number,
  { alpha = 1, glow = 0 }: { alpha?: number; glow?: number } = {},
): void {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  const x = ox + col * BLOCK + 1;
  const y = oy + row * BLOCK + 1;
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, BLOCK - 2, BLOCK - 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = HIGHLIGHT;
  ctx.fillRect(x, y, BLOCK - 2, 4);
  ctx.globalAlpha = 1;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  shape: Shape,
  col: number,
  row: number,
  opts?: { alpha?: number; glow?: number },
): void {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(ctx, ox, oy, col + c, row + r, shape[r][c], opts);
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(WELL_X + c * BLOCK, WELL_Y);
    ctx.lineTo(WELL_X + c * BLOCK, WELL_Y + ROWS * BLOCK);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(WELL_X, WELL_Y + r * BLOCK);
    ctx.lineTo(WELL_X + COLS * BLOCK, WELL_Y + r * BLOCK);
  }
  ctx.stroke();
}

// Cyan glowing outlines for the well and the NEXT box, plus the NEXT label.
function drawFrame(ctx: CanvasRenderingContext2D, font: string): void {
  ctx.save();
  ctx.strokeStyle = CYAN;
  ctx.fillStyle = CYAN;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = GLOW;
  ctx.lineWidth = 2;
  // Drawn just outside the well; top and bottom sit on the canvas edges.
  ctx.strokeRect(WELL_X - 1, WELL_Y + 1, COLS * BLOCK + 2, ROWS * BLOCK - 2);
  ctx.strokeRect(NEXT_X, NEXT_Y, NEXT_CELLS * BLOCK, NEXT_CELLS * BLOCK);
  ctx.font = `12px ${font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("NEXT", NEXT_X, NEXT_Y - 10);
  ctx.restore();
}

// The next piece, centred in the 4×4 preview as in the reference.
function drawNext(ctx: CanvasRenderingContext2D, piece: Piece): void {
  const offX = Math.floor((NEXT_CELLS - piece.shape[0].length) / 2);
  const offY = Math.floor((NEXT_CELLS - piece.shape.length) / 2);
  drawShape(ctx, NEXT_X, NEXT_Y, piece.shape, offX, offY, { glow: GLOW });
}

// Full frame: background, grid, locked cells, ghost, active piece, NEXT.
// `current` and `next` are null on the ready screen (empty well and box).
function drawScene(
  ctx: CanvasRenderingContext2D,
  font: string,
  board: Board,
  current: Piece | null,
  next: Piece | null,
): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) drawBlock(ctx, WELL_X, WELL_Y, c, r, board[r][c]);

  if (current) {
    drawShape(ctx, WELL_X, WELL_Y, current.shape, current.x, ghostY(board, current), {
      alpha: GHOST_ALPHA,
    });
    drawShape(ctx, WELL_X, WELL_Y, current.shape, current.x, current.y, { glow: GLOW });
  }
  if (next) drawNext(ctx, next);

  drawFrame(ctx, font);
}

// ── Engine ────────────────────────────────────────────────────────────────────
const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, [contenteditable]"))
  );
}

export const createTetris: EngineFactory = (canvas, cb) => {
  const ctx = setupCanvas(canvas);
  const font = pixelFont(canvas);

  // Game state
  let phase: EnginePhase = "ready";
  let board = createBoard();
  let current: Piece | null = null;
  let next: Piece | null = null;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropAccum = 0;
  let dropInterval = 1000;

  // The Space press that started the run; its key-repeat must not hard-drop
  let startSpaceHeld = false;

  // Loop and lifecycle
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;
  let lastSnapshot: EngineSnapshot | null = null;

  function initRun() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropAccum = 0;
    next = randomPiece();
    spawn();
  }

  function addScore(points: number) {
    score = Math.min(MAX_SCORE, score + points);
  }

  // Next becomes current; a piece that collides at spawn tops the run out.
  function spawn() {
    current = next ?? randomPiece();
    next = randomPiece();
    if (collide(board, current.shape, current.x, current.y)) {
      phase = "over";
      emit();
    }
  }

  function lockPiece(piece: Piece) {
    merge(board, piece);
    const cleared = clearLines(board);
    if (cleared) {
      addScore((LINE_SCORES[cleared] ?? 0) * level);
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
    spawn();
  }

  // One row down, or lock at once if blocked (no lock delay).
  function stepDown(piece: Piece): boolean {
    if (!collide(board, piece.shape, piece.x, piece.y + 1)) {
      piece.y++;
      return true;
    }
    lockPiece(piece);
    return false;
  }

  function softDrop(piece: Piece) {
    if (stepDown(piece)) addScore(1);
  }

  function hardDrop(piece: Piece) {
    const gy = ghostY(board, piece);
    addScore((gy - piece.y) * 2);
    piece.y = gy;
    lockPiece(piece);
  }

  // ── Snapshot ──
  function snapshot(): EngineSnapshot {
    return {
      phase,
      score,
      level,
      lives: null,
      extras: [{ key: "lines", label: "LINES", value: String(lines) }],
    };
  }

  // Notifies React only when a field actually changed.
  function emit() {
    const nextSnap = snapshot();
    const prev = lastSnapshot;
    if (
      prev &&
      prev.phase === nextSnap.phase &&
      prev.score === nextSnap.score &&
      prev.level === nextSnap.level &&
      sameExtras(prev.extras, nextSnap.extras)
    ) {
      return;
    }
    lastSnapshot = nextSnap;
    cb.onChange(nextSnap);
  }

  // ── Update ──
  function updatePlaying(dt: number) {
    if (!current) return;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      stepDown(current);
    }
  }

  // ── Loop ──
  function frame(ts: number) {
    if (destroyed) return;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    // Paused and over keep the last frame frozen: no updates, same draw.
    if (phase === "playing") updatePlaying(dt);
    drawScene(ctx, font, board, current, next);
    emit();
    rafId = requestAnimationFrame(frame);
  }

  // ── Phase transitions ──
  function start() {
    if (phase !== "ready") return;
    initRun();
    if (phase === "ready") phase = "playing";
    lastTime = null;
    emit();
  }

  function pause() {
    if (phase !== "playing") return;
    startSpaceHeld = false;
    phase = "paused";
    emit();
  }

  function resume() {
    if (phase !== "paused") return;
    phase = "playing";
    lastTime = null;
    emit();
  }

  function end() {
    if (phase === "over") return;
    startSpaceHeld = false;
    phase = "over";
    emit();
  }

  function restart() {
    startSpaceHeld = false;
    phase = "playing";
    initRun();
    lastTime = null;
    emit();
  }

  // ── Input listeners ──
  // Each keydown (including OS key-repeat) is one action, as in the reference.
  function onKeyDown(e: KeyboardEvent) {
    if (isEditable(e.target)) return;
    if (phase !== "over" && GAME_KEYS.has(e.code)) e.preventDefault();

    const isPauseKey = e.code === "KeyP" || e.code === "Escape";
    switch (phase) {
      case "ready":
        if (e.code === "Space" && !e.repeat) {
          startSpaceHeld = true;
          start();
        }
        break;
      case "playing": {
        if (isPauseKey) {
          if (!e.repeat) pause();
          break;
        }
        const piece = current;
        if (!piece) break;
        switch (e.code) {
          case "ArrowLeft":
            if (!collide(board, piece.shape, piece.x - 1, piece.y)) piece.x--;
            break;
          case "ArrowRight":
            if (!collide(board, piece.shape, piece.x + 1, piece.y)) piece.x++;
            break;
          case "ArrowDown":
            softDrop(piece);
            break;
          case "ArrowUp":
          case "KeyX":
            tryRotate(board, piece);
            break;
          case "Space":
            if (!startSpaceHeld) hardDrop(piece);
            break;
        }
        emit();
        break;
      }
      case "paused":
        if (isPauseKey && !e.repeat) resume();
        break;
      case "over":
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === "Space") startSpaceHeld = false;
  }

  function onVisibilityChange() {
    if (document.hidden) pause();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", onVisibilityChange);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", pause);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  emit();
  rafId = requestAnimationFrame(frame);

  return { start, pause, resume, end, restart, destroy };
};
