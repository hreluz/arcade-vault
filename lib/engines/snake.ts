// Snake engine: an original design (SPEC 10) drawn with the fruit sprites from
// references/source-assets/snake-assets/. Helpers are pure and take what they
// need; every piece of mutable game state lives in the createSnake closure.

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

// ── Constants ─────────────────────────────────────────────────────────────────
const CELL = 25; // px
const COLS = W / CELL; // 32
const ROWS = H / CELL; // 24
const START_LENGTH = 3;
const START_HEAD = { x: 16, y: 12 };
const BASE_SPEED = 8; // steps/s at level 1
const SPEED_PER_LEVEL = 1; // steps/s added per level
const MAX_SPEED = 20; // steps/s
const FRUITS_PER_LEVEL = 5;
const POINTS_PER_FRUIT = 10; // multiplied by the level
const TURN_BUFFER = 2;
const MAX_DT = 50; // ms

// Palette (from :root in app/globals.css)
const CYAN = "#00f5ff";
const MAGENTA = "#ff006e";
const GREEN = "#00ff88";
const GRID = "rgba(0, 245, 255, 0.06)";

// ── Sprites ───────────────────────────────────────────────────────────────────
// Middle (pixel-art) row of fruits.png. Rects come from the asset's sprites.js;
// the names are corrected to match what each rect actually shows.
const FRUITS_SRC = "/games/snake/fruits.png";
const FRUIT_Y = 136;
const FRUIT_H = 160;
const FRUIT_BOX = CELL - 4; // drawn size fits 21×21, keeping the aspect ratio

type FruitSprite = { name: string; x: number; w: number };

const FRUITS: readonly FruitSprite[] = [
  { name: "apple", x: 34, w: 110 },
  { name: "banana", x: 186, w: 150 },
  { name: "pineapple", x: 378, w: 110 },
  { name: "grapes", x: 540, w: 130 },
  { name: "pumpkin", x: 712, w: 130 },
  { name: "turnip", x: 894, w: 110 },
  { name: "eggplant", x: 1066, w: 110 },
  { name: "strawberry", x: 1228, w: 130 },
  { name: "cherry", x: 1400, w: 130 },
  { name: "carrot", x: 1582, w: 110 },
  { name: "mushroom", x: 1734, w: 150 },
  { name: "broccoli", x: 1906, w: 150 },
  { name: "watermelon", x: 2068, w: 170 },
  { name: "pepper", x: 2250, w: 140 },
  { name: "kiwi", x: 2432, w: 130 },
  { name: "lemon", x: 2604, w: 130 },
  { name: "orange", x: 2786, w: 110 },
  { name: "peach", x: 2948, w: 130 },
  { name: "peanut", x: 3110, w: 150 },
  { name: "raspberry", x: 3302, w: 110 },
  { name: "tomato", x: 3454, w: 150 },
  { name: "salad bowl", x: 3637, w: 130 },
];

// ── Entities ──────────────────────────────────────────────────────────────────
type Cell = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
type Fruit = Cell & { sprite: number };

const DIR_VECTORS: Readonly<Record<Dir, Cell>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Readonly<Record<Dir, Dir>> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

// Head first, heading right.
function startSnake(): Cell[] {
  return Array.from({ length: START_LENGTH }, (_, i) => ({ x: START_HEAD.x - i, y: START_HEAD.y }));
}

function levelFor(fruitsEaten: number): number {
  return 1 + Math.floor(fruitsEaten / FRUITS_PER_LEVEL);
}

function stepsPerSecond(level: number): number {
  return Math.min(BASE_SPEED + (level - 1) * SPEED_PER_LEVEL, MAX_SPEED);
}

function outOfBounds(c: Cell): boolean {
  return c.x < 0 || c.x >= COLS || c.y < 0 || c.y >= ROWS;
}

