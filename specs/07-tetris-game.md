# SPEC 07 — Playable Tetris game

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-13
> **Objective:** Port the reference Tetris game (`references/started-games/03-tetris/`) to a typed canvas engine and make it the real game at `/games/tetris/play`, listed in the catalog and saving scores to the real leaderboards.

## Why this spec exists

The catalog lists FALLDOWN (`falldown`), a simulated placeholder for a falling-blocks game: its play page ticks a fake score and its game-over modal says `SCORES NOT RECORDED FOR THIS DEMO`. The reference Tetris is a finished vanilla-JS canvas game, but it uses globals, a `document` `keydown` listener that is never removed, a DOM side panel for score / lines / level / next, a DOM overlay for pause and game over, a light/dark theme toggle with `localStorage`, and Spanish text. It needs the SPEC 05 engine pattern to live inside React. SPEC 05 also left the engine contract Asteroids-shaped (`tripleShot` in the snapshot, a hardcoded `CONTROLS` string in `GamePlayer`, `ENGINES` mapping id → bare factory). This spec generalizes that contract first, so Tetris and every later game plug in by adding a registry entry only.

## Scope

**In:**

- Generalize the engine contract: `EngineSnapshot` with `lives: number | null` and `extras: HudStat[]`; `ENGINES` entries `{ factory, controls }`; `GamePlayer` renders extras and per-game controls and hides Lives when `lives === null`; Asteroids migrated with no visible change.
- Catalog: replace `falldown` with `tetris` (same `sort_order` 2) through a migration, with copy that describes the real game. The `falldown` ticker reference in `lib/home-content.ts` becomes `tetris`.
- Port `game.js` to TypeScript as an engine factory with no module-level mutable state. The port covers every mechanic: the 10×20 board, the 8 pieces (I, O, T, S, Z, J, L and the hollow 3×3 "nut"), uniform random piece choice, clockwise rotation with wall kicks, collision, merge, line clearing, gravity, soft drop, hard drop, ghost piece, NEXT preview, scoring, levels and top-out. Gameplay constants stay identical.
- Register `tetris` in `ENGINES`, so the existing `saveScore` and leaderboards work for it.
- HUD, ready screen, pause overlay and game over are React. The canvas draws only the well, the pieces, the ghost and the NEXT preview. The reference's DOM panel (`SCORE`, `LINES`, `LEVEL`, controls list), its `#overlay` (`PAUSA`, `GAME OVER`, `Puntuación`, `Reiniciar`), the theme toggle and its `localStorage` key are removed.
- HUD: Score, Level, no Lives stat, extra `LINES`.
- Controls legend: `← → MOVE · ↑ ROTATE · ↓ SOFT DROP · SPACE DROP · P PAUSE`.
- Neon palette with glow on the canvas, crisp HiDPI rendering at a fixed 800×600 logical resolution, 300×600 well centred at scale 1.

**Out of scope (for future specs):**

- Sound (the reference has none).
- Touch / on-screen controls.
- Gameplay changes beyond those listed in Decisions (no 7-bag randomizer, hold piece, lock delay, DAS/ARR tuning, T-spins or combos).
- The reference's light/dark theme toggle.
- An attract mode on the ready screen.
- A redirect from `/games/falldown` (it becomes a 404).
- Real engines for other games.
- Automated tests (no test runner is configured).

## Data model

### Catalog migration `replace_falldown_with_tetris`

```sql
delete from public.games where id = 'falldown';

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('tetris', 'TETRIS', 'Fit the falling pieces and clear lines.', 'Seven classic tetrominoes and a hollow nut piece fall into a 10×20 well. Slide, rotate and drop them — a ghost shows where each one lands — and clear lines to score. Every 10 lines the level rises and the pieces fall faster.', 'PUZZLE', 'cover-tetro', 'magenta', 2);
```

- The delete runs first so `sort_order` 2 is free. `falldown` had 0 scores when this spec was written; any test rows it holds at apply time are cascade-deleted and that is accepted (placeholders only hold test scores).
- `lib/home-content.ts`: the ticker row `gameId: "falldown"` → `gameId: "tetris"`. No other `falldown` reference exists in `app/`, `components/` or `lib/`.
- The cover `cover-tetro` is reused as is; `app/globals.css` does not change for the cover.
- Data-only migration: the schema is unchanged, so `lib/supabase/database.types.ts` is not regenerated.

### Engine contract (`lib/engines/types.ts`, `lib/engines/index.ts`)

