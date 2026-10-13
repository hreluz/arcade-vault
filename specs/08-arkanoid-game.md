# SPEC 08 — Playable Arkanoid game

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-13
> **Objective:** Port the reference Arkanoid game (`references/started-games/04-arkanoid/`) to a typed canvas engine and make it the real game at `/games/arkanoid/play`, listed in the catalog and saving scores to the real leaderboards.

## Why this spec exists

The catalog lists BLOCK BUSTER (`block-buster`), a simulated placeholder for a brick-breaker game: its play page ticks a fake score and its game-over modal says `SCORES NOT RECORDED FOR THIS DEMO`. The reference Arkanoid is a finished vanilla-JS canvas game with a spritesheet and five levels, but it uses globals (`canvas`, `ctx`, `blocks`, `score`, `LEVELS`, the spritesheet loader state), `document` and canvas listeners that are never removed, a canvas-drawn HUD (`Score:`, `Nivel:`, ball icons for lives), canvas overlays for pause (`PAUSA` with a 1–5 level select), game over and win (`¡Completaste el juego!`), Spanish text and two sound effects. It needs the SPEC 05 engine pattern to live inside React. SPEC 07 already generalized the engine contract, so this spec only adds an `ENGINES` entry; `GamePlayer` and the contract do not change.

## Scope

**In:**

- Catalog: replace `block-buster` with `arkanoid` (same `sort_order` 1) through a migration, with copy that describes the real game. The `block-buster` ticker reference in `lib/home-content.ts` becomes `arkanoid`.
- Port `game.js`, `levels.js` and `assets/spritesheet.js` to TypeScript as an engine factory with no module-level mutable state. The port covers every mechanic: paddle (keyboard and mouse), ball movement, wall / ceiling / paddle bounces, AABB brick collisions (one brick per frame), the 4-frame brick explosion, 3 lives with immediate relaunch, 10 points per brick, the 5 level layouts with their ball-speed multipliers, automatic level advance and the "all levels cleared" end. Gameplay constants stay identical.
- Register `arkanoid` in `ENGINES`, so the existing `saveScore` and leaderboards work for it.
- HUD, ready screen, pause overlay and game over are React. The canvas draws only the playfield: bricks, explosions, paddle and ball. The reference's canvas HUD (`Score:`, `Nivel:`, life balls), its pause overlay (`PAUSA`, `Saltar al nivel:`, buttons 1–5 and their click handler) and its `GAME OVER` / `¡Completaste el juego!` overlays are removed.
- HUD: Score, Level, Lives (hearts), extra `BLOCKS` (bricks left in the current level).
- Controls legend: `← → / MOUSE MOVE · P PAUSE`.
- Assets: `spritesheet-breakout.png` copied to `public/games/arkanoid/`.
- Original sprites on a black background, crisp HiDPI backing store at a fixed 800×600 logical resolution (same size as the reference, so no centring or scaling).

**Out of scope (for future specs):**

- Sound (`ball-bounce.mp3`, `break-sound.mp3` are not copied or played).
- Touch / on-screen controls.
- Gameplay changes beyond those listed in Decisions (no paddle-angle bounces, no serve / launch key, no power-ups, no level loop after level 5).
- The level select in the pause screen.
- A win title in the modal (clearing level 5 opens the existing GAME OVER modal).
- An attract mode on the ready screen.
- A redirect from `/games/block-buster` (it becomes a 404).
- Real engines for other games.
- Automated tests (no test runner is configured).

## Data model

### Catalog migration `replace_block_buster_with_arkanoid`

```sql
delete from public.games where id = 'block-buster';

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('arkanoid', 'ARKANOID', 'Bounce the ball and smash the bricks.', 'Slide your paddle with the mouse or the arrow keys and keep the ball in play to break every brick. Five levels, each with its own brick pattern and a faster ball. Clear all five to win, but you only have three lives.', 'ARCADE', 'cover-bricks', 'cyan', 1);
```

- The delete runs first so `sort_order` 1 is free. `block-buster` had 0 scores when this spec was written; any test rows it holds at apply time are cascade-deleted and that is accepted (placeholders only hold test scores).
- `lib/home-content.ts`: the ticker row `gameId: "block-buster"` → `gameId: "arkanoid"`. No other `block-buster` reference exists in `app/`, `components/` or `lib/`.
- The cover `cover-bricks` is reused as is; `app/globals.css` does not change for the cover.
- Data-only migration: the schema is unchanged, so `lib/supabase/database.types.ts` is not regenerated.