// A uniformly random empty cell with a random sprite, or null on a full board.
function spawnFruit(snake: readonly Cell[]): Fruit | null {
  const taken = new Set(snake.map((c) => c.y * COLS + c.x));
  const free: number[] = [];
  for (let i = 0; i < COLS * ROWS; i++) if (!taken.has(i)) free.push(i);
  if (free.length === 0) return null;
  const i = free[Math.floor(Math.random() * free.length)];
  return {
    x: i % COLS,
    y: Math.floor(i / COLS),
    sprite: Math.floor(Math.random() * FRUITS.length),
  };
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawBoard(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = CELL; x < W; x += CELL) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = CELL; y < H; y += CELL) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 8;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.restore();
}

// Centred in its cell, scaled to fit FRUIT_BOX while keeping the aspect ratio.
function drawFruit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, fruit: Fruit): void {
  const sp = FRUITS[fruit.sprite];
  const scale = Math.min(FRUIT_BOX / sp.w, FRUIT_BOX / FRUIT_H);
  const dw = sp.w * scale;
  const dh = FRUIT_H * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    sp.x,
    FRUIT_Y,
    sp.w,
    FRUIT_H,
    fruit.x * CELL + (CELL - dw) / 2,
    fruit.y * CELL + (CELL - dh) / 2,
    dw,
    dh,
  );
  ctx.restore();
}

function drawSegment(ctx: CanvasRenderingContext2D, c: Cell, color: string, blur: number): void {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.beginPath();
  ctx.roundRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2, 5);
  ctx.fill();
}

// Two eyes on the leading half of the head, side by side across the direction.
function drawEyes(ctx: CanvasRenderingContext2D, head: Cell, dir: Dir): void {
  const v = DIR_VECTORS[dir];
  const cx = head.x * CELL + CELL / 2 + v.x * 5;
  const cy = head.y * CELL + CELL / 2 + v.y * 5;
  const px = -v.y * 5; // perpendicular offset
  const py = v.x * 5;
  ctx.fillStyle = "#000";
  ctx.shadowBlur = 0;
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.arc(cx + px * s, cy + py * s, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Body tail-to-neck, then the head on top (magenta once the snake crashed).
function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: readonly Cell[],
  dir: Dir,
  dead: boolean,
): void {
  ctx.save();
  for (let i = snake.length - 1; i > 0; i--) drawSegment(ctx, snake[i], GREEN, 8);
  drawSegment(ctx, snake[0], dead ? MAGENTA : GREEN, 16);
  drawEyes(ctx, snake[0], dir);
  ctx.restore();
}

// Full frame: board, fruit (once the sprite sheet loaded) and snake. No HUD or
// overlays: React draws those.
function drawScene(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  fruit: Fruit | null,
  snake: readonly Cell[],
  dir: Dir,
  dead: boolean,
): void {
  drawBoard(ctx);
  if (img && fruit) drawFruit(ctx, img, fruit);
  drawSnake(ctx, snake, dir, dead);
}

// ── Engine ────────────────────────────────────────────────────────────────────
const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

const KEY_DIRS: Readonly<Record<string, Dir>> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, [contenteditable]"))
  );
}