```ts
// lib/engines/types.ts
export type EnginePhase = "ready" | "playing" | "paused" | "over";

export type HudStat = { key: string; label: string; value: string }; // value already formatted, e.g. "4.2s"

export type EngineSnapshot = {
  phase: EnginePhase;
  score: number;
  level: number;
  lives: number | null; // null = the game has no lives; the HUD hides the stat
  extras: HudStat[]; // game-specific HUD stats, in display order; [] when none
};
// EngineCallbacks, GameEngine, EngineFactory unchanged.

// lib/engines/index.ts
export type EngineEntry = {
  factory: EngineFactory;
  controls: string; // one-line legend
};
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroids: { factory: createAsteroids, controls: "← → ROTATE · ↑ THRUST · SPACE FIRE · P PAUSE" },
  tetris: { factory: createTetris, controls: "← → MOVE · ↑ ROTATE · ↓ SOFT DROP · SPACE DROP · P PAUSE" },
};
```

- `lib/engines/asteroids.ts`: the snapshot emits `lives` as a number and `extras: tripleShot > 0 ? [{ key: "triple", label: "3X", value: `${tripleShot.toFixed(1)}s` }] : []`. Snapshot diffing compares `extras` by value (key, label, value), not by reference.
- `app/games/[id]/play/actions.ts` needs no change (`!ENGINES[gameId]` still works). `app/games/[id]/play/page.tsx` is checked for any use of the factory type.

### Tetris engine (`lib/engines/tetris.ts`)

```ts
export const createTetris: EngineFactory;
```

- Logical size `W = 800`, `H = 600`. Backing store `800·dpr × 600·dpr`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
- The well is drawn at scale 1: `COLS × BLOCK = 300` wide, `ROWS × BLOCK = 600` high, at `x = 250, y = 0` (centred). The NEXT preview (4×4 cells of 30 px, 120×120) sits in the right side space at `x = 590, y = 60`, with the English label `NEXT` above it. The left side space stays empty.
- Constants copied from the reference and not changed:
  - `COLS` 10, `ROWS` 20, `BLOCK` 30.
  - `PIECES` 1–8 exactly as in `game.js`: I `4×4`, O `2×2`, T, S, Z, J, L `3×3`, nut `[[8,8,8],[8,0,8],[8,8,8]]`.
  - Piece choice: uniform `Math.floor(Math.random() * 8) + 1` (no bag). Spawn at `x = floor(COLS/2) − floor(width/2)`, `y = 0`.
  - Rotation: clockwise only (`rotateCW`, transpose + reverse); wall kicks tried in order `[0, −1, 1, −2, 2]`; no vertical kicks.
  - `LINE_SCORES` `[0, 100, 300, 500, 800]`, multiplied by the level **before** the lines are added.
  - Level `floor(lines / 10) + 1`, recomputed only after a clear. Gravity `dropInterval = max(100, 1000 − (level − 1) × 90)` ms, 1000 ms at level 1.
  - Gravity accumulator: when `dropAccum ≥ dropInterval` it resets to 0 and the piece falls one row, or locks if blocked. No lock delay: a blocked soft drop or gravity step locks at once.
  - Ghost piece: lowest non-colliding `y` for the current piece, drawn at `globalAlpha = 0.2`.
- Scoring:

  | Event                          | Points                          |
  | ------------------------------ | ------------------------------- |
  | Soft drop (`↓`) one row        | +1                              |
  | Hard drop (`Space`)            | +2 per row fallen               |
  | Clear 1 / 2 / 3 / 4 lines      | 100 / 300 / 500 / 800 × level   |

  All-Tetris play scores about `1000 · L²` by level L, so 10,000,000 needs roughly level 100 (1,000 lines) at the 100 ms gravity floor, which no human reaches. The engine still clamps `score` to `10_000_000` after every addition, so a run can always be saved under the `0..10000000` CHECK.
- Snapshot: `lives: null`; `level` from the engine; `extras: [{ key: "lines", label: "LINES", value: String(lines) }]` (always present, `"0"` at start). The existing default `.hud-stat .v` cyan applies; no new HUD CSS.
- `dt` is capped at 50 ms (the reference is uncapped; at 60 fps this changes nothing, it only prevents a burst after a hitch).
- All state (`board`, `current`, `next`, score, lines, level, `dropAccum`, `dropInterval`, phase) lives in the factory closure. Helpers take the board / piece they need. Module-level `const` only for constants. Comments are in English.

Neon palette (the four `:root` tokens in `app/globals.css` plus the extra hues already used by `.cover-tetro`):

