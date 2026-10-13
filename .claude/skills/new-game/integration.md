# Platform integration guide

Everything a reference game needs to become a real Arcade Vault game. It condenses SPEC 05 (Asteroids engine) and SPEC 06 (games table and leaderboards). When this file and the code disagree, the code wins — re-read the files named below and update this guide.

## Fixed by the platform (do not ask, just write it into the spec)

- Engine factory, no globals, React owns HUD / pause / game over (SPEC 05).
- Phases `ready | playing | paused | over`; Space starts from `ready`; `P` / `Esc` pause and resume; window blur and hidden tab pause; PLAY AGAIN restarts and skips the ready screen; the `over` phase handles no keys.
- Scores are saved by the existing `saveScore` Server Action as soon as the game is in `ENGINES` (it gates on `ENGINES[gameId]`). No change to `actions.ts`, `lib/catalog.ts`, leaderboards or Hall of Fame is needed.
- Catalog changes only through a Supabase migration. No write path in the app.
- Touch controls are out of scope; the ready overlay shows `KEYBOARD REQUIRED` on coarse pointers (already in `GamePlayer`).
- Automated tests are out of scope (no runner configured).
- `references/started-games/<folder>/` is read only.

## Engine rules (`lib/engines/<id>.ts`)

- Export `create<Name>: EngineFactory`. **No module-level mutable state**: entities, input state, score, timers all live in the factory closure. Classes receive `ctx` or the state they need. Module-level `const` for constants is fine.
- **Gameplay constants are copied verbatim** from the reference unless the spec records a deliberate change. List them in the spec's Data model.
- Logical resolution **800×600** (`.crt-screen` is 4:3). Backing store `800·dpr × 600·dpr`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`. A reference with another size or aspect (Tetris 300×600) is **centred** inside 800×600, scaled by an integer or fixed factor stated in the spec; side space can hold canvas-drawn extras such as a NEXT preview.
- Canvas draws **only the playfield**: no score / lives / level text, no PAUSE / GAME OVER / WIN overlays, no non-English text, no `alert`.
- Neon palette, hex copied from `:root` in `app/globals.css`: cyan `#00f5ff`, magenta `#ff006e`, yellow `#f5ff00`, green `#00ff88`, background `#000`. Glow via `shadowBlur` with the same colour, on strokes (drop it on particles if frame time suffers). The spec includes an element → colour table. Sprite-based games keep their sprites unless the user chose a neon redraw.
- **One** `requestAnimationFrame` loop started in the factory, drawing in every phase. `dt` capped at 50 ms (or the reference's own cap). `lastTime` resets on `start`, `resume`, `restart`. `ready` shows an attract mode or a static playfield; `paused` and `over` freeze the last frame.
- `onChange(snapshot)` fires only when a field actually changed — never every frame. Round timers (e.g. to 0.1 s).
- Input:
  - `keydown` / `keyup` on `window`, added in the factory, removed in `destroy()`.
  - Ignore events whose target is `input`, `textarea` or `[contenteditable]` (the modal initials input).
  - `preventDefault()` on the game's keys (arrows, Space, …) only in `ready | playing | paused`.
  - Clear held keys on pause.
  - Mouse input (e.g. Arkanoid paddle): listener on the canvas, map client → logical coords with `getBoundingClientRect()` and 800×600, remove it in `destroy()`.
  - Remove the reference's own restart key (PLAY AGAIN owns restart) and any debug keys (e.g. level jump) unless the spec keeps them.
- Assets: images under `public/games/<id>/`, loaded with `new Image()` inside the factory; draw nothing sprite-based until loaded (or show the ready screen only after load). No sounds unless the spec opts in.
- `destroy()` cancels rAF, removes **every** listener (window, document, canvas), and is idempotent. This is what makes Strict Mode's double mount safe.
- Comments in English.

## Generic contract (target state)

SPEC 05 shipped an Asteroids-shaped contract (`tripleShot` in the snapshot, a hardcoded `CONTROLS` string in `GamePlayer`, `ENGINES` mapping id → bare factory). The **first** game spec written by this skill generalizes it as its Step 0; later specs only add an entry.

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
  controls: string; // one-line legend, e.g. "← → ROTATE · ↑ THRUST · SPACE FIRE · P PAUSE"
};
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroids: { factory: createAsteroids, controls: "← → ROTATE · ↑ THRUST · SPACE FIRE · P PAUSE" },
};
```

Step 0 changes, and nothing else:

- `lib/engines/types.ts` and `lib/engines/index.ts` as above.
- `lib/engines/asteroids.ts`: snapshot emits `lives` as a number and `extras: tripleShot > 0 ? [{ key: "triple", label: "3X", value: "4.2s" }] : []`; diffing compares extras by value.
- `components/game-player.tsx`: `const entry = ENGINES[game.id]; const factory = entry?.factory;` → `<GameCanvas factory={entry.factory} …>`; ready overlay and `.crt-bottom` legend use `entry.controls`; renders `snapshot.extras` as `hud-stat` items (class from `key`, e.g. `hud-stat triple`); hides Lives when `lives === null`. The `CONTROLS` constant and `tripleShot` reads are deleted.
- `app/games/[id]/play/actions.ts` needs no change (`!ENGINES[gameId]` still works). `app/games/[id]/play/page.tsx`: check for any use of the factory type.
- Acceptance: Asteroids looks and plays exactly as before (3X stat appears and counts down, hearts, legend).

## Per-game integration checklist

| #   | Item                  | Where                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Engine port           | `lib/engines/<id>.ts` (+ `lib/engines/<id>-levels.ts` if the reference has level data) | Rules above                                                                                                                                                                                                                                                                                                                                                          |
| 2   | Registry entry        | `lib/engines/index.ts`                                                                 | `{ factory, controls }`                                                                                                                                                                                                                                                                                                                                              |
| 3   | Catalog migration     | MCP `apply_migration`, mirrored in `supabase/migrations/<version>_<name>.sql`          | Version from `list_migrations` after applying; file content = exact SQL applied. Name: `replace_<old>_with_<id>` (UPDATE) or `add_<id>_game` (INSERT, next `sort_order`). Must satisfy the `games` CHECKs: `id ~ '^[a-z0-9-]+$'`, `cat in (ARCADE, PUZZLE, SHOOTER, VERSUS)`, `cover like 'cover-%'`, `color in (cyan, magenta, yellow, green)`, unique `sort_order` |
| 4   | Changing an id        | same migration                                                                         | `update public.games set id = …` fails while scores reference it; and `on delete cascade` drops the placeholder's scores if deleted. Placeholders only hold test scores — the spec states whether they are discarded. Prefer insert-new + delete-old in one migration, or keep the id                                                                                |
| 5   | Old-id references     | `lib/home-content.ts` (ticker `gameId`), any grep hit in `app/ components/ lib/`       | The old URL becomes a 404 (no redirect, as in SPEC 05)                                                                                                                                                                                                                                                                                                               |
| 6   | DB types              | `lib/supabase/database.types.ts`                                                       | Regenerate with MCP `generate_typescript_types` **only if the schema changed**; data-only migrations need nothing                                                                                                                                                                                                                                                    |
| 7   | Cover                 | `app/globals.css` `.cover-<x>`                                                         | Reuse the placeholder's class or add a new CSS-only cover (no images)                                                                                                                                                                                                                                                                                                |
| 8   | HUD / controls styles | `app/globals.css`                                                                      | Only if the new extras need a colour (`.hud-stat.<key> .v`)                                                                                                                                                                                                                                                                                                          |
| 9   | Assets                | `public/games/<id>/`                                                                   | Copied from the reference; the reference keeps its originals                                                                                                                                                                                                                                                                                                         |
| 10  | Score bound           | spec Data model                                                                        | Show the realistic max fits `0..10000000`                                                                                                                                                                                                                                                                                                                            |
| 11  | Docs                  | `CLAUDE.md` Supabase migration list                                                    | Add the new migration with a one-line description                                                                                                                                                                                                                                                                                                                    |

Score saving, leaderboards (`/games/<id>` top 10, `/hall-of-fame` top 12), `best` on cards, `revalidatePath` targets and the rate limit all come for free from SPEC 06.

## Verification checklist (adapt into acceptance criteria)

- `npx tsc --noEmit`, `npm run lint`, `npm run build` pass (build needs Supabase reachable).
- `/games` shows the new card with the agreed copy and cover; the old placeholder id (if replaced) 404s; home has no broken reference.
- `/games/<id>/play` loads with no console errors or hydration warnings and shows the ready overlay with the game's controls legend.
- Space starts a run; HUD shows score 0, the right lives (or none) and level 01, plus the agreed extras.
- Arrow keys / Space never scroll the page in ready, playing or paused.
- Each scoring rule adds the exact points from the reference (list them with numbers).
- Level progression, lose condition and (if any) win condition behave as in the reference / the spec.
- `P`, `Esc` and PAUSE pause; `P`, `Esc` and RESUME resume with no position jump; switching tabs leaves it paused.
- END opens GAME OVER at any time; losing ends the run with the HUD score.
- PLAY AGAIN starts a fresh run with no ready screen; after a mouse click on PAUSE/RESUME, Space acts in the game.
- EXIT and come back (also in `npm run dev` Strict Mode): normal speed, single input per key press — one loop, one set of listeners.
- The canvas has no HUD text, no overlays, no non-English text; it is sharp at DPR 2; at 375 px width it fits with no horizontal scroll.
- Saving as `TEST_1` shows `▸ SCORE SAVED — RANK #NN_`; `/games/<id>` and the Hall of Fame tab show the row; the card's best equals the top score.
- If Step 0 ran: Asteroids is unchanged (3X stat, hearts, legend, saving).
- Every other simulated game still shows the fake arena and `SCORES NOT RECORDED FOR THIS DEMO`.
- `git status` shows no changes under `references/started-games/`.
