# SPEC 10 — Playable Snake game

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-13
> **Objective:** Build a Snake game as a typed canvas engine using the fruit sprites in `references/source-assets/snake-assets/snake-assets/`, and make it the real game at `/games/snake/play`, listed in the catalog and saving scores to the real leaderboards.

## Why this spec exists

The catalog lists SERPENTINE (`serpentine`), a simulated placeholder for a snake game: its play page ticks a fake score and its game-over modal says `SCORES NOT RECORDED FOR THIS DEMO`. Unlike Asteroids, Tetris and Arkanoid, Snake has **no reference code**: the only source is a sprite atlas, `fruits.png` (3790×442, transparent, three rows of 22 fruits), plus `sprites.js`, which assigns `window.SPRITE_ATLAS` with source rects for the middle (pixel-art) row and has Spanish comments. Every gameplay rule in this spec is therefore a design decision confirmed by the user (see Decisions), not a port. The engine follows the SPEC 05 pattern on the generic contract from SPEC 07, so this spec only adds an `ENGINES` entry; `GamePlayer` and the contract do not change.

## Scope

**In:**

- Catalog: replace `serpentine` with `snake` (same `sort_order` 3) through a migration, with copy that describes the real game. The `serpentine` ticker reference in `lib/home-content.ts` becomes `snake`.
- A new engine factory, `lib/engines/snake.ts`, with no module-level mutable state. It covers a 32×24 grid of 25 px cells, a snake that starts at length 3 and moves one cell per step, steering with arrows / WASD through a 2-turn input buffer, one fruit on the board at a time with a random sprite, growth by 1 per fruit, 10 × level points per fruit, a level up every 5 fruits with +1 step/s (from 8 up to a cap of 20), death on a wall or on its own body, and the end of the run when the board is full.
- Register `snake` in `ENGINES`, so the existing `saveScore` and leaderboards work for it.
- HUD, ready screen, pause overlay and game over are React. The canvas draws only the playfield (grid, border, fruit, snake).
- HUD: Score, Level, no lives stat (`lives: null`), extra `LENGTH`.
- Controls legend: `← ↑ → ↓ / WASD STEER · P PAUSE`.
- Assets: `fruits.png` copied to `public/games/snake/`. The engine draws the 22 middle-row sprites; the snake is drawn with neon canvas primitives.
- Crisp HiDPI rendering at a fixed 800×600 logical resolution; the 32×24 grid fills the canvas at scale 1.

**Out of scope (for future specs):**

- Sound (there are no sound files; the engine has no `sound` flag and no `setMuted()`).
- Touch / on-screen controls.
- Lives, wrap-around walls, obstacles, power-ups, fruit-specific values, timed or bonus fruits.
- A win title in the modal (a full board opens the existing GAME OVER modal).
- An attract mode on the ready screen.
- A redirect from `/games/serpentine` (it becomes a 404).
- Real engines for other games.
- Automated tests (no test runner is configured).

## Data model

### Catalog migration `replace_serpentine_with_snake`

```sql
delete from public.games where id = 'serpentine';

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('snake', 'SNAKE', 'Eat the fruit, grow longer, don''t bite yourself.', 'Steer a neon snake around a 32×24 grid and eat the fruit that appears one at a time. Each fruit adds a segment and points, and every five fruits the level rises and the snake speeds up. Hit a wall or your own tail and the run is over.', 'ARCADE', 'cover-snake', 'green', 3);
```

- The delete runs first so `sort_order` 3 is free. `serpentine` had 0 scores when this spec was written; any test rows it holds at apply time are cascade-deleted and that is accepted (placeholders only hold test scores).
- `lib/home-content.ts`: the ticker row `gameId: "serpentine"` → `gameId: "snake"`. No other `serpentine` reference exists in `app/`, `components/` or `lib/`.
- The cover `cover-snake` is reused as is; `app/globals.css` does not change.
- Data-only migration: the schema is unchanged, so `lib/supabase/database.types.ts` is not regenerated.

### Registry entry (`lib/engines/index.ts`)

```ts
snake: { factory: createSnake, controls: "← ↑ → ↓ / WASD STEER · P PAUSE" },
```

No `sound` flag, so the player shows no SOUND button.

### Snake engine (`lib/engines/snake.ts`)

```ts
export const createSnake: EngineFactory;
```

