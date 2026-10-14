// Arkanoid engine: a typed port of references/started-games/04-arkanoid/game.js
// and assets/spritesheet.js. Helpers are pure and take what they need; every
// piece of mutable game state lives in the createArkanoid closure.

import { LEVELS, type BlockColor } from "@/lib/engines/arkanoid-levels";
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
const PADDLE_SPEED = 400; // px/s
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_Y = 560;
const BALL_W = 16;
const BALL_H = 16;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
const BLOCKS_ORIGIN_Y = 80;
const LIVES = 3;
const BLOCK_POINTS = 10;
const EXPLOSION_DURATION = 150; // ms
const EXPLOSION_FRAME_COUNT = 4;
const MAX_DT = 50; // ms

// ── Sprites (source rects verbatim from spritesheet.js) ───────────────────────
const SPRITESHEET_SRC = "/games/arkanoid/spritesheet-breakout.png";

// ── Sounds ────────────────────────────────────────────────────────────────────
const BOUNCE_SRC = "/games/arkanoid/ball-bounce.mp3";
const BREAK_SRC = "/games/arkanoid/break-sound.mp3";

type SoundName = "bounce" | "break";
const SOUND_SRCS: Readonly<Record<SoundName, string>> = { bounce: BOUNCE_SRC, break: BREAK_SRC };

type Rect = { x: number; y: number; w: number; h: number };
type SpriteRect = { sx: number; sy: number; sw: number; sh: number };

// The four explosion frames of one brick colour, laid out left to right.
function explosionRow(sy: number): readonly SpriteRect[] {
  return [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));
}

const EXPLOSION_FRAMES: Readonly<Record<BlockColor, readonly SpriteRect[]>> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176), // gray reuses the red frames
};

const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
} as const satisfies {
  paddle: SpriteRect;
  ball: SpriteRect;
  blocks: Record<BlockColor, SpriteRect>;
};

// ── Entities ──────────────────────────────────────────────────────────────────
type Paddle = Rect;
type Ball = Rect & { vx: number; vy: number };
type Block = Rect & { color: BlockColor; alive: boolean };
type Explosion = Rect & { color: BlockColor; elapsed: number };

// Bricks of level n (1-based), placed on the grid.
function buildBlocks(n: number): Block[] {
  return LEVELS[n - 1].blocks.map((b) => ({
    x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
    y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
    w: BLOCK_W,
    h: BLOCK_H,
    color: b.color,
    alive: true,
  }));
}

function collideAABB(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sp: SpriteRect,
  r: Rect,
): void {
  ctx.drawImage(img, sp.sx, sp.sy, sp.sw, sp.sh, r.x, r.y, r.w, r.h);
}

// Full frame: background, then (once the spritesheet loaded) bricks,
// explosions, paddle and ball. No HUD or overlays: React draws those.
function drawScene(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  blocks: readonly Block[],
  explosions: readonly Explosion[],
  paddle: Paddle,
  ball: Ball,
): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (!img) return;

  for (const block of blocks) {
    if (block.alive) drawSprite(ctx, img, SPRITES.blocks[block.color], block);
  }
  for (const exp of explosions) {
    const frameIndex = Math.min(
      Math.floor((exp.elapsed / EXPLOSION_DURATION) * EXPLOSION_FRAME_COUNT),
      EXPLOSION_FRAME_COUNT - 1,
    );
    drawSprite(ctx, img, EXPLOSION_FRAMES[exp.color][frameIndex], exp);
  }
  drawSprite(ctx, img, SPRITES.paddle, paddle);
  drawSprite(ctx, img, SPRITES.ball, ball);
}

// ── Engine ────────────────────────────────────────────────────────────────────
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "Space"]);

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, [contenteditable]"))
  );
}

