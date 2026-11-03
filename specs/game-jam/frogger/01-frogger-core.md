# SPEC — Frogger: Core Game Integration

> **Status:** Approved
> **Depends on:** 06-games-table-and-leaderboards, 11-touch-controls
> **Date:** 2026-05-20
> **Objective:** Integrate Frogger (pure canvas, built from scratch) as a playable game in Arcade Vault with ID `frogger`, connecting score, lives, level, and game over to the shared player and its leaderboards.

---

## Scope

**In scope:**

- Migration `replace_froggeria_with_frogger`: replaces the FROGGERIA placeholder with the `frogger` row, same `sort_order` 7.
- Create `lib/engines/frogger.ts` — a framework-free `GameEngine` (`createFrogger`) drawing a 640 × 560 logical canvas, registered in `ENGINES` with its `controls` legend and touch `pad`.
- Game loop built from scratch inside the engine: a grid of 16 columns × 14 rows of 40 × 40 px. The map is divided into fixed zones: start row (row 13), road (rows 12–8, 5 traffic lanes), middle safe row (row 7), river (rows 6–1, 6 river lanes), and goals (row 0, 5 goal slots).
- Road entities: cars and trucks of different lengths (1–3 cells), speeds, and directions per lane; they move horizontally in a continuous loop; collision with the frog is fatal.
- River entities: logs (2–4 cells long) and turtles (groups of 2–3) per lane; they move horizontally. The frog survives in the river only when standing on a log or visible turtles; falling into the water kills it. Turtles can periodically submerge (visible → underwater → visible); while submerged, they cannot support the frog.
- Frog movement: discrete 1-cell (40 px) hops in 4 directions (↑ ↓ ← →); each keypress moves the frog exactly one cell after a 120 ms hop animation completes. The frog cannot move beyond the lateral boundaries.
- Goal reached: the frog reaches one of the 5 goal slots in the top row (each slot occupies 2 of the 16 columns). An occupied slot cannot be used again in the same round. Filling all 5 slots completes the round and starts the next one.
- Death conditions: (a) vehicle collision, (b) falling into water, (c) the supporting turtle submerging, (d) moving beyond the left/right river boundaries, (e) running out of round time (initially 15 s, reduced at higher levels).
- Lives system: the frog starts with 3 lives. Each death subtracts 1 life and is reported through `onChange`. At 0 lives the phase becomes `over`.
- Scoring: +10 points for each cell moved upward for the first time in the round; +50 points for occupying a goal slot; +200 points for completing a round; +time bonus = `remaining_time × 10` when occupying a slot.
- Round timer visible in the HUD: 15 s at level 1, 1 s less per level, down to a minimum of 8 s. It resets for each frog: after a death, a filled slot or a completed round. A filled slot also returns the frog to the start row.
- Internal canvas HUD alongside the React HUD: time bar as a thin strip along the top edge of row 0; score, level and lives as frog icons overlaid on the safe rows so they never cover the lanes.
- The `paused` phase freezes `update()` but continues calling `draw()`.
- `destroy()` cancels the loop and removes every listener.
- Play through the shared `/games/[id]/play` player, which supplies the HUD, pause and game-over screens and saves through the `saveScore` Server Action.
- Touch controls through the `pad` entry (four directions) and the shared `press()` path.

**Out of scope:**

- External bitmap sprites — all elements are drawn with canvas primitives (rectangles, arcs, composite shapes) using themed colors; no images are loaded.
- Elaborate death animations (explosions, particles) — covered in a secondary spec.
- Special power-ups (fly in a goal slot, crocodile disguised as a log) — covered in a secondary spec.
- Supabase Auth.
- Realtime leaderboard updates.
- Generic `CanvasGame` component (YAGNI).

---

## Data model

### Migration `replace_froggeria_with_frogger`

