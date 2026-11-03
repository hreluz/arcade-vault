// Frogger engine: an original build from canvas primitives (no sprites). Helpers
// are pure and take what they need; every piece of mutable game state lives in
// the createFrogger closure.

import { froggerSkins, type FroggerRole } from "@/lib/skins/frogger";
import { DEFAULT_SKIN, type SkinPalette } from "@/lib/skins/types";
import {
  sameExtras,
  type EngineFactory,
  type EnginePhase,
  type EngineSnapshot,
  type PadCode,
} from "@/lib/engines/types";

// ── Canvas ────────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640, board width; centred in W × H
const CANVAS_H = ROWS * CELL; // 560, board height
const BOARD_X = (W - CANVAS_W) / 2;
const BOARD_Y = (H - CANVAS_H) / 2;

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

// ── Zones (row index, 0 = top) ────────────────────────────────────────────────
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

// ── Constants ─────────────────────────────────────────────────────────────────
const START_COL = COLS / 2;
const START_LIVES = 3;
const HOP_MS = 120;
const POINTS_PER_ROW = 10;
const POINTS_PER_GOAL = 50;
const POINTS_PER_SECOND_LEFT = 10;
const POINTS_PER_ROUND = 200;
const MAX_DT = 50; // ms
const GOAL_COLS: readonly number[] = [1, 4, 7, 10, 13]; // left column of each 2-column slot
const GOAL_WIDTH = 2; // cells
const TIME_BAR_H = 6; // px

// The palette's colours; the engine reads them every frame.
type Colors = Record<FroggerRole, string>;

// ── Entities ──────────────────────────────────────────────────────────────────
type Direction = "up" | "down" | "left" | "right";

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  cycleT?: number; // turtles only: ms into the visible + underwater cycle
}

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

const DIR_VECTORS: Readonly<Record<Direction, { col: number; row: number }>> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

const DIR_ANGLES: Readonly<Record<Direction, number>> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

function startFrog(): Frog {
  return {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: START_COL,
    targetRow: ROW_START,
  };
}

function inRiver(row: number): boolean {
  return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
}

// 1 s less per level, down to 8 s.
function roundTimeMs(level: number): number {
  return Math.max(8000, 15000 - (level - 1) * 1000);
}

// ── Lane map ──────────────────────────────────────────────────────────────────
const SPEED_PER_LEVEL = 1.15; // every speed is multiplied by this each level
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_UNDER_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_UNDER_MS;

type LaneSpec = {
  row: number;
  speed: number; // px/frame at level 1
  dir: 1 | -1;
  type: Entity["type"];
  width: number; // cells
  count: number;
};

const LANE_SPECS: readonly LaneSpec[] = [
  // Road, start side first
  { row: 12, speed: 1.5, dir: -1, type: "car", width: 1, count: 4 },
  { row: 11, speed: 2.5, dir: 1, type: "car", width: 1, count: 3 },
  { row: 10, speed: 1.5, dir: -1, type: "truck", width: 3, count: 3 },
  { row: 9, speed: 3, dir: 1, type: "car", width: 2, count: 3 },
  { row: 8, speed: 4, dir: -1, type: "car", width: 1, count: 3 },
  // River, road side first
  { row: 6, speed: 1.5, dir: -1, type: "turtle", width: 3, count: 4 },
  { row: 5, speed: 1, dir: 1, type: "log", width: 3, count: 3 },
  { row: 4, speed: 2, dir: -1, type: "log", width: 4, count: 3 },
  { row: 3, speed: 1.5, dir: 1, type: "turtle", width: 2, count: 4 },
  { row: 2, speed: 3, dir: -1, type: "log", width: 2, count: 4 },
  { row: 1, speed: 1.5, dir: 1, type: "log", width: 3, count: 3 },
];