- Logical size `W = 800`, `H = 600`. Backing store `800·dpr × 600·dpr`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`. Every bound uses `W` / `H` or the grid constants, never `canvas.width` / `canvas.height`.
- Constants (designed for this spec, not taken from a reference):
  - `CELL` 25 px; `COLS` 32, `ROWS` 24 (32·25 = 800, 24·25 = 600; the grid fills the canvas).
  - Start: length 3, head at cell `(16, 12)`, body `(15, 12)`, `(14, 12)`, direction right.
  - `BASE_SPEED` 8 steps/s, `SPEED_PER_LEVEL` +1 step/s, `MAX_SPEED` 20 steps/s: `stepsPerSecond = min(8 + (level − 1), 20)` (the cap is reached at level 13).
  - `FRUITS_PER_LEVEL` 5: `level = 1 + floor(fruitsEaten / 5)`, no upper bound.
  - `POINTS_PER_FRUIT` 10, multiplied by the level at the moment the fruit is eaten.
  - `TURN_BUFFER` 2 queued turns.
- Movement: fixed-step accumulator. Each frame, `acc += dt`; while `acc ≥ 1000 / stepsPerSecond`, run one step. One step:
  1. If the turn queue is not empty, dequeue one direction and make it the current direction.
  2. Compute the next head cell. If it is outside `0..31 × 0..23`, the run ends (wall).
  3. If the next head is the fruit cell, the snake grows: the tail stays. Otherwise the tail cell is removed first.
  4. If the next head is on a body cell (after the tail removal from step 3), the run ends (self). Moving into the cell the tail just left is legal.
  5. Add the new head. If a fruit was eaten: `fruitsEaten += 1`, `score += 10 × level` (with the level before this fruit), recompute the level (and so the speed), then spawn a new fruit. If no empty cell remains (length 768), the run ends (board full).
- Fruit spawn: a uniformly random empty cell (not on the snake), with a uniformly random sprite index `0..21`. Exactly one fruit is on the board at a time.
- Turn buffer: a direction key enqueues its direction only if the queue has fewer than 2 entries, and the direction differs from the last queued direction (or the current one if the queue is empty), and it is not the opposite of that direction. Otherwise the key is ignored. The queue is cleared on `start()` / `restart()` and on pause.
- Scoring:

  | Event                  | Points  |
  | ---------------------- | ------- |
  | Eat a fruit at level L | +10 × L |

  The board holds 768 cells and the snake starts at 3, so at most 765 fruits can be eaten. Fruits `5(L−1) … 5L−1` are eaten at level L, so the maximum is `10 · 5 · (1 + 2 + … + 153) = 50 · 11,781 =` **589,050**, within the `0..10000000` CHECK. No clamp is needed.

- Snapshot: `lives: null` (the HUD hides the stat); `level` as above; `extras: [{ key: "length", label: "LENGTH", value: String(snake.length) }]` (always present; `"3"` in `ready`). The default `.hud-stat .v` cyan applies; no new HUD CSS. Extras are compared by value with `sameExtras`. An initial snapshot is emitted from the factory (as in Tetris), so the HUD never shows the placeholder hearts.
- Sprites: `fruits.png` at `/games/snake/fruits.png`, loaded with `new Image()` inside the factory. The source rects are those of `sprites.js` (all `y` 136, `h` 160), which match the pixels. The names in `sprites.js` are wrong (e.g. its `banana` rect holds an apple), so the engine keeps a module-level `FRUITS` array in sheet order with names that match the image:

  | #   | Name       | x    | w   |     | #   | Name       | x    | w   |
  | --- | ---------- | ---- | --- | --- | --- | ---------- | ---- | --- |
  | 0   | apple      | 34   | 110 |     | 11  | broccoli   | 1906 | 150 |
  | 1   | banana     | 186  | 150 |     | 12  | watermelon | 2068 | 170 |
  | 2   | pineapple  | 378  | 110 |     | 13  | pepper     | 2250 | 140 |
  | 3   | grapes     | 540  | 130 |     | 14  | kiwi       | 2432 | 130 |
  | 4   | pumpkin    | 712  | 130 |     | 15  | lemon      | 2604 | 130 |
  | 5   | turnip     | 894  | 110 |     | 16  | orange     | 2786 | 110 |
  | 6   | eggplant   | 1066 | 110 |     | 17  | peach      | 2948 | 130 |
  | 7   | strawberry | 1228 | 130 |     | 18  | peanut     | 3110 | 150 |
  | 8   | cherry     | 1400 | 130 |     | 19  | raspberry  | 3302 | 110 |
  | 9   | carrot     | 1582 | 110 |     | 20  | tomato     | 3454 | 150 |
  | 10  | mushroom   | 1734 | 150 |     | 21  | salad bowl | 3637 | 130 |

  > The `x` / `w` columns are the rects from `sprites.js` in their original order (verified against the alpha channel of the PNG); only the names are corrected, checked against a crop of the row.

  A fruit is drawn centred in its cell, scaled to fit a 21×21 box (2 px margin) while keeping its aspect ratio (`scale = min(21 / w, 21 / h)`), with `imageSmoothingQuality = "high"` (the sprites are downscaled about 7×). Until the image loads, the fruit is not drawn; grid, border and snake are.

- All state (`snake` cells, direction, turn queue, fruit cell and sprite index, `fruitsEaten`, score, level, accumulator, phase, image, `lastTime`, rAF id) lives in the factory closure. Module-level `const` only for constants and `FRUITS`. Comments are in English.

Palette (hex values copied from `:root` in `app/globals.css`):

| Element                  | Color                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| Background               | `#000`                                                                   |
| Grid lines               | `#00f5ff` at 6 % alpha, 1 px, no glow                                    |
| Board border             | `#00f5ff`, 2 px stroke inset 1 px, `shadowBlur` 8                        |
| Snake body               | `#00ff88` rounded squares (cell minus 2 px, radius 5), `shadowBlur` 8    |
| Snake head               | `#00ff88`, `shadowBlur` 16, two `#000` eyes facing the current direction |
| Snake head after a crash | `#ff006e`, `shadowBlur` 16 (the frozen `over` frame shows where it died) |
| Fruit                    | Original sprite from `fruits.png` (no glow)                              |