```sql
delete from public.games where id = 'froggeria';

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('frogger', 'FROGGER', 'Cross the road and river without getting squashed.', 'Guide your frog across a road packed with cars and a river full of floating logs and turtles. Fill the five goal slots on the other side to complete the round; each level speeds up traffic and shortens the time limit. Three lives and plenty of asphalt ahead.', 'ARCADE', 'cover-rana', 'green', 7);
```

### Engine state

A run starts with `lives = 3`, `score = 0`, `level = 1`. `onChange(EngineSnapshot)` reports `phase`, `score`, `level`, `lives` and a `TIME` extra, only when one of them changed.

No new tables are introduced.

---

## Implementation plan

1. **Apply the migration** from the data model with `apply_migration` and mirror it in `supabase/migrations/`.
   Verification: the `frogger` row is in the `games` table; `/games` displays the card with cover `cover-rana` and color `green`.

2. **Define constants and types** inside `lib/engines/frogger.ts`:

   ```ts
   const COLS = 16;
   const ROWS = 14;
   const CELL = 40; // px
   const CANVAS_W = COLS * CELL; // 640 — board width; centred in the 800 × 600 canvas
   const CANVAS_H = ROWS * CELL; // 560, board height
   // Zones (row index, 0 = top)
   const ROW_GOALS = 0;
   const ROW_RIVER_TOP = 1;
   const ROW_RIVER_BOT = 6;
   const ROW_SAFE_MID = 7;
   const ROW_ROAD_TOP = 8;
   const ROW_ROAD_BOT = 12;
   const ROW_START = 13;
   ```

   Local types (not exported):

   ```ts
   type Direction = 'up' | 'down' | 'left' | 'right';
   interface Lane {
     row: number;
     speed: number;
     dir: 1 | -1;
     entities: Entity[];
   }
   interface Entity {
     col: number;
     width: number;
     type: 'car' | 'truck' | 'log' | 'turtle';
     submerged?: boolean;
     cycleT?: number;
   }
   interface Frog {
     col: number;
     row: number;
     animating: boolean;
     animT: number;
     targetCol: number;
     targetRow: number;
   }
   ```

3. **Build the lane map** — `buildLanes(level: number): Lane[]` function:
   - Road lanes (rows 8–12): speeds between 1.5 and 4 px/frame (scaled by level); alternating directions; pre-populated entities with gaps so the frog can cross.
   - River lanes (rows 1–6): speeds between 1 and 3 px/frame; logs 2–4 cells long with gaps of at least 1 cell; groups of 2–3 turtles with a submersion cycle of 3 s visible / 1.5 s underwater.
   - Each level increases all speeds by 15%.
     Verification: when printing the `lanes` array to the console, each lane has at least 2 entities and the gaps are visible.

4. **Main game loop** using `requestAnimationFrame`:
   - `update(dt: number)`:
     - Runs only in the `playing` phase.
     - Advance each entity along its lane (`entity.col += lane.speed * lane.dir * dt / 16 / CELL`, since speeds are px/frame and `col` is in cells); when an entity leaves the boundary, reintroduce it on the opposite side (`col = -entity.width` or `col = COLS`).
     - If the frog is not animating: check input (`pendingDir`); if a direction is pending, start the animation (`animating = true`, `animT = 0`, calculate `targetCol/targetRow`).
     - If the frog is animating: advance `animT += dt`; if `animT >= 120`, complete the hop (`col = targetCol`, `row = targetRow`, `animating = false`), then resolve destination-cell logic (death/goal/scoring detection).
     - If the frog is in the river and not animating: apply the horizontal movement of the entity supporting it (checked using `getSupport(frog, lanes)`).
     - Decrease the round timer; if it reaches 0, the frog dies due to timeout.
     - Emit a snapshot through `onChange` only if a value differs from its previous value.

   - `draw()`:
     - Zone backgrounds: black for the road, dark blue for the river, dark green for safe rows, light green for goal slots.
     - Draw entities in each lane: cars (red/yellow/blue rectangles with circular wheels), trucks (gray rectangles with distinct cabs), logs (brown rectangles with line textures), visible turtles (green circles with a scale pattern), submerged turtles (semi-transparent outlines).
     - Draw the frog: bright green body (28×24 px ellipse) with white/black eyes (two circles), legs extended during the hop animation.
     - Draw goal slots: dark green goal rectangles with gold borders; if occupied, draw a frog silhouette inside.
     - Internal HUD on the safe rows: score left (white 16 px font), level center, frog icons right (one green circle per life). Time bar: thin strip along the top edge of row 0, width proportional to remaining time, color green → yellow → red.