export const createSnake: EngineFactory = (canvas, cb) => {
  const ctx = setupCanvas(canvas);

  // Sprite sheet: the fruit is not drawn until it loads
  let img: HTMLImageElement | null = null;
  const sheet = new Image();
  sheet.onload = () => {
    if (!destroyed) img = sheet;
  };
  sheet.src = FRUITS_SRC;

  // Game state
  let phase: EnginePhase = "ready";
  let snake: Cell[] = [];
  let dir: Dir = "right";
  let turns: Dir[] = [];
  let fruit: Fruit | null = null;
  let fruitsEaten = 0;
  let score = 0;
  let level = 1;
  let dead = false; // the head hit a wall or the body
  let acc = 0; // ms accumulated towards the next step

  // Loop and lifecycle
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;
  let lastSnapshot: EngineSnapshot | null = null;

  // A fresh board: start snake heading right, a new fruit, zeroed counters.
  function initRun() {
    snake = startSnake();
    dir = "right";
    turns = [];
    fruit = spawnFruit(snake);
    fruitsEaten = 0;
    score = 0;
    level = 1;
    dead = false;
    acc = 0;
  }

  // Queues a turn unless the buffer is full, it repeats the last queued (or
  // current) direction, or it would reverse into the body.
  function enqueue(next: Dir) {
    if (turns.length >= TURN_BUFFER) return;
    const last = turns.length > 0 ? turns[turns.length - 1] : dir;
    if (next === last || next === OPPOSITE[last]) return;
    turns.push(next);
  }

  // ── Snapshot ──
  function snapshot(): EngineSnapshot {
    return {
      phase,
      score,
      level,
      lives: null,
      extras: [{ key: "length", label: "LENGTH", value: String(snake.length) }],
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
      prev.lives === nextSnap.lives &&
      sameExtras(prev.extras, nextSnap.extras)
    ) {
      return;
    }
    lastSnapshot = nextSnap;
    cb.onChange(nextSnap);
  }

  function endRun() {
    phase = "over";
    turns = [];
  }

  // ── Update: one grid step ──
  function step() {
    const queued = turns.shift();
    if (queued) dir = queued;

    const v = DIR_VECTORS[dir];
    const head = { x: snake[0].x + v.x, y: snake[0].y + v.y };
    if (outOfBounds(head)) {
      dead = true;
      endRun();
      return;
    }

    // Growing keeps the tail; otherwise the tail leaves its cell first, so
    // following it into that cell is legal.
    const grows = fruit !== null && head.x === fruit.x && head.y === fruit.y;
    const body = grows ? snake : snake.slice(0, -1);
    if (body.some((c) => c.x === head.x && c.y === head.y)) {
      dead = true;
      endRun();
      return;
    }
    snake = [head, ...body];

    if (grows) {
      fruitsEaten++;
      score += POINTS_PER_FRUIT * level;
      level = levelFor(fruitsEaten);
      fruit = spawnFruit(snake);
      if (!fruit) endRun(); // board full
    }
  }

  // ── Loop ──
  function frame(ts: number) {
    if (destroyed) return;
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    // Paused and over keep the last frame frozen: no updates, same draw.
    if (phase === "playing") {
      acc += dtMs;
      let interval = 1000 / stepsPerSecond(level);
      while (phase === "playing" && acc >= interval) {
        acc -= interval;
        step();
        interval = 1000 / stepsPerSecond(level);
      }
    }
    drawScene(ctx, img, fruit, snake, dir, dead);
    emit();
    rafId = requestAnimationFrame(frame);
  }

  // ── Phase transitions ──
  // start() plays the board shown on the ready screen.
  function start() {
    if (phase !== "ready") return;
    turns = [];
    acc = 0;
    phase = "playing";
    lastTime = null;
    emit();
  }

  function pause() {
    if (phase !== "playing") return;
    turns = [];
    phase = "paused";
    emit();
  }

  // The accumulator is kept, so the snake continues mid-step.
  function resume() {
    if (phase !== "paused") return;
    phase = "playing";
    lastTime = null;
    emit();
  }

  function end() {
    if (phase === "over") return;
    endRun();
    emit();
  }

  function restart() {
    initRun();
    phase = "playing";
    lastTime = null;
    emit();
  }

  // ── Input listeners ──
  function onKeyDown(e: KeyboardEvent) {
    if (isEditable(e.target)) return;
    if (phase !== "over" && GAME_KEYS.has(e.code)) e.preventDefault();

    const isPauseKey = e.code === "KeyP" || e.code === "Escape";
    switch (phase) {
      case "ready":
        if (e.code === "Space" && !e.repeat) start();
        break;
      case "playing": {
        const next = KEY_DIRS[e.code];
        if (next) enqueue(next);
        else if (isPauseKey && !e.repeat) pause();
        break;
      }
      case "paused":
        if (isPauseKey && !e.repeat) resume();
        break;
      case "over":
        break;
    }
  }

  function onVisibilityChange() {
    if (document.hidden) pause();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", onVisibilityChange);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(rafId);
    sheet.onload = null;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("blur", pause);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  // Ready screen: the start snake heading right and the first fruit.
  initRun();
  emit();
  rafId = requestAnimationFrame(frame);

  return { start, pause, resume, end, restart, destroy };
};