export const createArkanoid: EngineFactory = (canvas, cb) => {
  const ctx = setupCanvas(canvas);

  // Spritesheet: only the background is drawn until it loads
  let img: HTMLImageElement | null = null;
  const sheet = new Image();
  sheet.onload = () => {
    if (!destroyed) img = sheet;
  };
  sheet.src = SPRITESHEET_SRC;

  // Sounds: the bytes are fetched now, but the AudioContext is only created
  // inside a user gesture (start / resume / restart) to satisfy the autoplay
  // policy. A missing or undecodable file leaves that sound silent.
  let audio: AudioContext | null = null;
  const bytes: Record<SoundName, ArrayBuffer | null> = { bounce: null, break: null };
  const buffers: Record<SoundName, AudioBuffer | null> = { bounce: null, break: null };
  let muted = false;
  const fetches = new AbortController();
  for (const name of Object.keys(SOUND_SRCS) as SoundName[]) {
    fetch(SOUND_SRCS[name], { signal: fetches.signal })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((data) => {
        if (destroyed || !data) return;
        bytes[name] = data;
        decode(name);
      })
      .catch(() => {});
  }

  // Game state
  let phase: EnginePhase = "ready";
  const paddle: Paddle = { x: (W - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball: Ball = { x: 0, y: 0, w: BALL_W, h: BALL_H, vx: 0, vy: 0 };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let score = 0;
  let lives = LIVES;
  let level = 1;
  const keys = { ArrowLeft: false, ArrowRight: false };

  // Loop and lifecycle
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;
  let lastSnapshot: EngineSnapshot | null = null;

  // Places the ball centred on top of the paddle and launches it up-right.
  function initBall() {
    const speed = LEVELS[level - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  // The paddle keeps its position across levels.
  function loadLevel(n: number) {
    level = n;
    blocks = buildBlocks(n);
    explosions = [];
    initBall();
  }

  function clearKeys() {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
  }

  function initRun() {
    score = 0;
    lives = LIVES;
    paddle.x = (W - PADDLE_W) / 2;
    loadLevel(1);
    clearKeys();
  }

  // Decodes a fetched sound once both the bytes and the context exist.
  function decode(name: SoundName) {
    const data = bytes[name];
    if (!audio || !data) return;
    bytes[name] = null; // decodeAudioData detaches the buffer
    audio
      .decodeAudioData(data)
      .then((buffer) => {
        if (!destroyed) buffers[name] = buffer;
      })
      .catch(() => {});
  }

  // Called from user gestures only: creates the context the first time and
  // resumes it if the browser suspended it.
  function ensureAudio() {
    if (destroyed) return;
    if (!audio) {
      try {
        audio = new AudioContext();
      } catch {
        return; // no Web Audio: the game stays silent
      }
      decode("bounce");
      decode("break");
    } else if (audio.state === "suspended") {
      audio.resume().catch(() => {});
    }
  }

  // One source per hit, so overlapping sounds are allowed as in the reference.
  function play(name: SoundName) {
    const buffer = buffers[name];
    if (muted || !audio || !buffer) return;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.start();
  }

  function setMuted(m: boolean) {
    muted = m;
  }

  function aliveBlocks(): number {
    return blocks.reduce((n, b) => (b.alive ? n + 1 : n), 0);
  }

  // ── Snapshot ──
  function snapshot(): EngineSnapshot {
    return {
      phase,
      score,
      level,
      lives,
      extras: [{ key: "blocks", label: "BLOCKS", value: String(aliveBlocks()) }],
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
    clearKeys();
  }

  // ── Update (verbatim order from the reference's update(dt)) ──
  function updatePlaying(dt: number) {
    // Paddle
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Ball movement
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall bounces (left, right, top)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      play("bounce");
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      play("bounce");
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      play("bounce");
    }

    // Paddle bounce: the angle never changes
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      play("bounce");
    }

    // Block collisions: one block per frame
    for (const block of blocks) {
      if (!block.alive || !collideAABB(ball, block)) continue;
      block.alive = false;
      explosions.push({ x: block.x, y: block.y, w: block.w, h: block.h, color: block.color, elapsed: 0 });
      score += BLOCK_POINTS;
      ball.vy = -ball.vy;
      play("break");
      if (blocks.every((b) => !b.alive)) {
        if (level < LEVELS.length) {
          loadLevel(level + 1);
        } else {
          endRun();
          return;
        }
      }
      break;
    }

    // Explosions
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Ball lost
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        endRun();
      } else {
        initBall();
      }
    }
  }

  // ── Loop ──
  function frame(ts: number) {
    if (destroyed) return;
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    // Paused and over keep the last frame frozen: no updates, same draw.
    if (phase === "playing") updatePlaying(dtMs / 1000);
    drawScene(ctx, img, blocks, explosions, paddle, ball);
    emit();
    rafId = requestAnimationFrame(frame);
  }

  // ── Phase transitions ──
  function start() {
    if (phase !== "ready") return;
    ensureAudio();
    initRun();
    phase = "playing";
    lastTime = null;
    emit();
  }

  function pause() {
    if (phase !== "playing") return;
    clearKeys();
    phase = "paused";
    emit();
  }

  function resume() {
    if (phase !== "paused") return;
    ensureAudio();
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
    ensureAudio();
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
      case "playing":
        if (e.code === "ArrowLeft" || e.code === "ArrowRight") keys[e.code] = true;
        else if (isPauseKey && !e.repeat) pause();
        break;
      case "paused":
        if (isPauseKey && !e.repeat) resume();
        break;
      case "over":
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") keys[e.code] = false;
  }

  // Centres the paddle under the pointer, mapped to logical coordinates.
  function onMouseMove(e: MouseEvent) {
    if (phase !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = (e.clientX - rect.left) * (W / rect.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
  }

  function onVisibilityChange() {
    if (document.hidden) pause();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("mousemove", onMouseMove);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(rafId);
    sheet.onload = null;
    fetches.abort();
    audio?.close().catch(() => {});
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", pause);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.removeEventListener("mousemove", onMouseMove);
  }

  // Ready screen: level 1 with the ball resting on the centred paddle.
  loadLevel(1);
  emit();
  rafId = requestAnimationFrame(frame);

  return { start, pause, resume, end, restart, destroy, setMuted };
};