| Element                         | Color                                      |
| ------------------------------- | ------------------------------------------ |
| I                               | cyan `#00f5ff`                             |
| O                               | yellow `#f5ff00`                           |
| T                               | purple `#aa00ff`                           |
| S                               | green `#00ff88`                            |
| Z                               | magenta `#ff006e`                          |
| J                               | blue `#3d7bff`                             |
| L                               | orange `#ff7700`                           |
| Nut                             | grey `#9e9e9e`                             |
| Ghost                           | piece colour at `globalAlpha = 0.2`        |
| Well border, NEXT box, `NEXT`   | cyan `#00f5ff` stroke with glow            |
| Grid lines                      | `rgba(0, 245, 255, 0.08)`, 0.5 px, no glow |
| Background                      | `#000`                                     |

Blocks keep the reference look (1 px inset, 4 px highlight strip `rgba(255,255,255,0.12)`). Glow (`shadowBlur`, same colour) goes on the active piece and the well / NEXT strokes; locked cells draw without blur if frame time suffers.

## Behavior

### Input (engine)

- `keydown` / `keyup` on `window`, added in the factory and removed in `destroy()`. The reference's `document` listener, restart button and theme toggle are not ported.
- Events from `input`, `textarea` or `[contenteditable]` are ignored.
- In `ready`, `playing` and `paused`, `preventDefault()` on `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` and `Space`.
- `ready`: `Space` → `start()`. The same press does not hard-drop.
- `playing`: `←` / `→` move one column if free; `↑` or `X` rotate clockwise with wall kicks; `↓` soft drop; `Space` hard drop. Each `keydown` (including OS key-repeat) is one action, as in the reference. `P` / `Escape` → `pause()`.
- `paused`: `P` / `Escape` → `resume()`.
- `over`: no keys are handled. PLAY AGAIN restarts.
- `window` `blur` and `document` `visibilitychange` (hidden) → `pause()`. Held keys are cleared on pause.

### Loop (engine)

- A single `requestAnimationFrame` loop starts in the factory and draws in every phase. `dt` capped at 50 ms.
- `ready`: the empty well with its grid and an empty NEXT box; no pieces. `paused` and `over`: last frame frozen.
- `start()` / `restart()`: fresh board, score 0, lines 0, level 1, `dropInterval` 1000, `dropAccum` 0, a new `next`, then spawn.
- `lastTime` resets on `start()`, `resume()`, `restart()`.
- The run ends (`over`, `onChange` fires) when a newly spawned piece collides at its spawn position (top-out). There is no win condition. END ends the run at any time.

### Player (`components/game-player.tsx`)

- `const entry = ENGINES[game.id]; const factory = entry?.factory;` → `<GameCanvas factory={entry.factory} …>`.
- The ready overlay and the `.crt-bottom` legend use `entry.controls`. The `CONTROLS` constant is deleted.
- `snapshot.extras` render as `hud-stat` items after Level, class from `key` (`hud-stat triple`, `hud-stat lines`). The `tripleShot` read is deleted.
- The Lives stat is hidden when `lives === null`. Simulated games keep their current behaviour (three hearts, fake arena).
- Everything else (pause overlay, END, PLAY AGAIN, button blur, save flow) is unchanged.

## Files

| File                                                      | Kind         | Purpose                                                  |
| --------------------------------------------------------- | ------------ | -------------------------------------------------------- |
| Supabase migration `replace_falldown_with_tetris`         | new (remote) | Delete `falldown`, insert `tetris`                       |
| `supabase/migrations/<version>_replace_falldown_with_tetris.sql` | new   | Mirror of the applied SQL                                |
| `lib/engines/types.ts`                                    | modified     | `HudStat`, generic `EngineSnapshot`                      |
| `lib/engines/index.ts`                                    | modified     | `EngineEntry`; Asteroids entry; register `tetris`        |
| `lib/engines/asteroids.ts`                                | modified     | Emit `extras` instead of `tripleShot`                    |
| `lib/engines/tetris.ts`                                   | new          | `createTetris` (the port)                                |
| `components/game-player.tsx`                              | modified     | Extras, nullable lives, per-game controls                |
| `lib/home-content.ts`                                     | modified     | Ticker `falldown` → `tetris`                             |
| `CLAUDE.md`                                               | modified     | Migration list                                           |

`references/started-games/03-tetris/` is read only and is not modified. No assets are copied (the reference has none).

## Implementation plan

