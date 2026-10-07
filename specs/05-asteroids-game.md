# SPEC 05 — Playable Asteroids game

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-07
> **Objective:** Port the reference Asteroids game (`references/started-games/02-asteroids/`) to a typed canvas engine and make it the real game at `/games/asteroids/play`, driving the existing React HUD and game-over modal.

## Why this spec exists

Every game on the play page is simulated today. `components/game-player.tsx` ticks a fake score and animates decorative CSS enemies. The reference Asteroids is a finished vanilla-JS canvas game, but it uses globals, `window` listeners that are never removed, a fixed canvas HUD and Spanish text. That does not survive React mounting, unmounting and Strict Mode. This spec sets up the pattern the next games (Tetris, Arkanoid) will follow:

- an engine factory per game, with no globals;
- a canvas host component that owns the engine's lifecycle;
- a small callback contract that lets React render the HUD, pause and game-over.

## Scope

**In:**

- Rename the catalog entry ROCKS to ASTEROIDS (`id: "asteroids"`) with copy that describes the real game. Update the `gameId` that references it in `lib/home-content.ts`.
- Port `game.js` to TypeScript as an engine factory with no module-level mutable state. The port covers every class and mechanic: `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, levels, respawn and the 3x power-up. Gameplay constants stay identical.
- A shared engine contract (`GameEngine`, `EngineFactory`, `EngineSnapshot`) and a registry that maps a game id to its factory.
- A client component that mounts a `<canvas>` inside `.crt-screen`, creates the engine on mount and destroys it on unmount.
- `GamePlayer` uses the real engine when the game id has one. Otherwise it keeps the current simulation unchanged.
- HUD, ready screen, pause overlay and game over are all React. The canvas draws only the playfield. The canvas HUD (`SCORE`, `NIVEL`, life icons, 3x timer) and the canvas GAME OVER overlay are removed.
- A ready screen ("PRESS SPACE TO START", plus the controls). It shows "KEYBOARD REQUIRED" on coarse-pointer devices.
- Pause through the PAUSE button, `P` or `Esc`. The game also pauses automatically on window blur or when the tab is hidden.
- END and PLAY AGAIN control the real engine.
- A neon palette on the canvas, using the site's colors with glow.
- A "3X" HUD stat with the remaining seconds, shown only while triple shot is active.
- Crisp rendering on HiDPI screens (backing store scaled by `devicePixelRatio`) at a fixed 800×600 logical resolution.

**Out of scope (for future specs):**

- Persisting scores. SAVE SCORE stays cosmetic, exactly as today. Supabase scores, RLS and real leaderboards get their own spec.
- Touch / on-screen controls.
- A redirect from `/games/rocks`. It becomes a 404.
- Real engines for any other game (Tetris, Arkanoid, …).
- Sound.
- Gameplay changes: UFOs, hyperspace, difficulty tuning or new power-ups.
- The detail page's hardcoded `KEYBOARD / TOUCH` tag and difficulty stars.
- Automated tests (no test runner is configured).

## Data model

No persistent data. The catalog entry changes and new runtime types appear.

### Catalog entry (`lib/games.ts`)

```ts
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Split asteroids into dust in zero gravity.",
  long: "Your triangular ship drifts through a wrap-around asteroid field. Rotate, thrust and fire to split big rocks into medium and small fragments. Grab the 3X core for a few seconds of triple shot, and clear the field to warp to the next level.",
  cat: "SHOOTER",
  cover: "cover-rocas",   // CSS class kept as is
  color: "yellow",
  best: 41200,
  plays: "15.6K",
}
```

`lib/home-content.ts`: `gameId: "rocks"` → `gameId: "asteroids"`.

### Engine contract (`lib/engines/types.ts`)

```ts
export type EnginePhase = "ready" | "playing" | "paused" | "over";

export type EngineSnapshot = {
  phase: EnginePhase;
  score: number;
  lives: number;
  level: number;
  tripleShot: number; // remaining seconds, rounded to 0.1; 0 when inactive
};

export type EngineCallbacks = {
  onChange: (s: EngineSnapshot) => void; // only when a field actually changed, never every frame
};

export interface GameEngine {
  start(): void; // ready → playing
  pause(): void; // playing → paused (no-op otherwise)
  resume(): void; // paused → playing (no-op otherwise)
  end(): void; // ready | playing | paused → over
  restart(): void; // any → playing, with a fresh run (skips the ready screen)
  destroy(): void; // cancels rAF and removes every listener; idempotent
}