// Entities leave one side and re-enter at the other, so they travel COLS + width
// cells per loop. Spacing them evenly over that span keeps every gap equal.
function buildLanes(level: number): Lane[] {
  const scale = SPEED_PER_LEVEL ** (level - 1);
  return LANE_SPECS.map(({ row, speed, dir, type, width, count }) => {
    const span = COLS + width;
    const entities = Array.from({ length: count }, (_, i): Entity => {
      const entity: Entity = { col: (i * span) / count - width, width, type };
      if (type === "turtle") {
        // Staggered, so the groups of a lane don't all submerge together.
        entity.cycleT = (i * TURTLE_CYCLE_MS) / count;
        entity.submerged = entity.cycleT >= TURTLE_VISIBLE_MS;
      }
      return entity;
    });
    return { row, speed: speed * scale, dir, entities };
  });
}

// Speeds are px/frame at 60 fps; positions are in cells. The overshoot is kept on
// wrap, so the spacing of a lane never drifts.
function laneDelta(lane: Lane, dt: number): number {
  return (lane.speed * lane.dir * dt) / 16 / CELL;
}

function advanceLane(lane: Lane, dt: number): void {
  const delta = laneDelta(lane, dt);
  for (const e of lane.entities) {
    e.col += delta;
    if (lane.dir === 1 && e.col >= COLS) e.col -= COLS + e.width;
    if (lane.dir === -1 && e.col <= -e.width) e.col += COLS + e.width;
    if (e.type === "turtle") {
      e.cycleT = ((e.cycleT ?? 0) + dt) % TURTLE_CYCLE_MS;
      e.submerged = e.cycleT >= TURTLE_VISIBLE_MS;
    }
  }
}

// ── Collision and support ─────────────────────────────────────────────────────
// Entities are tested against the frog's centre, so a hit or a landing matches
// what the player sees.
function covers(e: Entity, frog: Frog): boolean {
  const center = frog.col + 0.5;
  return center >= e.col && center < e.col + e.width;
}

function checkRoadCollision(frog: Frog, lanes: readonly Lane[]): boolean {
  if (frog.row < ROW_ROAD_TOP || frog.row > ROW_ROAD_BOT) return false;
  return lanes.some((l) => l.row === frog.row && l.entities.some((e) => covers(e, frog)));
}

// The entity holding the frog up, or null if it is in the water. A submerged
// turtle holds nothing.
function getSupport(frog: Frog, lanes: readonly Lane[]): Entity | null {
  const lane = lanes.find((l) => l.row === frog.row);
  const entity = lane?.entities.find((e) => covers(e, frog));
  return entity && !entity.submerged ? entity : null;
}