### Registry entry (`lib/engines/index.ts`)

```ts
arkanoid: { factory: createArkanoid, controls: "← → / MOUSE MOVE · P PAUSE" },
```

### Arkanoid engine (`lib/engines/arkanoid.ts`, `lib/engines/arkanoid-levels.ts`)

```ts
export const createArkanoid: EngineFactory;
```

- Logical size `W = 800`, `H = 600`, the reference's own size: the playfield fills the canvas at scale 1. Backing store `800·dpr × 600·dpr`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`. Every bound that the reference reads from `canvas.width` / `canvas.height` uses `W` / `H` instead (the backing store is no longer 800×600).
- `lib/engines/arkanoid-levels.ts` exports `LEVELS: readonly { speed: number; blocks: { col: number; row: number; color: BlockColor }[] }[]`, built exactly as in `levels.js` (pure, computed once at module load, never mutated).
- Constants copied from the reference and not changed:
  - `PADDLE_SPEED` 400 px/s; paddle `w` 81, `h` 14, `y` 560, starts centred at `x = (W − 81) / 2`.
  - Ball `w` 16, `h` 16; `BASE_BALL_VX` 200, `BASE_BALL_VY` −300 px/s, both multiplied by the level `speed`.
  - Bricks: `BLOCK_COLS` 10, `BLOCK_ROWS` 6, `BLOCK_W` 64, `BLOCK_H` 24, `BLOCKS_ORIGIN_X = (800 − 10·64) / 2 = 80`, `BLOCKS_ORIGIN_Y` 80.
  - Levels (speed, layout, brick count):

    | Level | Speed | Layout                                                                                                                    | Bricks |
    | ----- | ----- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
    | 1     | 1.00  | Full 10×6 grid, rows red, yellow, cyan, magenta, hotpink, green                                                           | 60     |
    | 2     | 1.10  | Pyramid (`pyStart` [4,3,2,1,0,0], `pyEnd` [5,6,7,8,9,9]), rows gray, cyan, hotpink, yellow, magenta, green                | 40     |
    | 3     | 1.21  | Checkerboard `(col + row) % 2 === 0`, yellow rows 0–2, magenta rows 3–5                                                   | 30     |
    | 4     | 1.33  | Rows with gaps `[[2,5,8],[0,4,7,9],[1,3,6],[2,5,8,9],[0,4,7],[1,3,6,9]]`, rows cyan, magenta, green, yellow, hotpink, red | 39     |
    | 5     | 1.46  | Frame + cross (`col 0/9`, `row 0/5`, `col 4`, `row 2`), frame cyan, inner cross hotpink                                   | 39     |

  - Lives 3. Explosion 4 frames over `EXPLOSION_DURATION` 150 ms, frame index `min(floor(elapsed / 150 · 4), 3)`.
- Physics, verbatim from `update(dt)`, in this order each frame while `playing`:
  1. `←` / `→` held move the paddle `PADDLE_SPEED · dt`, clamped to `[0, W − w]`.
  2. Ball moves `vx · dt`, `vy · dt`.
  3. Left / right / top walls: snap to the wall and force `vx` / `vy` away from it.
  4. Paddle: if `vy > 0`, horizontal overlap, and the ball bottom is within `[paddle.y, paddle.y + h + 8]`, snap the ball on top of the paddle and set `vy = −|vy|`. The angle never changes (`vx` keeps its value).
  5. Bricks: the first alive brick that overlaps (AABB) dies, spawns an explosion, adds 10 points and flips `vy`; at most one brick per frame. If it was the last brick: below level 5 the next level loads; on level 5 the run ends.
  6. Explosions age by `dt` and are dropped after 150 ms.
  7. Ball below `H`: lose a life; at 0 the run ends; otherwise the ball relaunches at once from the paddle (`initBall`).
- `loadLevel(n)` / `initBall()`: the ball is placed centred on top of the paddle (`x = paddle.x + (w − 16) / 2`, `y = paddle.y − 16`) with `vx = 200 · speed`, `vy = −300 · speed`; it launches immediately (no serve key). `loadLevel` also clears explosions; the paddle keeps its position across levels.
- Scoring:

  | Event         | Points |
  | ------------- | ------ |
  | Break a brick | +10    |

  All five levels hold 60 + 40 + 30 + 39 + 39 = 208 bricks, so the maximum score is **2,080**, far within the `0..10000000` CHECK. No clamp is needed.