5. **Collision and support detection**:
   - `checkRoadCollision(frog, lanes)`: iterate over road-lane entities; return `true` if the frog's centre (`frog.col + 0.5`) is within `[entity.col, entity.col + entity.width)` and `frog.row === lane.row`.
   - `getSupport(frog, lanes)`: iterate over river-lane entities; return the entity whose range covers the frog's centre in the same lane, or `null`. If the entity is a turtle with `submerged === true`, return `null` (no support).
   - `checkGoal(frog, goals)`: if `frog.row === ROW_GOALS`, determine which goal slot corresponds to the frog's centre; if unoccupied, mark it and award points; if already occupied or `frog.col` does not correspond to a slot, the frog dies.

6. **Completed-round handling** — `completeRound()`:
   - Reset the frog's position to `ROW_START`, center column.
   - Clear occupied goal slots.
   - Increment `level`.
   - Rebuild lanes with `buildLanes(level)`.
   - Reset the timer.

7. **Death handling** — `killFrog()`:
   - Decrement `lives`.
   - If `lives === 0`: the phase becomes `over`.
   - If `lives > 0`: reset the frog's position to `ROW_START`, center column; reset the timer.

8. **Register the engine** in `ENGINES` (`lib/engines/index.ts`): `factory: createFrogger`, a `controls` legend, and a `pad` with up, down, left and right.
   Verification: `/games/frogger/play` runs the real game, the React HUD reflects score, lives, and level in real time, and a finished run saves through `saveScore`.

9. **Final verification** — `npm run build` finishes without TypeScript errors. No existing route returns HTTP 500.

---

## Acceptance criteria

- [ ] The `frogger` row exists in the Supabase `games` table with the values from the data model.
- [ ] The Frogger card appears at `/games` with cover `cover-rana` and color `green`.
- [ ] The `/games/frogger/play` route loads without SSR or TypeScript errors.
- [ ] The 640 × 560 board renders centred in the 800 × 600 canvas, undistorted, with visually distinct zones (road, river, safe areas, goal slots).
- [ ] The frog appears centered in the starting row when the game loads.
- [ ] The frog hops exactly one cell (40 px) per directional keypress with a 120 ms animation.
- [ ] The frog cannot move beyond the lateral boundaries.
- [ ] Cars and trucks move horizontally in loops along their lanes; they reappear on the opposite side after leaving the screen.
- [ ] Logs and turtles move horizontally in loops along their lanes.
- [ ] Turtles alternate between visible and submerged states according to the defined cycle.
- [ ] The frog dies when hit by a road vehicle.
- [ ] The frog dies when it falls into the water (not standing on a log or visible turtles).
- [ ] The frog dies when the turtle supporting it submerges.
- [ ] The frog dies when the round timer expires.
- [ ] On death, the lives shown drop by 1; the frog returns to the starting row.
- [ ] On reaching an empty goal slot, the slot is marked and bonus points are awarded.
- [ ] On reaching an already occupied goal slot, the frog dies.
- [ ] After filling all 5 goal slots, the round ends and the next one begins with an incremented `level`.
- [ ] The HUD level updates when each new round begins.
- [ ] Entity speed increases with each level.
- [ ] The round timer decreases with each level.
- [ ] The HUD score updates on every score change.
- [ ] The internal canvas HUD (score, level, life icons, time bar) renders correctly.
- [ ] The platform's React HUD reflects score, lives, and level in real time.
- [ ] The platform's "PAUSE" button freezes the game loop; "RESUME" restarts it.
- [ ] The P / Esc keys pause and resume through the shared player.
- [ ] The touch pad's four directions hop the frog on coarse pointers.
- [ ] When `lives = 0`, the phase becomes `over` and the shared game-over modal appears.
- [ ] Confirming the name saves the score through `saveScore`, once.
- [ ] The "PLAY AGAIN" button restarts the game from scratch.
- [ ] The saved score appears at `/games/frogger` and `/hall-of-fame` after reloading.
- [ ] `npm run build` completes without TypeScript errors.
- [ ] No existing route returns HTTP 500.