export type EngineFactory = (canvas: HTMLCanvasElement, cb: EngineCallbacks) => GameEngine;
```

The engine's internal "dead" state (2 s respawn wait) is reported as `phase: "playing"`. React does not need to tell it apart.

### Registry (`lib/engines/index.ts`)

```ts
export const ENGINES: Partial<Record<string, EngineFactory>> = { asteroids: createAsteroids };
```

### Asteroids engine (`lib/engines/asteroids.ts`)

```ts
export const createAsteroids: EngineFactory;
```

- Logical size `W = 800`, `H = 600`. The canvas backing store is `800·dpr × 600·dpr` with `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
- These constants are copied from the reference and do not change: `RADII`, `SPEEDS`, `POINTS` (20/50/100), bullet speed 520 and TTL 1.1 s, ship rotation 3.5 rad/s, thrust 260, drag 0.987, invincibility 3 s, respawn wait 2 s, 3 lives, `POWERUP_DROP_CHANCE` 0.15, `POWERUP_DURATION` 5, `POWERUP_TTL` 12, `TRIPLE_SPREAD` 0.18, guaranteed drop after 5 kills, at most one power-up per level, 4 asteroids on level 1 and `3 + level` after that, `dt` capped at 50 ms. Ship collision keeps the `0.82` fudge factor.
- All state (entities, `keys`, `justPressed`, score, …) lives in the factory closure. Each class receives `ctx` or the state it needs instead of reading globals.
- Comments are in English.

Neon palette (hex values copied from the `:root` tokens in `app/globals.css`):

| Element                                 | Color             |
| --------------------------------------- | ----------------- |
| Ship, thrust flame, bullets             | cyan `#00f5ff`    |
| Asteroids, asteroid explosion particles | yellow `#f5ff00`  |
| Power-up diamond and "3x" label         | magenta `#ff006e` |
| Ship explosion particles                | cyan `#00f5ff`    |

Strokes use `shadowBlur` with the same color for the glow. The background stays `#000`.

## Behavior

### Input (engine)

- `keydown` / `keyup` listeners on `window` are added in the factory and removed in `destroy()`.
- Events whose target is an `input`, `textarea` or `[contenteditable]` are ignored. This lets the initials input in the modal accept typing.
- While the phase is `ready`, `playing` or `paused`, the engine calls `preventDefault()` on `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` and `Space`, so the page does not scroll.
- `ready`: `Space` → `start()`.
- `playing`: arrows and `Space` as in the reference. `P` / `Escape` → `pause()`.
- `paused`: `P` / `Escape` → `resume()`.
- `over`: no keys are handled. The reference's "Space restarts" is removed; PLAY AGAIN restarts.
- `window` `blur` and `document` `visibilitychange` (hidden) → `pause()`.
- `keys` is cleared on pause, so a key held during blur does not stay stuck.

### Loop (engine)

- A single `requestAnimationFrame` loop starts in the factory and draws in every phase.
- In `ready`, asteroids drift (attract mode) with no ship. In `paused` and `over`, the last frame stays frozen.
- On `resume()` / `start()` / `restart()`, `lastTime` resets, so `dt` does not jump.
- When the last life is lost, the phase becomes `over` and `onChange` fires.

### Player (`components/game-player.tsx`)

When `ENGINES[game.id]` exists:

- The fake `.game-arena` and the score-simulation `useEffect` are not rendered or run. `<GameCanvas>` is rendered inside `.crt-screen`.
- HUD values come from the latest `EngineSnapshot`. Lives show as `♥` repeated. Level is zero-padded to two digits. The "3X" stat (`hud-stat`, value like `4.2s`) appears only when `tripleShot > 0`.
- Overlays use the existing `.crt-content`:
  - `ready`: "PRESS SPACE TO START" and a controls line `← → ROTATE · ↑ THRUST · SPACE FIRE · P PAUSE`. On `(pointer: coarse)` (CSS media query, no JS detection) it shows "KEYBOARD REQUIRED" instead.
  - `paused`: the existing PAUSED overlay, with the subtitle "PRESS P OR RESUME TO CONTINUE".
- PAUSE / RESUME button → `engine.pause()` / `engine.resume()`. Its label follows `phase`.
- END button → `engine.end()`. The game-over modal opens when `phase === "over"`.
- PLAY AGAIN → `engine.restart()` and resets `saved`.
- HUD buttons call `e.currentTarget.blur()` after a click, so the next `Space` fires instead of re-clicking the button.
- The `.crt-bottom` right slot shows the controls legend instead of `LOAD · 1MB`.
- SAVE SCORE and the initials input behave exactly as today (cosmetic).

When the game has no engine, `GamePlayer` behaves exactly as it does today.

### Canvas host (`components/game-canvas.tsx`)

- `"use client"`. Props: `factory: EngineFactory`, `onChange: (s: EngineSnapshot) => void`, and a ref-style handle so `GamePlayer` can call `pause/resume/end/restart`.
- Creates the engine in `useEffect` and calls `destroy()` in the cleanup. This keeps it correct under Strict Mode's double mount: only one loop and one set of listeners survive.
- `onChange` is read through a ref, so a new callback identity never recreates the engine.
- The canvas fills `.crt-screen` (`width: 100%; height: 100%; display: block`). `.crt-screen` is already 4:3, the same as 800×600.

