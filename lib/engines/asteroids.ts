// Asteroids engine: a typed port of references/started-games/02-asteroids/game.js.
// Classes are stateless definitions; every piece of mutable game state lives in
// the createAsteroids closure.

import type { EngineFactory, EnginePhase, EngineSnapshot } from "@/lib/engines/types";

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

// ── Utils ─────────────────────────────────────────────────────────────────────
type Point = { x: number; y: number };
type Keys = Record<string, boolean>;

const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// ── Constants ─────────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;
const POWERUP_GUARANTEED_KILLS = 5;

const RADII = [0, 16, 30, 50]; // by size 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // base speed by size
const POINTS = [0, 100, 50, 20]; // points by size

const BULLET_SPEED = 520;
const BULLET_TTL = 1.1;
const SHIP_ROT = 3.5; // rad/s
const SHIP_THRUST = 260; // px/s²
const SHIP_DRAG = 0.987;
const SHIP_INVINCIBLE = 3;
const SHIP_COLLISION_FUDGE = 0.82;
const RESPAWN_WAIT = 2;
const START_LIVES = 3;
const MAX_DT = 0.05;

// Neon palette, copied from the :root tokens in app/globals.css.
const CYAN = "#00f5ff";
const YELLOW = "#f5ff00";
const MAGENTA = "#ff006e";
const GLOW = 10;

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = BULLET_TTL;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * BULLET_SPEED;
    this.vy = Math.sin(angle) * BULLET_SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  verts: [number, number][] = [];
  dead = false;

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Irregular polygon
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = YELLOW;
    ctx.shadowColor = YELLOW;
    ctx.shadowBlur = GLOW;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  age = 0; // drives the pulse, so a frozen frame stays still
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    this.age += dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Blink during the last two seconds of its life
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin((this.age * 1000) / 150) * 0.15;
    ctx.save();
    ctx.shadowColor = MAGENTA;
    ctx.shadowBlur = GLOW;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = MAGENTA;
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = MAGENTA;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = SHIP_INVINCIBLE;
  shootCooldown = 0;
  tripleShot = 0;
  dead = false;

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = SHIP_INVINCIBLE;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Keys) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    if (keys.ArrowLeft) this.angle -= SHIP_ROT * dt;
    if (keys.ArrowRight) this.angle += SHIP_ROT * dt;

    this.thrusting = !!keys.ArrowUp;
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * SHIP_THRUST * dt;
      this.vy += Math.sin(this.angle) * SHIP_THRUST * dt;
    }

    this.vx *= SHIP_DRAG;
    this.vy *= SHIP_DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    // Blink while invincible after a respawn
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = CYAN;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = GLOW;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Classic silhouette: a triangle with a rear notch
    ctx.beginPath();
    ctx.moveTo(20, 0); // nose
    ctx.lineTo(-12, -9); // left wing
    ctx.lineTo(-7, 0); // rear notch
    ctx.lineTo(-12, 9); // right wing
    ctx.closePath();
    ctx.stroke();

    // Thrust flame
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.globalAlpha = 0.85;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Particle (explosion) ──────────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  color: string;
  dead = false;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.ttl / this.life);
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = GLOW / 2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Engine ────────────────────────────────────────────────────────────────────
const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
const SAFE_DIST = 130;

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, [contenteditable]"))
  );
}

export const createAsteroids: EngineFactory = (canvas, cb) => {
  const ctx = setupCanvas(canvas);

  // Input
  let keys: Keys = {};
  let justPressed: Keys = {};

  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return val;
  }

  function clearInput() {
    keys = {};
    justPressed = {};
  }

  // Game state
  let phase: EnginePhase = "ready";
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  // Loop and lifecycle
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;
  let lastSnapshot: EngineSnapshot | null = null;

  function spawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initRun() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = START_LIVES;
    level = 1;
    deadTimer = 0;
    spawnAsteroids(4);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
  }

  function killShip() {
    explode(ship.x, ship.y, 14, CYAN);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      phase = "over";
      clearInput();
    } else {
      deadTimer = RESPAWN_WAIT;
    }
  }

  // ── Snapshot ──
  function snapshot(): EngineSnapshot {
    return {
      phase,
      score,
      lives,
      level,
      tripleShot: ship.tripleShot > 0 ? Math.round(ship.tripleShot * 10) / 10 : 0,
    };
  }

  // Notifies React only when a field actually changed.
  function emit() {
    const next = snapshot();
    const prev = lastSnapshot;
    if (
      prev &&
      prev.phase === next.phase &&
      prev.score === next.score &&
      prev.lives === next.lives &&
      prev.level === next.level &&
      prev.tripleShot === next.tripleShot
    ) {
      return;
    }
    lastSnapshot = next;
    cb.onChange(next);
  }

  // ── Update ──
  function updateParticles(dt: number) {
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
  }

  // Attract mode: asteroids drift, no ship.
  function updateReady(dt: number) {
    asteroids.forEach((a) => a.update(dt));
    updateParticles(dt);
  }

  function updatePlaying(dt: number) {
    // Waiting to respawn ("dead"): reported to React as "playing"
    if (ship.dead) {
      deadTimer -= dt;
      updateParticles(dt);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) ship.reset();
      return;
    }

    if (pressed("Space")) bullets.push(...ship.tryShoot());

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    updateParticles(dt);
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5, YELLOW);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= POWERUP_GUARANTEED_KILLS;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Ship vs asteroid
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * SHIP_COLLISION_FUDGE) {
          killShip();
          break;
        }
      }
    }

    // Level cleared
    if (phase === "playing" && asteroids.length === 0) nextLevel();
  }

  // ── Draw ──
  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerUps.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    if (phase !== "ready") ship.draw(ctx);
  }

  // ── Loop ──
  function frame(ts: number) {
    if (destroyed) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    // Paused and over keep the last frame frozen: no updates, same draw.
    if (phase === "ready") updateReady(dt);
    else if (phase === "playing") updatePlaying(dt);
    draw();
    emit();
    rafId = requestAnimationFrame(frame);
  }

  // ── Phase transitions ──
  function start() {
    if (phase !== "ready") return;
    ship.reset();
    clearInput();
    phase = "playing";
    lastTime = null;
    emit();
  }

  function pause() {
    if (phase !== "playing") return;
    // Clearing keys avoids a key held during blur staying stuck
    clearInput();
    ship.thrusting = false;
    phase = "paused";
    emit();
  }

  function resume() {
    if (phase !== "paused") return;
    clearInput();
    phase = "playing";
    lastTime = null;
    emit();
  }

  function end() {
    if (phase === "over") return;
    clearInput();
    ship.thrusting = false;
    phase = "over";
    emit();
  }

  function restart() {
    initRun();
    clearInput();
    ship.reset();
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
        if (isPauseKey) {
          if (!e.repeat) pause();
          break;
        }
        if (!keys[e.code]) justPressed[e.code] = true;
        keys[e.code] = true;
        break;
      case "paused":
        if (isPauseKey && !e.repeat) resume();
        break;
      case "over":
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (isEditable(e.target)) return;
    keys[e.code] = false;
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

  initRun();
  emit();
  rafId = requestAnimationFrame(frame);

  return { start, pause, resume, end, restart, destroy };
};