## Behavior

### Input (engine)

- `keydown` / `keyup` on `window`, added in the factory and removed in `destroy()`. There is no mouse input.
- Events from `input`, `textarea` or `[contenteditable]` are ignored (so typing initials, including W A S D, never steers).
- In `ready`, `playing` and `paused`, `preventDefault()` on `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` and `Space`.
- `ready`: `Space` → `start()`.
- `playing`: `↑` / `W`, `↓` / `S`, `←` / `A`, `→` / `D` enqueue a turn (see Turn buffer); keys match `KeyboardEvent.code` (`KeyW` …) so they work on any layout and with Caps Lock. Key repeat is harmless (a repeated direction is ignored). `P` / `Escape` → `pause()`.
- `paused`: `P` / `Escape` → `resume()`. Direction keys are ignored.
- `over`: no keys are handled; PLAY AGAIN restarts.
- `window` `blur` and `document` `visibilitychange` (hidden) → `pause()`. The turn queue is cleared on pause.

### Loop (engine)

- A single `requestAnimationFrame` loop starts in the factory and draws in every phase. `dt` capped at 50 ms (at most one step per frame at 20 steps/s, so no step is skipped after a hitch).
- `ready`: static board — grid, border, the length-3 snake at the start position heading right, and the first fruit (once the image has loaded). `start()` begins from exactly this board.
- `paused` and `over`: last frame frozen.
- `start()`: phase `playing` from the ready board. `restart()`: a fresh run (snake at the start position, new random fruit, score 0, level 1, `fruitsEaten` 0), phase `playing`. Both clear the turn queue and the accumulator.
- `lastTime` resets on `start()`, `resume()`, `restart()`; the accumulator is kept on `resume()` so the snake continues mid-step without a jump.
- The run ends (`over`, `onChange` fires) when the head would leave the grid, when the head would land on the body, or when the board is full. END ends the run at any time. All endings open the existing GAME OVER modal with the HUD score.

### Player (`components/game-player.tsx`)

- No change: the generic contract from SPEC 07 already hides lives when `lives === null`, renders extras and shows the per-game controls.

## Files

| File                                                              | Kind         | Purpose                             |
| ----------------------------------------------------------------- | ------------ | ----------------------------------- |
| Supabase migration `replace_serpentine_with_snake`                | new (remote) | Delete `serpentine`, insert `snake` |
| `supabase/migrations/<version>_replace_serpentine_with_snake.sql` | new          | Mirror of the applied SQL           |
| `lib/engines/snake.ts`                                            | new          | `createSnake`                       |
| `lib/engines/index.ts`                                            | modified     | Register `snake`                    |
| `lib/home-content.ts`                                             | modified     | Ticker `serpentine` → `snake`       |
| `public/games/snake/fruits.png`                                   | new          | Copy of the fruit sprite sheet      |
| `CLAUDE.md`                                                       | modified     | Migration list                      |

`references/source-assets/snake-assets/` is read only and is not modified. `sprites.js` is not copied (its rects move into `FRUITS`).

## Implementation plan

Use the `/frontend-design` skill for the UI steps. Before writing client components, check `node_modules/next/dist/docs/` (`01-app/`).