Use the `/frontend-design` skill for the UI steps. Before writing client components, check `node_modules/next/dist/docs/` (`01-app/`).

0. Generalize the engine contract (`types.ts`, `index.ts`, `asteroids.ts`, `game-player.tsx`) and migrate Asteroids to it. Verify: `npx tsc --noEmit` passes; `/games/asteroids/play` looks and plays exactly as before (3X stat, hearts, legend, saving).
1. Apply `replace_falldown_with_tetris` with the Supabase MCP, read its version with `list_migrations`, and mirror the exact SQL in `supabase/migrations/`. Update `lib/home-content.ts`. Verify: `execute_sql` shows `tetris` at `sort_order` 2 and no `falldown`; `/games` shows the TETRIS card with `cover-tetro`; `/games/falldown` is a 404.
2. Create `lib/engines/tetris.ts`: constants, pieces, `collide`, `rotateCW`, wall kicks, merge, line clear, ghost, drawing of the well, grid, blocks and NEXT with the neon palette and HiDPI setup. Verify: `npx tsc --noEmit` passes.
3. Finish `createTetris`: closure state, phases, input, loop, score clamp, snapshot diffing, `destroy()`. Register it in `ENGINES`. Verify: `/games/tetris/play` shows the empty well and the ready overlay, and Space starts a run.
4. Verify the acceptance criteria below, by hand.
5. Update `CLAUDE.md` (migration list: `replace_falldown_with_tetris` — swaps the FALLDOWN placeholder for the real Tetris row). Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] `/games` shows a TETRIS card (PUZZLE, magenta, `cover-tetro`) in second place with the short copy "Fit the falling pieces and clear lines."; no FALLDOWN card remains.
- [ ] `/games/tetris` shows the new long copy, and PLAY NOW goes to `/games/tetris/play`. `/games/falldown` returns the 404 page. The home ticker shows no broken game link.
- [ ] `/games/tetris/play` loads with no console errors or hydration warnings and shows the empty well, an empty NEXT box and the ready overlay with `← → MOVE · ↑ ROTATE · ↓ SOFT DROP · SPACE DROP · P PAUSE`; the same legend is in the `.crt-bottom` slot.
- [ ] Space starts a run without hard-dropping the first piece. HUD shows score 0, level 01, LINES 0 and no Lives stat; a piece is in the well and another in NEXT.
- [ ] Arrow keys and Space never scroll the page in ready, playing or paused.
- [ ] `←` / `→` move one column and stop at the walls and stacks; `↑` and `X` rotate clockwise, and a piece against a wall still rotates when a ±1 or ±2 column kick fits.
- [ ] Each `↓` press that moves the piece adds exactly 1 point; a hard drop from row 0 to row 18 adds exactly 36 points and locks at once.
- [ ] The ghost piece shows where the current piece will land, at about 20% opacity, in the piece's colour.
- [ ] At level 1, clearing 1, 2, 3 and 4 lines adds exactly 100, 300, 500 and 800 points; at level 2 a single line adds 200.
- [ ] After 10 cleared lines the HUD shows level 02 and pieces fall visibly faster (900 ms per row instead of 1000 ms).
- [ ] The nut piece (grey hollow 3×3 ring) appears among the random pieces.
- [ ] Stacking to the top ends the run: the GAME OVER modal opens with the final score equal to the HUD score.
- [ ] `P`, `Esc` and PAUSE pause; `P`, `Esc` and RESUME resume with no sudden drop; switching tabs and coming back leaves it paused.
- [ ] END opens the GAME OVER modal at any point of a run. Typing initials (letters, `X`, Space) in the modal does not affect the game.
- [ ] PLAY AGAIN starts a fresh run right away (score 0, level 01, LINES 0, empty well, no ready screen). After clicking PAUSE then RESUME with the mouse, Space hard-drops instead of re-clicking.
- [ ] EXIT and coming back (also in `npm run dev` Strict Mode): pieces fall at 1 row per second at level 1 and each key press moves once — one loop, one set of listeners.
- [ ] The canvas has no score / level / lines text, no pause or game-over overlay and no Spanish text; the only text is `NEXT`. It is sharp at DPR 2; at 375 px width the CRT fits with no horizontal scroll and the ready overlay shows `KEYBOARD REQUIRED` under touch emulation.
- [ ] Saving as `TEST_1` shows `▸ SCORE SAVED — RANK #NN_`; `/games/tetris` and the Hall of Fame TETRIS tab show the row; the TETRIS card's best equals the top score.
- [ ] Asteroids is unchanged: the 3X stat appears and counts down from 5.0s, hearts show and drop, the legend reads `← → ROTATE · ↑ THRUST · SPACE FIRE · P PAUSE`, and saving works.
- [ ] Every other simulated game (e.g. `/games/block-buster/play`) still shows the fake arena, three hearts and `SCORES NOT RECORDED FOR THIS DEMO`.
- [ ] `references/started-games/03-tetris/` has no changes in `git status`.