- Snapshot: `lives` 3 → 0; `level` = current level (1–5); `extras: [{ key: "blocks", label: "BLOCKS", value: String(aliveBricks) }]` (always present; `"60"` at start and in `ready`). The default `.hud-stat .v` cyan applies; no new HUD CSS.
- `dt` is capped at 50 ms (the reference is uncapped; at 60 fps this changes nothing, it only prevents the ball tunnelling after a hitch).
- Sprites: `spritesheet-breakout.png` (559×337) at `/games/arkanoid/spritesheet-breakout.png`, loaded with `new Image()` inside the factory and drawn directly with `drawImage` (the reference's offscreen-canvas copy is not needed). `SPRITES` and `EXPLOSION_FRAMES` source rects are copied verbatim (paddle `32,112,162×14`, ball `32,32,16×16`, block colours `gray red yellow cyan magenta hotpink green`, explosion frames at `sx` 256/288/320/352; `gray` reuses the red frames). Draw sizes are the reference's: bricks 64×24, paddle 81×14, ball 16×16, explosions at the brick rect. Until the image loads, only the black background is drawn.
- All state (`paddle`, `ball`, `blocks`, `explosions`, `keys`, score, lives, level, phase, image, `lastTime`, rAF id) lives in the factory closure. Module-level `const` only for constants, `LEVELS`, `SPRITES` and `EXPLOSION_FRAMES`. Comments are in English.

Palette:

| Element                          | Color                                  |
| -------------------------------- | -------------------------------------- |
| Background                       | `#000`                                 |
| Bricks, paddle, ball, explosions | Original spritesheet sprites (no glow) |

## Behavior

### Input (engine)

- `keydown` / `keyup` on `window` and `mousemove` on the canvas, added in the factory and removed in `destroy()`. The reference's `document` listeners and its canvas `click` handler (pause level select) are not ported.
- Events from `input`, `textarea` or `[contenteditable]` are ignored.
- In `ready`, `playing` and `paused`, `preventDefault()` on `ArrowLeft`, `ArrowRight` and `Space`.
- `ready`: `Space` → `start()`.
- `playing`: `←` / `→` held move the paddle at 400 px/s. `mousemove` sets the paddle centre to the mouse: `x = (clientX − rect.left) · (W / rect.width)`, `paddle.x = clamp(x − w / 2, 0, W − w)`. `P` / `Escape` → `pause()`.
- `paused`: `P` / `Escape` → `resume()`. The mouse does not move the paddle.
- `ready` and `over`: the mouse does not move the paddle. `over` handles no keys; PLAY AGAIN restarts.
- `window` `blur` and `document` `visibilitychange` (hidden) → `pause()`. Held keys are cleared on pause.

### Loop (engine)

- A single `requestAnimationFrame` loop starts in the factory and draws in every phase. `dt` capped at 50 ms.
- `ready`: level 1 bricks, the paddle centred and the ball resting on it, static (once the spritesheet has loaded). `paused` and `over`: last frame frozen.
- `start()` / `restart()`: score 0, lives 3, paddle centred, `loadLevel(1)` (ball launches at once), held keys cleared.
- `lastTime` resets on `start()`, `resume()`, `restart()`.
- The run ends (`over`, `onChange` fires) when the last life is lost or when the last brick of level 5 breaks (score 2,080 if no brick was skipped — every brick must be broken to advance). END ends the run at any time. Both endings open the existing GAME OVER modal.

### Player (`components/game-player.tsx`)

- No change: the generic contract from SPEC 07 already renders lives, extras and the per-game controls.

## Files

| File                                                                   | Kind         | Purpose                                        |
| ---------------------------------------------------------------------- | ------------ | ---------------------------------------------- |
| Supabase migration `replace_block_buster_with_arkanoid`                | new (remote) | Delete `block-buster`, insert `arkanoid`       |
| `supabase/migrations/<version>_replace_block_buster_with_arkanoid.sql` | new          | Mirror of the applied SQL                      |
| `lib/engines/arkanoid-levels.ts`                                       | new          | `LEVELS` (port of `levels.js`)                 |
| `lib/engines/arkanoid.ts`                                              | new          | `createArkanoid` (port of `game.js` + sprites) |
| `lib/engines/index.ts`                                                 | modified     | Register `arkanoid`                            |
| `lib/home-content.ts`                                                  | modified     | Ticker `block-buster` → `arkanoid`             |
| `public/games/arkanoid/spritesheet-breakout.png`                       | new          | Copy of the reference spritesheet              |
| `CLAUDE.md`                                                            | modified     | Migration list                                 |

`references/started-games/04-arkanoid/` is read only and is not modified. The sounds are not copied.

## Implementation plan

Use the `/frontend-design` skill for the UI steps. Before writing client components, check `node_modules/next/dist/docs/` (`01-app/`).

1. Apply `replace_block_buster_with_arkanoid` with the Supabase MCP, read its version with `list_migrations`, and mirror the exact SQL in `supabase/migrations/`. Update `lib/home-content.ts`. Verify: `execute_sql` shows `arkanoid` at `sort_order` 1 and no `block-buster`; `/games` shows the ARKANOID card with `cover-bricks`; `/games/block-buster` is a 404.
2. Copy the spritesheet to `public/games/arkanoid/`. Create `lib/engines/arkanoid-levels.ts` and, in `lib/engines/arkanoid.ts`, the constants, sprite tables, HiDPI setup, AABB collision and drawing of bricks, explosions, paddle and ball. Verify: `npx tsc --noEmit` passes.
3. Finish `createArkanoid`: closure state, image loading, phases, keyboard and mouse input, loop, level advance, lives, snapshot diffing (extras by value with `sameExtras`), `destroy()`. Register it in `ENGINES`. Verify: `/games/arkanoid/play` shows level 1 with the ready overlay and Space starts a run.
4. Verify the acceptance criteria below, by hand.
5. Update `CLAUDE.md` (migration list: `replace_block_buster_with_arkanoid` — swaps the BLOCK BUSTER placeholder for the real Arkanoid row). Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] `/games` shows an ARKANOID card (ARCADE, cyan, `cover-bricks`) in first place with the short copy "Bounce the ball and smash the bricks."; no BLOCK BUSTER card remains.
- [ ] `/games/arkanoid` shows the new long copy, and PLAY NOW goes to `/games/arkanoid/play`. `/games/block-buster` returns the 404 page. The home ticker shows no broken game link.
- [ ] `/games/arkanoid/play` loads with no console errors (including no 404 for the spritesheet) or hydration warnings and shows level 1's 60 bricks, the paddle and the ball under the ready overlay with `← → / MOUSE MOVE · P PAUSE`; the same legend is in the `.crt-bottom` slot.
- [ ] Space starts a run and the ball launches up-right from the paddle. HUD shows score 0, three hearts, level 01 and BLOCKS 60.
- [ ] Arrow keys and Space never scroll the page in ready, playing or paused.
- [ ] `←` / `→` move the paddle and it stops at both walls; moving the mouse over the canvas centres the paddle under the pointer at any CRT size (including 375 px width), and the mouse does nothing in ready, paused or over.
- [ ] The ball bounces off the left, right and top walls and off the paddle; its angle never changes.
- [ ] Each broken brick adds exactly 10 points and lowers BLOCKS by 1, and plays the 4-frame explosion in the brick's colour.
- [ ] Clearing level 1 loads level 2 (pyramid, BLOCKS 40, HUD level 02) with a visibly faster ball; levels 3, 4 and 5 show the checkerboard (30), gaps (39) and frame + cross (39) layouts.
- [ ] Missing the ball removes one heart and relaunches the ball at once from the paddle; losing the third ends the run and the GAME OVER modal shows the HUD score.
- [ ] Breaking the last brick of level 5 ends the run and opens the GAME OVER modal with 2,080.
- [ ] `P`, `Esc` and PAUSE pause; `P`, `Esc` and RESUME resume with no ball jump; switching tabs and coming back leaves it paused.
- [ ] END opens the GAME OVER modal at any point of a run. Typing initials (letters, Space) in the modal does not affect the game.
- [ ] PLAY AGAIN starts a fresh run right away (score 0, three hearts, level 01, BLOCKS 60, no ready screen). After clicking PAUSE then RESUME with the mouse, `←` / `→` move the paddle and Space does not re-click the button.
- [ ] EXIT and coming back (also in `npm run dev` Strict Mode): the ball moves at normal speed and the paddle moves once per input — one loop, one set of listeners.
- [ ] The canvas has no score / level / lives text, no pause, level-select, game-over or win overlay and no Spanish text. It is sharp at DPR 2 (no blurry backing store); at 375 px width the CRT fits with no horizontal scroll and the ready overlay shows `KEYBOARD REQUIRED` under touch emulation. No sound plays.
- [ ] Saving as `TEST_1` shows `▸ SCORE SAVED — RANK #NN_`; `/games/arkanoid` and the Hall of Fame ARKANOID tab show the row; the ARKANOID card's best equals the top score.
- [ ] Asteroids and Tetris are unchanged (legends, HUD extras, saving).
- [ ] Every other simulated game (e.g. `/games/serpentine/play`) still shows the fake arena, three hearts and `SCORES NOT RECORDED FOR THIS DEMO`.
- [ ] `references/started-games/04-arkanoid/` has no changes in `git status`.