## Files

| File                         | Kind        | Purpose                                                                                     |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `lib/games.ts`               | modified    | ROCKS → ASTEROIDS entry with the new id and copy                                            |
| `lib/home-content.ts`        | modified    | `gameId: "asteroids"`                                                                       |
| `lib/engines/types.ts`       | new         | `EnginePhase`, `EngineSnapshot`, `EngineCallbacks`, `GameEngine`, `EngineFactory`           |
| `lib/engines/asteroids.ts`   | new         | `createAsteroids` (the port)                                                                |
| `lib/engines/index.ts`       | new         | `ENGINES` registry                                                                          |
| `components/game-canvas.tsx` | new, client | Canvas and engine lifecycle                                                                 |
| `components/game-player.tsx` | modified    | Real engine branch: HUD from snapshot, ready and pause overlays, buttons wired, 3X stat     |
| `app/globals.css`            | modified    | `.game-canvas` sizing, ready-overlay styles, `(pointer: coarse)` swap for the keyboard hint |

`references/started-games/02-asteroids/` is read only and is not modified.

## Implementation plan

Use the `/frontend-design` skill for the UI steps (5 and 6). Before writing client components, check `node_modules/next/dist/docs/` (`01-app/`) for any `"use client"` or React 19 notes.

1. Rename the catalog entry in `lib/games.ts` and update `lib/home-content.ts`. Verify: `/games` shows an ASTEROIDS card, `/games/asteroids` renders, `/games/rocks` is a 404, and the home page shows no broken reference.
2. Create `lib/engines/types.ts` and `lib/engines/index.ts`, with an empty registry for now. Verify: `npx tsc --noEmit` passes.
3. Create `lib/engines/asteroids.ts`: port utils, constants and the entity classes (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`) with the neon palette and HiDPI setup. Verify: `npx tsc --noEmit` passes.
4. Finish `createAsteroids`: closure state, phases, input handling, loop, snapshot diffing and `destroy()`. Register it in `ENGINES`. Verify: `npx tsc --noEmit` passes.
5. Create `components/game-canvas.tsx` and the `.game-canvas` CSS. Mount it from `GamePlayer` for engine games, and remove the fake arena and simulation for them only. Verify: `/games/asteroids/play` shows drifting asteroids, and Space starts a run.
6. Wire the HUD, ready and pause overlays, the 3X stat, the PAUSE/END/PLAY AGAIN buttons, button blur and the crt-bottom legend in `GamePlayer`. Verify: the acceptance criteria below, by hand.
7. Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] `/games` shows an ASTEROIDS card with the new short copy. No visible "ROCKS" remains in the app.
- [ ] `/games/asteroids` shows the new long copy, and its PLAY NOW goes to `/games/asteroids/play`.
- [ ] `/games/rocks` returns the 404 page.
- [ ] `/games/asteroids/play` loads with no console errors and no hydration warnings. It shows drifting yellow asteroids and the "PRESS SPACE TO START" overlay with the controls line.
- [ ] Pressing Space starts a run: a cyan ship appears at the center, blinking (invincible), and the HUD shows score 0, three hearts and level 01.
- [ ] Arrow keys and Space never scroll the page while the game is ready, playing or paused.
- [ ] Destroying a large, medium and small asteroid adds exactly 20, 50 and 100 points to the HUD score.
- [ ] A large asteroid splits into two medium, and a medium into two small. Small ones disappear.
- [ ] Losing a life removes one heart. The ship respawns at the center after about 2 s.
- [ ] Clearing all asteroids moves the HUD to level 02 and spawns 5 large asteroids.
- [ ] Picking up the magenta "3x" diamond fires three bullets per shot. A "3X" HUD stat counts down from 5.0s and disappears at 0.
- [ ] `P`, `Esc` and the PAUSE button each pause the run and show the PAUSED overlay. `P`, `Esc` and RESUME each resume it, with no jump in positions.
- [ ] Switching to another tab, then coming back, leaves the game paused.
- [ ] Losing the third life opens the GAME OVER modal with the final score equal to the HUD score.
- [ ] END opens the GAME OVER modal at any point of a run.
- [ ] Typing initials with letters and spaces in the modal works, and does not affect the game.
- [ ] PLAY AGAIN closes the modal and starts a new run right away (score 0, three hearts, level 01, no ready screen).
- [ ] After clicking PAUSE then RESUME with the mouse, pressing Space fires a bullet instead of pausing again.
- [ ] Leaving with EXIT and coming back to `/games/asteroids/play` gives normal ship speed and a single bullet per Space press (no duplicate loops or listeners). This holds in `npm run dev` (Strict Mode) too.
- [ ] The canvas has no visible HUD text, no Spanish text and no canvas GAME OVER overlay.
- [ ] The canvas looks sharp, not blurry, on a 2× display (or with DevTools device-pixel-ratio 2).
- [ ] At 375px viewport width the CRT and canvas fit with no horizontal scroll, and the ready overlay shows "KEYBOARD REQUIRED" under touch emulation.
- [ ] `/games/block-buster/play` (and every other non-engine game) still shows the fake arena with the simulated score, unchanged.
- [ ] `references/started-games/02-asteroids/` has no changes in `git status`.

## Decisions taken and discarded

| Decision         | Chosen                                                      | Discarded                                | Why                                                                             |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| Catalog entry    | Rename ROCKS → ASTEROIDS (`id: "asteroids"`)                | Reuse `rocks`; add a 9th entry           | The game is Asteroids; a duplicate shooter card would confuse.                  |
| Old URL          | No redirect; `/games/rocks` 404s                            | Permanent redirect in `next.config`      | The catalog is mock data with no external links yet.                            |
| Copy             | Rewrite to match the real game                              | Keep the "UFOs" text                     | The game has no UFOs; copy must not promise features.                           |
| Cover            | Keep the `cover-rocas` CSS class                            | Rename the class                         | A pure rename with no visual change; less churn.                                |
| Integration      | Typed TS engine factory, no globals                         | `<iframe>` of the original files         | Needs real React control over HUD, pause, end and restart, and a clean unmount. |
| Engine contract  | Generic `GameEngine` + registry by id                       | Asteroids-specific props in `GamePlayer` | Tetris and Arkanoid will plug in the same way.                                  |
| HUD / game over  | React HUD + existing modal; canvas draws the playfield only | Canvas HUD and overlay                   | One visual language across games; reuses SPEC 01's UI.                          |
| Snapshot updates | `onChange` only on change, 3X timer rounded to 0.1 s        | Emit every frame                         | Avoids 60 React re-renders per second.                                          |
| Run start        | Ready screen, Space to start                                | Start on mount                           | The player is not ambushed while the page loads.                                |
| Pause            | Button + `P`/`Esc` + auto-pause on blur or hidden tab       | Button only                              | Standard for keyboard games; avoids dying in a background tab.                  |
| Restart          | PLAY AGAIN skips the ready screen                           | Space restarts on the canvas             | Game over is owned by the modal; Space must stay free for typing initials.      |
| Visuals          | Neon palette with glow                                      | Original white vectors                   | Matches the site's CRT/neon look.                                               |
| Resolution       | Fixed 800×600 logical, CSS-scaled, DPR backing store        | Resize the playfield to the container    | Keeps gameplay identical on every screen size.                                  |
| Score saving     | Stays cosmetic                                              | localStorage; Supabase now               | Real persistence deserves its own spec (table, RLS, anti-cheat questions).      |
| Touch            | Out of scope; "KEYBOARD REQUIRED" hint                      | On-screen buttons                        | Keeps this spec to the port; touch UX is its own design problem.                |
| Other games      | Keep the simulated player                                   | "Coming soon" screen                     | No regression for pages that work today.                                        |
| Power-up         | Keep 3x with a React HUD timer                              | Remove it; timer on canvas               | It is part of the delivered game, and the HUD is React-only.                    |

## Identified risks

| Risk                                                              | Mitigation                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Strict Mode double mount creates two loops or duplicate listeners | All state lives in the factory closure. `destroy()` cancels rAF and removes every listener, is idempotent, and is called from the effect cleanup. There is an acceptance criterion for it. |
| `preventDefault` on Space breaks typing in the modal              | Events from `input`, `textarea` and `contenteditable` are ignored, and the `over` phase handles no keys.                                                                                   |
| A focused HUD button swallows Space                               | Buttons blur themselves after a click.                                                                                                                                                     |
| Re-rendering `GamePlayer` recreates the engine                    | `onChange` goes through a ref; the effect depends only on `factory`.                                                                                                                       |
| `shadowBlur` glow is slow with many particles                     | Glow only on strokes. Particles are drawn without blur if frame time suffers.                                                                                                              |
| The neon palette drifts from the CSS tokens                       | Hex values are copied from `:root` in `app/globals.css`; the palette table is the source of truth.                                                                                         |
| `/games/rocks` links somewhere outside the code                   | The grep in step 1 confirms the only references are `lib/games.ts` and `lib/home-content.ts`.                                                                                              |

## What is **not** in this spec

- Score persistence or real leaderboards (SAVE SCORE stays cosmetic).
- Touch controls.
- A redirect for `/games/rocks`.
- Engines for the other games.
- Sound or gameplay changes.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