## Decisions taken and discarded

| Decision         | Chosen                                                                   | Discarded                                         | Why                                                                                    |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Engine contract  | Generalize now (Step 0): `lives: number \| null`, `extras`, `{ factory, controls }` | Per-game fields in `EngineSnapshot`       | Every future game plugs in without touching `GamePlayer`.                              |
| Catalog entry    | Replace `falldown` with `tetris` at `sort_order` 2 (delete + insert)     | Keep id `falldown`; add a 9th row                 | The game is Tetris; a second falling-blocks card would confuse. `falldown` had 0 scores. |
| Title            | TETRIS                                                                   | FALLDOWN                                          | Matches the reference, as ASTEROIDS did.                                               |
| Copy             | New copy naming the 7 tetrominoes, the nut, ghost and 10-line levels     | Keep the FALLDOWN copy                            | Describes exactly what the reference does.                                             |
| Look             | PUZZLE · magenta · `cover-tetro` reused                                  | Cyan accent; a new cover                          | No visual churn; the cover already shows tetrominoes.                                  |
| Old URL          | `/games/falldown` 404s                                                   | Redirect                                          | Same as SPEC 05; no external links.                                                    |
| Gameplay         | Everything verbatim, including the nut piece and uniform random choice   | Drop the nut; 7-bag; lock delay                   | The spec must match the reference code, not the README's "7 pieces".                   |
| Score bound      | Clamp at 10,000,000 in the engine                                        | No clamp                                          | Keeps any run saveable under the DB CHECK; unreachable in practice.                    |
| `dt`             | Capped at 50 ms                                                          | Uncapped as in the reference                      | Platform rule; no visible change at 60 fps.                                            |
| Palette          | Neon remap with glow (site tokens + `.cover-tetro` hues)                 | Reference pastels                                 | Matches the site's CRT/neon look.                                                      |
| HUD extras       | LINES as a React extra; no Lives stat                                    | Lives shown as `—`                                | The game has no lives.                                                                 |
| NEXT preview     | Drawn on the canvas in the right side space                              | React preview; drop it                            | The canvas has 250 px free per side; needs no non-numeric extra in the contract.       |
| Input            | Reference keys as is (`↑`/`X` rotate, `Space` hard drop), OS key-repeat  | Drop `X`; custom DAS                              | Fidelity; Space only starts from `ready` and only drops in `playing`.                  |
| Ready screen     | Static empty well                                                        | Attract mode                                      | The reference has none; nothing invented.                                              |
| End of run       | Top-out → existing GAME OVER modal                                       | Custom title (TOP OUT)                            | No contract change needed; no win condition exists.                                    |
| Theme toggle     | Removed                                                                  | Port light mode                                   | The site has one dark neon theme.                                                      |
| Assets / sound   | None (the reference has no sprites or sounds)                            | —                                                 | Nothing to copy.                                                                       |

## Identified risks

| Risk                                                              | Mitigation                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Strict Mode double mount creates two loops or duplicate listeners | All state in the factory closure; `destroy()` idempotent and removes every listener; acceptance criterion for it. |
| Game keys (Space, `X`, arrows) break typing in the modal          | Events from inputs are ignored and `over` handles no keys.                                                        |
| The Space that starts a run also hard-drops                       | `ready` handles Space as `start()` only; acceptance criterion for it.                                             |
| Step 0 regresses Asteroids                                        | Acceptance criterion replays Asteroids end to end (3X, hearts, legend, saving).                                   |
| `extras` array identity triggers a re-render every frame          | Snapshot diffing compares extras by value.                                                                        |
| Replacing the placeholder drops its scores                        | `falldown` had 0 scores; stated in Data model.                                                                    |
| `shadowBlur` on up to 200 locked cells is slow                    | Glow on the active piece and outlines only; locked cells may draw without blur.                                   |

## What is **not** in this spec

- Sound.
- Touch controls.
- Hold piece, 7-bag, lock delay, T-spins, combos or any other gameplay change.
- The light/dark theme toggle.
- A redirect for `/games/falldown`.
- Engines for other games.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