1. Apply `replace_serpentine_with_snake` with the Supabase MCP, read its version with `list_migrations`, and mirror the exact SQL in `supabase/migrations/`. Update `lib/home-content.ts`. Verify: `execute_sql` shows `snake` at `sort_order` 3 and no `serpentine`; `/games` shows the SNAKE card with `cover-snake`; `/games/serpentine` is a 404.
2. Copy `fruits.png` to `public/games/snake/`. In `lib/engines/snake.ts`, write the constants, the `FRUITS` table, the HiDPI setup and the drawing of grid, border, fruit and snake. Verify: `npx tsc --noEmit` passes.
3. Finish `createSnake`: closure state, image loading, phases, input with the turn buffer, the fixed-step loop, collisions, fruit spawn, scoring and levels, snapshot diffing (extras with `sameExtras`), `destroy()`. Register it in `ENGINES`. Verify: `/games/snake/play` shows the ready board and Space starts a run.
4. Verify the acceptance criteria below, by hand.
5. Update `CLAUDE.md` (migration list: `replace_serpentine_with_snake` — swaps the SERPENTINE placeholder for the real Snake row). Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] `/games` shows a SNAKE card (ARCADE, green, `cover-snake`) in third place with the short copy "Eat the fruit, grow longer, don't bite yourself."; no SERPENTINE card remains.
- [ ] `/games/snake` shows the new long copy, and PLAY NOW goes to `/games/snake/play`. `/games/serpentine` returns the 404 page. The home ticker shows no broken game link.
- [ ] `/games/snake/play` loads with no console errors (including no 404 for `fruits.png`) or hydration warnings and shows the grid, the length-3 snake heading right and one fruit under the ready overlay with `← ↑ → ↓ / WASD STEER · P PAUSE`; the same legend is in the `.crt-bottom` slot. No SOUND button is shown.
- [ ] Space starts a run and the snake moves right at 8 cells/s. HUD shows score 0, level 01, LENGTH 3 and no lives stat (never placeholder hearts, not even on first paint).
- [ ] Arrow keys and Space never scroll the page in ready, playing or paused.
- [ ] Arrows and WASD steer; pressing the opposite direction does nothing; two quick turns between steps (e.g. `↑` then `←` while heading right) are both applied on consecutive steps.
- [ ] Each fruit adds exactly 10 × level points (10 at level 1, 20 at level 2 …), raises LENGTH by 1 and spawns a new fruit, with a random sprite, on an empty cell.
- [ ] After the 5th fruit the HUD shows level 02 and the snake visibly speeds up (9 cells/s); the speed stops rising at level 13 (20 cells/s).
- [ ] Hitting any of the four walls ends the run; running into the body ends the run; following the tail into the cell it is leaving does not. The frozen frame shows the head in magenta and the GAME OVER modal shows the HUD score.
- [ ] `P`, `Esc` and PAUSE pause; `P`, `Esc` and RESUME resume with no jump and no queued turn applied; switching tabs and coming back leaves it paused.
- [ ] END opens the GAME OVER modal at any point of a run. Typing initials (letters including W A S D, Space) in the modal does not affect the game.
- [ ] PLAY AGAIN starts a fresh run right away (score 0, level 01, LENGTH 3, snake at the start position, no ready screen). After clicking PAUSE then RESUME with the mouse, the arrows steer and Space does not re-click the button.
- [ ] EXIT and coming back (also in `npm run dev` Strict Mode): the snake moves at normal speed and each key press queues a single turn — one loop, one set of listeners.
- [ ] The canvas has no score / level / length text, no pause or game-over overlay and no Spanish text. Grid, border and snake are sharp at DPR 2; fruits are recognisable at cell size. At 375 px width the CRT fits with no horizontal scroll and the ready overlay shows `KEYBOARD REQUIRED` under touch emulation. No sound plays.
- [ ] Saving as `TEST_1` shows `▸ SCORE SAVED — RANK #NN_`; `/games/snake` and the Hall of Fame SNAKE tab show the row; the SNAKE card's best equals the top score.
- [ ] Asteroids, Tetris and Arkanoid are unchanged (legends, HUD extras, Arkanoid's SOUND button, saving).
- [ ] Every other simulated game (e.g. `/games/glutton/play`) still shows the fake arena, three hearts and `SCORES NOT RECORDED FOR THIS DEMO`.
- [ ] Files under `references/source-assets/snake-assets/` are unchanged.

## Decisions taken and discarded

| Decision       | Chosen                                                                       | Discarded                                      | Why                                                                             |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Catalog entry  | Replace `serpentine` with `snake` at `sort_order` 3 (delete + insert)        | Keep id `serpentine`; add a 9th row            | The game is Snake; two snake cards would confuse. `serpentine` had 0 scores.    |
| Title / copy   | SNAKE, "Eat the fruit, grow longer, don't bite yourself." + new long copy    | Keep SERPENTINE copy ("magenta cores", …)      | Describes only what this game does (fruit sprites, 5-fruit levels, walls kill). |
| Look (catalog) | ARCADE · green · `cover-snake` reused                                        | A new CSS cover                                | No visual churn; the cover already shows a snake.                               |
| Old URL        | `/games/serpentine` 404s                                                     | Redirect                                       | Same as SPEC 05 / 07 / 08.                                                      |
| Source         | Original design using the fruit atlas                                        | Porting a reference                            | No code reference exists; every rule here was confirmed by the user.            |
| Grid           | 32×24 cells of 25 px, filling 800×600                                        | 20×15 of 40 px; 40×30 of 20 px                 | Classic density, no centring or letterbox.                                      |
| Walls          | Edge kills                                                                   | Wrap around                                    | Classic Snake.                                                                  |
| Speed / levels | Level every 5 fruits; 8 steps/s +1 per level, capped at 20                   | Faster per fruit; constant speed               | Readable progression the HUD level reflects.                                    |
| Scoring        | 10 × level per fruit; fruits are cosmetic                                    | Flat 10; per-fruit values                      | Rewards surviving at speed without inventing fruit tiers. Max 589,050.          |
| Lives          | One life, `lives: null`                                                      | 3 lives with snake reset                       | Classic Snake; the contract already hides the stat.                             |
| HUD extras     | `LENGTH`                                                                     | `FRUITS` eaten; none                           | Length is the snake's own progress at a glance.                                 |
| Input          | Arrows + WASD, 2-turn buffer, reversal ignored                               | Arrows only; no buffer                         | Quick double turns are not lost; WASD is common.                                |
| Legend         | `← ↑ → ↓ / WASD STEER · P PAUSE`                                             | —                                              | Lists both key sets in one line.                                                |
| End of run     | Wall, self or full board → existing GAME OVER modal                          | Reset board and continue on full board         | No contract change; the full board is theoretical.                              |
| Ready screen   | Static board (start snake + first fruit)                                     | Attract mode                                   | Shows the game without inventing AI behaviour.                                  |
| Snake look     | Neon green rounded segments with glow, head with eyes, magenta head on crash | Flat squares                                   | Matches the platform's neon palette; the assets only include fruits.            |
| Assets         | `fruits.png` copied, middle (pixel-art) row, names corrected in `FRUITS`     | Use `sprites.js` names; other rows             | `sprites.js` rects are right but its names are not; it targets the middle row.  |
| Sound          | Out of scope                                                                 | Synthesized Web Audio blips with `sound: true` | No sound files; can land in its own spec using the SPEC 09 mechanism.           |
| `dt`           | Capped at 50 ms, fixed-step accumulator                                      | Step per frame                                 | Platform rule; speed independent of the monitor's refresh rate.                 |

## Identified risks

| Risk                                                              | Mitigation                                                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Strict Mode double mount creates two loops or duplicate listeners | All state in the factory closure; `destroy()` idempotent and removes every listener; acceptance criterion. |
| WASD and Space break typing in the modal                          | Events from inputs are ignored and `over` handles no keys.                                                 |
| A fast double turn reverses the snake into itself                 | Each queued turn is checked against the last queued direction, not only the current one.                   |
| Sprites not loaded on first frame                                 | Fruit is drawn only after load; the image `onload` is ignored after `destroy()`.                           |
| Downscaled pixel-art fruits look blurry or jagged                 | `imageSmoothingQuality = "high"`; acceptance criterion that fruits are recognisable at DPR 1 and 2.        |
| `fruits.png` is 586 KB for 25 px icons                            | Accepted for this spec (loaded once, cached); cropping the middle row is a possible follow-up.             |
| `extras` array identity triggers a re-render every frame          | Snapshot diffing compares extras by value (`sameExtras`).                                                  |
| Replacing the placeholder drops its scores                        | `serpentine` had 0 scores; stated in Data model.                                                           |
| `references/source-assets/` is untracked in git                   | `git status` cannot prove it is unchanged; the acceptance criterion compares the files instead.            |

## What is **not** in this spec

- Sound.
- Touch controls.
- Lives, wrap-around walls, obstacles, power-ups or fruit-specific values.
- A win title or a board reset after a full board.
- A redirect for `/games/serpentine`.
- Engines for other games.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