---

## Decisions

- **Yes: Canvas primitives without bitmap sprites** — cars, trucks, logs, turtles, and the frog are drawn with canvas geometric shapes and themed colors. Reason: no Frogger assets exist in the repository; drawing them in code eliminates image-loading dependencies and allows visual adjustments without external files.

- **Yes: Discrete 40 px grid with 120 ms hop animation** — frog movement is cell-by-cell, not continuous. Reason: canonical Frogger mechanics; discrete movement greatly simplifies collision and river-support detection by comparing integer rows/columns.

- **Yes: Dual HUD** — the canvas retains its internal HUD and React displays the same values in the platform HUD. Reason: consistency with the established pattern across all platform games.

- **Yes: 3 lives** — the original Frogger starts with 3 lives. `onLivesChange` reports each loss. Reason: faithful to the classic mechanics; consistent with Arkanoid and Space Invaders.

- **Yes: Turtles with a submersion cycle** — they alternate between support and danger using an independent timer per group. Reason: a defining Frogger mechanic compared with a river containing only logs; adds risk management without excessive implementation complexity.

- **Yes: Round timer** — initially 15 s, reduced at higher levels. Timeout deaths add urgency. Reason: original Frogger mechanic; prevents players from waiting indefinitely in the safe zone.

- **Yes: 5 goal slots** — all must be filled to complete the round. Reason: an original mechanic that provides a clear objective for each round rather than a single linear level.

- **Yes: 640 × 560 px board (16 × 14 cells of 40 px) centred in an 800 × 600 logical canvas** — margins of 80 px left and right, 20 px top and bottom. Discarded: a 480 × 640 canvas, which cannot fit 16 columns of 40 px; stretching 640 × 560 to the CRT, which distorts cells by 18%; and a per-game 8:7 CRT. Reason: `.crt-screen` is 4:3 and Snake and Tetris use 800 × 600.

- **Yes: Engine on the shared player** — `lib/engines/frogger.ts` with an `ENGINES` entry. Discarded: a `FroggerGame.tsx` component with a dedicated page. Reason: `saveScore` rejects games without an `ENGINES` entry, `skin-designer` skips them, and every real game uses this pattern.

- **Yes: Touch pad entry** — four directions on the shared pad. Discarded: leaving touch out of scope. Reason: without it the game is unplayable on phones, and it takes a few lines.

- **Yes: Replace the FROGGERIA placeholder, reusing `cover-rana` and `green`** — Discarded: a new row beside it, and `lime` with `cover-frogger`. Reason: two Frogger games would duplicate the catalog, FROGGERIA had 0 scores, and `lime` fails the `games.color` CHECK.

- **No: Continuous (interpolated) movement** — the frog does not slide; it hops from cell to cell. Reason: continuous interpolation would require AABB collision detection in continuous space for the river and road, increasing complexity without adding fun.

- **No: Crocodile disguised as a log or bonus fly in goal slots** — covered in the secondary power-ups and events spec. Reason: these are difficulty and reward layers independent of the core mechanics.

- **No: Generic `CanvasGame` component** — each game has its own engine. Reason: YAGNI.

- **No: Realtime leaderboards** — scores become visible on reload. Reason: subscription complexity provides little value while there are few active players.