## Decisions taken and discarded

| Decision      | Chosen                                                                                | Discarded                             | Why                                                                                        |
| ------------- | ------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Catalog entry | Replace `block-buster` with `arkanoid` at `sort_order` 1 (delete + insert)            | Keep id `block-buster`; add a 9th row | The game is Arkanoid; two brick-breaker cards would confuse. `block-buster` had 0 scores.  |
| Title / copy  | ARKANOID, "Bounce the ball and smash the bricks." + new long copy                     | Keep BLOCK BUSTER title or short copy | Matches the reference and describes only what it does (mouse/arrows, 5 levels, 3 lives).   |
| Look          | ARCADE · cyan · `cover-bricks` reused                                                 | Magenta accent; a new cover           | No visual churn; the cover already shows bricks.                                           |
| Old URL       | `/games/block-buster` 404s                                                            | Redirect                              | Same as SPEC 05 / 07; no external links.                                                   |
| Gameplay      | Everything verbatim: fixed bounce angle, immediate relaunch, paddle 81 px             | Serve on Space; paddle-angle bounces  | Fidelity to the code (the reference CLAUDE.md's 162 px paddle is stale; the code uses 81). |
| `dt`          | Capped at 50 ms                                                                       | Uncapped as in the reference          | Platform rule; prevents tunnelling after a hitch; no change at 60 fps.                     |
| Score bound   | No clamp; max 2,080                                                                   | Clamp at 10,000,000                   | 208 bricks × 10 is the hard ceiling.                                                       |
| HUD extras    | `BLOCKS` left in the current level; hearts for lives                                  | No extras; also total broken          | Shows level progress at a glance with one stat.                                            |
| Input         | `←` / `→` and mouse (mapped with `getBoundingClientRect` and `W`), only while playing | Keyboard only                         | The reference's main control is the mouse.                                                 |
| Legend        | `← → / MOUSE MOVE · P PAUSE`                                                          | `← → MOVE · MOUSE MOVE · P PAUSE`     | Shorter; both inputs do the same thing.                                                    |
| End of run    | Lives out or level 5 cleared → existing GAME OVER modal                               | Loop to level 1 faster; YOU WIN title | No gameplay invention and no contract change.                                              |
| Level select  | Dropped                                                                               | Port to the React pause overlay       | Level jumps would make leaderboard scores unfair; needs a contract change.                 |
| Ready screen  | Static level 1 with paddle and ball                                                   | Empty black; attract mode             | Shows the game behind the overlay without inventing behaviour.                             |
| Assets        | Spritesheet copied to `public/games/arkanoid/`, original sprites                      | Neon redraw                           | Keeps the reference look and the explosion frames.                                         |
| Sound         | Out of scope                                                                          | Port both mp3s with a mute toggle     | Same as SPEC 05; needs a mute concern in the player.                                       |

## Identified risks

| Risk                                                              | Mitigation                                                                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict Mode double mount creates two loops or duplicate listeners | All state in the factory closure; `destroy()` idempotent and removes every listener (window, document, canvas); acceptance criterion for it. |
| Game keys (Space, arrows) break typing in the modal               | Events from inputs are ignored and `over` handles no keys.                                                                                   |
| Mouse mapping uses the HiDPI backing width                        | Map with `W / rect.width`, never `canvas.width`; acceptance criterion at 375 px width.                                                       |
| Sprites not loaded on first frame                                 | Engine draws only the background until the image loads; the image `onload` is ignored after `destroy()`.                                     |
| Ball tunnels through a brick or the paddle after a long frame     | `dt` capped at 50 ms.                                                                                                                        |
| `extras` array identity triggers a re-render every frame          | Snapshot diffing compares extras by value (`sameExtras`).                                                                                    |
| Replacing the placeholder drops its scores                        | `block-buster` had 0 scores; stated in Data model.                                                                                           |

## What is **not** in this spec

- Sound.
- Touch controls.
- Level select, power-ups, paddle-angle bounces, a serve key or any other gameplay change.
- A win title or a level loop after level 5.
- A redirect for `/games/block-buster`.
- Engines for other games.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