// Marks the slot under the frog and returns true; false means the frog missed
// every slot or hit an occupied one.
function checkGoal(frog: Frog, goals: boolean[]): boolean {
  const center = frog.col + 0.5;
  const slot = GOAL_COLS.findIndex((c) => center >= c && center < c + GOAL_WIDTH);
  if (slot === -1 || goals[slot]) return false;
  goals[slot] = true;
  return true;
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawZones(ctx: CanvasRenderingContext2D, c: Colors, goals: readonly boolean[]): void {
  ctx.fillStyle = c.road;
  ctx.fillRect(0, ROW_ROAD_TOP * CELL, CANVAS_W, (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL);
  ctx.fillStyle = c.river;
  ctx.fillRect(0, ROW_RIVER_TOP * CELL, CANVAS_W, (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL);
  ctx.fillStyle = c.safe;
  ctx.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);
  ctx.fillRect(0, ROW_START * CELL, CANVAS_W, CELL);
  ctx.fillStyle = c.goalRow;
  ctx.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);

  GOAL_COLS.forEach((col, i) => {
    const x = col * CELL;
    const w = GOAL_WIDTH * CELL;
    ctx.fillStyle = c.goal;
    ctx.fillRect(x, ROW_GOALS * CELL, w, CELL);
    ctx.strokeStyle = c.goalBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, ROW_GOALS * CELL + 1, w - 2, CELL - 2);
    if (goals[i]) drawFrogShape(ctx, c, x + w / 2, ROW_GOALS * CELL + CELL / 2, "up", false);
  });
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  c: Colors,
  x: number,
  y: number,
  w: number,
  color: string,
): void {
  ctx.fillStyle = c.wheel;
  for (const wx of [x + 8, x + w - 8]) {
    for (const wy of [y + 7, y + CELL - 7]) {
      ctx.beginPath();
      ctx.arc(wx, wy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y + 8, w - 6, CELL - 16);
}

function drawTruck(
  ctx: CanvasRenderingContext2D,
  c: Colors,
  x: number,
  y: number,
  w: number,
  dir: 1 | -1,
): void {
  const cabW = 26;
  ctx.fillStyle = c.truck;
  ctx.fillRect(x + 3, y + 6, w - 6, CELL - 12);
  ctx.fillStyle = c.cab;
  ctx.fillRect(dir === 1 ? x + w - 3 - cabW : x + 3, y + 8, cabW, CELL - 16);
}

function drawLog(ctx: CanvasRenderingContext2D, c: Colors, x: number, y: number, w: number): void {
  ctx.fillStyle = c.log;
  ctx.fillRect(x + 1, y + 6, w - 2, CELL - 12);
  ctx.strokeStyle = c.logLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const ly of [y + 14, y + CELL - 14]) {
    ctx.moveTo(x + 6, ly);
    ctx.lineTo(x + w - 6, ly);
  }
  ctx.stroke();
}

// One shell per cell of the group; submerged groups fade to an outline.
function drawTurtles(
  ctx: CanvasRenderingContext2D,
  c: Colors,
  e: Entity,
  x: number,
  y: number,
): void {
  ctx.save();
  for (let i = 0; i < e.width; i++) {
    const cx = x + i * CELL + CELL / 2;
    const cy = y + CELL / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    if (e.submerged) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = c.turtle;
      ctx.lineWidth = 2;
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = c.turtle;
    ctx.fill();
    ctx.strokeStyle = c.shell;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLanes(ctx: CanvasRenderingContext2D, c: Colors, lanes: readonly Lane[]): void {
  const carColors = [c.carA, c.carB, c.carC];
  for (const lane of lanes) {
    const y = lane.row * CELL;
    for (const e of lane.entities) {
      const x = e.col * CELL;
      const w = e.width * CELL;
      if (e.type === "car") drawCar(ctx, c, x, y, w, carColors[lane.row % carColors.length]);
      else if (e.type === "truck") drawTruck(ctx, c, x, y, w, lane.dir);
      else if (e.type === "log") drawLog(ctx, c, x, y, w);
      else drawTurtles(ctx, c, e, x, y);
    }
  }
}

// A 28×24 body with two eyes, facing `dir`; the legs stretch out during a hop.
function drawFrogShape(
  ctx: CanvasRenderingContext2D,
  c: Colors,
  cx: number,
  cy: number,
  dir: Direction,
  hopping: boolean,
): void {
  const legX = hopping ? 18 : 14;
  const legY = hopping ? 13 : 9;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(DIR_ANGLES[dir]);
  ctx.strokeStyle = c.frogLegs;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const s of [1, -1]) {
    ctx.moveTo(s * 8, -6);
    ctx.lineTo(s * legX, -legY);
    ctx.moveTo(s * 8, 6);
    ctx.lineTo(s * legX, legY);
  }
  ctx.stroke();
  ctx.fillStyle = c.frog;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [1, -1]) {
    ctx.fillStyle = c.eye;
    ctx.beginPath();
    ctx.arc(s * 6, -7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.pupil;
    ctx.beginPath();
    ctx.arc(s * 6, -8, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFrog(ctx: CanvasRenderingContext2D, c: Colors, frog: Frog, dir: Direction): void {
  const t = frog.animating ? frog.animT / HOP_MS : 0;
  const col = frog.col + (frog.targetCol - frog.col) * t;
  const row = frog.row + (frog.targetRow - frog.row) * t;
  drawFrogShape(ctx, c, col * CELL + CELL / 2, row * CELL + CELL / 2, dir, frog.animating);
}

function drawTimeBar(ctx: CanvasRenderingContext2D, c: Colors, fraction: number): void {
  ctx.fillStyle = fraction > 0.5 ? c.timeHigh : fraction > 0.2 ? c.timeMid : c.timeLow;
  ctx.fillRect(0, 0, CANVAS_W * Math.max(0, fraction), TIME_BAR_H);
}

// Score, level and life icons sit on the middle safe row, clear of every lane.
function drawHud(
  ctx: CanvasRenderingContext2D,
  c: Colors,
  score: number,
  level: number,
  lives: number,
): void {
  const y = ROW_SAFE_MID * CELL + CELL / 2;
  ctx.fillStyle = c.hud;
  ctx.font = "16px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(String(score), 10, y);
  ctx.textAlign = "center";
  ctx.fillText(`LV ${level}`, CANVAS_W / 2, y);
  ctx.fillStyle = c.frog;
  for (let i = 0; i < lives; i++) {
    ctx.beginPath();
    ctx.arc(CANVAS_W - 18 - i * 22, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Engine ────────────────────────────────────────────────────────────────────
const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

const KEY_DIRS: Readonly<Record<string, Direction>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, [contenteditable]"))
  );
}

export const createFrogger: EngineFactory = (canvas, cb) => {
  const ctx = setupCanvas(canvas);
  let colors: Colors = froggerSkins[DEFAULT_SKIN].dark.colors;

  // Game state
  let phase: EnginePhase = "ready";
  let lanes: Lane[] = [];
  let frog = startFrog();
  let facing: Direction = "up";
  let pendingDir: Direction | null = null;
  let goals: boolean[] = [];
  let bestRow: number = ROW_START; // highest row reached this round, for the row points
  let score = 0;
  let level = 1;
  let lives = START_LIVES;
  let timeLeft = 0; // ms

  // Loop and lifecycle
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;
  let lastSnapshot: EngineSnapshot | null = null;

  // A fresh run: level 1, full lives, empty slots, frog on the start row.
  function initRun() {
    lanes = buildLanes(1);
    frog = startFrog();
    facing = "up";
    pendingDir = null;
    goals = GOAL_COLS.map(() => false);
    bestRow = ROW_START;
    score = 0;
    level = 1;
    lives = START_LIVES;
    timeLeft = roundTimeMs(1);
  }

  // ── Snapshot ──
  function snapshot(): EngineSnapshot {
    return {
      phase,
      score,
      level,
      lives,
      extras: [{ key: "time", label: "TIME", value: `${Math.ceil(timeLeft / 1000)}s` }],
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

  function killFrog() {
    if (phase !== "playing") return;
    lives--;
    if (lives === 0) phase = "over";
    else nextFrog();
  }

  // All five slots filled: next level, faster lanes, shorter timer.
  function completeRound() {
    score += POINTS_PER_ROUND;
    goals = GOAL_COLS.map(() => false);
    bestRow = ROW_START;
    level++;
    lanes = buildLanes(level);
    nextFrog();
  }

  // Back to the start row with a full timer, for the next frog.
  function nextFrog() {
    frog = startFrog();
    facing = "up";
    pendingDir = null;
    timeLeft = roundTimeMs(level);
  }

  function resolveGoal() {
    if (!checkGoal(frog, goals)) {
      killFrog();
      return;
    }
    score += POINTS_PER_GOAL + Math.floor(timeLeft / 1000) * POINTS_PER_SECOND_LEFT;
    if (goals.every(Boolean)) completeRound();
    else nextFrog();
  }

  // Road hits and river support apply every frame, not only on landing: traffic
  // can reach a waiting frog, and a turtle can sink under one.
  function checkHazards(dt: number) {
    if (frog.animating) return;
    if (checkRoadCollision(frog, lanes)) {
      killFrog();
      return;
    }
    if (!inRiver(frog.row)) return;
    const lane = lanes.find((l) => l.row === frog.row);
    if (!lane || !getSupport(frog, lanes)) {
      killFrog();
      return;
    }
    frog.col += laneDelta(lane, dt);
    frog.targetCol = frog.col;
    if (frog.col + 0.5 < 0 || frog.col + 0.5 >= COLS) killFrog();
  }

  // ── Update ──
  function startHop(dir: Direction) {
    const v = DIR_VECTORS[dir];
    const targetCol = frog.col + v.col;
    const targetRow = frog.row + v.row;
    facing = dir;
    if (targetCol < 0 || targetCol > COLS - 1 || targetRow > ROWS - 1) return;
    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
  }

  function finishHop() {
    frog.animating = false;
    frog.row = frog.targetRow;
    // Logs and turtles leave the frog between cells; it snaps back to the grid on land.
    frog.col = inRiver(frog.row) ? frog.targetCol : Math.round(frog.targetCol);
    frog.targetCol = frog.col;
    if (frog.row < bestRow) {
      score += (bestRow - frog.row) * POINTS_PER_ROW;
      bestRow = frog.row;
    }
    if (frog.row === ROW_GOALS) resolveGoal();
  }

  function update(dt: number) {
    for (const lane of lanes) advanceLane(lane, dt);

    if (!frog.animating && pendingDir) {
      startHop(pendingDir);
      pendingDir = null;
    }
    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= HOP_MS) finishHop();
    }
    checkHazards(dt);

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      killFrog();
    }
  }

  // ── Draw: no overlays, React draws those ──
  function draw() {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(BOARD_X, BOARD_Y);
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_W, CANVAS_H);
    ctx.clip();
    drawZones(ctx, colors, goals);
    drawLanes(ctx, colors, lanes);
    drawHud(ctx, colors, score, level, lives);
    drawFrog(ctx, colors, frog, facing);
    drawTimeBar(ctx, colors, timeLeft / roundTimeMs(level));
    ctx.restore();
  }

  // ── Loop ──
  function frame(ts: number) {
    if (destroyed) return;
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    // Paused and over keep the last frame frozen: no updates, same draw.
    if (phase === "playing") update(dtMs);
    draw();
    emit();
    rafId = requestAnimationFrame(frame);
  }

  // ── Phase transitions ──
  // start() plays the board shown on the ready screen.
  function start() {
    if (phase !== "ready") return;
    pendingDir = null;
    phase = "playing";
    lastTime = null;
    emit();
  }

  function pause() {
    if (phase !== "playing") return;
    pendingDir = null;
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
    phase = "over";
    emit();
  }

  function restart() {
    initRun();
    phase = "playing";
    lastTime = null;
    emit();
  }

  // ── Input listeners ──
  // Shared by the keyboard listener and press() (touch pad).
  function handleKeyDown(code: string, repeat: boolean) {
    const isPauseKey = code === "KeyP" || code === "Escape";
    switch (phase) {
      case "ready":
        if (code === "Space" && !repeat) start();
        break;
      case "playing": {
        const next = KEY_DIRS[code];
        if (next && !repeat) pendingDir = next;
        else if (isPauseKey && !repeat) pause();
        break;
      }
      case "paused":
        if (isPauseKey && !repeat) resume();
        break;
      case "over":
        break;
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isEditable(e.target)) return;
    if (phase !== "over" && GAME_KEYS.has(e.code)) e.preventDefault();
    handleKeyDown(e.code, e.repeat);
  }

  // Frogger acts on key down only, so a pad release has nothing to undo.
  function press(code: PadCode, down: boolean) {
    if (destroyed || !down) return;
    handleKeyDown(code, false);
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
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("blur", pause);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  // Read by the next frame, so a change never touches the run. The engine shipped
  // with no shadowBlur, and Neon + dark must look as it did, so there is no reference
  // glow for `p.glow` to scale.
  function setPalette(p: SkinPalette<string>) {
    colors = p.colors as Colors;
  }

  // Ready screen: the first traffic and the frog on the start row.
  initRun();
  emit();
  rafId = requestAnimationFrame(frame);

  return { start, pause, resume, end, restart, destroy, press, setPalette };
};
