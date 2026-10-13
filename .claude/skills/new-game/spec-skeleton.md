# SPEC <NN> — Playable <TITLE> game

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06<, SPEC NN (if a previous game spec introduced the generic contract)>
> **Date:** <YYYY-MM-DD from session context>
> **Objective:** Port the reference <TITLE> game (`references/started-games/<folder>/`) to a typed canvas engine and make it the real game at `/games/<id>/play`, listed in the catalog and saving scores to the real leaderboards.

## Why this spec exists

<!-- 1 paragraph: what the catalog shows today for this game (simulated placeholder or nothing), what the reference is (vanilla JS, globals, canvas HUD, language), and why it needs the SPEC 05 engine pattern. If Step 0 applies, say this spec also generalizes the Asteroids-shaped engine contract so every future game plugs in the same way. -->

## Scope

**In:**

<!-- Keep only what applies. -->

- <Step 0 only> Generalize the engine contract: `EngineSnapshot` with `lives: number | null` and `extras: HudStat[]`; `ENGINES` entries `{ factory, controls }`; `GamePlayer` renders extras and per-game controls; Asteroids migrated with no visible change.
- Catalog: <replace `<old-id>` with `<id>` | add `<id>` with `sort_order` <n>> through a migration, with copy that describes the real game.
- Port `<files>` to TypeScript as an engine factory with no module-level mutable state. The port covers <every mechanic: …>. Gameplay constants stay identical.
- Register `<id>` in `ENGINES`, so the existing `saveScore` and leaderboards work for it.
- HUD, ready screen, pause overlay and game over are React. The canvas draws only the playfield <and the NEXT preview, if agreed>. The reference's canvas HUD and overlays (<list>) are removed.
- HUD: score, level, <lives | no lives stat>, extras <list with labels>.
- Controls legend: `<controls string>`.
- <Assets: sprites copied to `public/games/<id>/`.>
- Neon palette on the canvas <or: original sprites>, crisp HiDPI rendering at a fixed 800×600 logical resolution <, playfield of WxH centred>.

**Out of scope (for future specs):**

- Sound. <unless opted in>
- Touch / on-screen controls.
- Gameplay changes beyond those listed in Decisions.
- <Dropped reference features, e.g. level-select in pause.>
- <A redirect from `/games/<old-id>` (it becomes a 404).>
- Real engines for other games.
- Automated tests (no test runner is configured).

## Data model

### Catalog migration `<migration_name>`

```sql
<exact SQL: update … / insert … (+ delete of the placeholder if decided)>
```

<If the id changes: what happens to the placeholder's scores, and the `lib/home-content.ts` change.>
<Schema unchanged → `database.types.ts` is not regenerated.>

### <Step 0 only> Engine contract (`lib/engines/types.ts`, `lib/engines/index.ts`)

```ts
<HudStat, EngineSnapshot, EngineEntry, ENGINES — from integration.md "Generic contract">
```

### <TITLE> engine (`lib/engines/<id>.ts`)

```ts
export const create<Name>: EngineFactory;
```

- Logical size 800×600; <playfield placement and scale>.
- Constants copied from the reference and not changed: <full list with values>.
- Scoring: <table: event → points>. Realistic max <n>, within the `0..10000000` CHECK.
- Snapshot: `lives` <n | null>, `extras` <list with format>.
- All state lives in the factory closure. Comments are in English.

Palette (hex values copied from `:root` in `app/globals.css`):

| Element | Color |
| ------- | ----- |
| <…>     | <…>   |

## Behavior

### Input (engine)

- `keydown` / `keyup` on `window` (<and `mousemove` on the canvas>), added in the factory and removed in `destroy()`.
- Events from `input`, `textarea` or `[contenteditable]` are ignored.
- In `ready`, `playing` and `paused`, `preventDefault()` on <keys>.
- `ready`: `Space` → `start()`.
- `playing`: <key → action list>. `P` / `Escape` → `pause()`.
- `paused`: `P` / `Escape` → `resume()`.
- `over`: no keys are handled. <The reference's restart key is removed; PLAY AGAIN restarts.>
- `window` `blur` and `document` `visibilitychange` (hidden) → `pause()`. Held keys are cleared on pause.

### Loop (engine)

- A single `requestAnimationFrame` loop starts in the factory and draws in every phase. `dt` capped at <50 ms>.
- `ready`: <attract mode / static board>. `paused` and `over`: last frame frozen.
- `lastTime` resets on `start()`, `resume()`, `restart()`.
- The run ends (`over`, `onChange` fires) when <lose condition> <or win condition>.

### Player (`components/game-player.tsx`)

- <Step 0 changes, or "No change: the generic contract already renders lives, extras and controls.">

## Files

| File                                       | Kind         | Purpose                                             |
| ------------------------------------------ | ------------ | --------------------------------------------------- |
| Supabase migration `<name>`                | new (remote) | Catalog row for `<id>`                              |
| `supabase/migrations/<version>_<name>.sql` | new          | Mirror of the applied SQL                           |
| `lib/engines/<id>.ts`                      | new          | `create<Name>` (the port)                           |
| `lib/engines/index.ts`                     | modified     | Register `<id>`                                     |
| <`lib/engines/types.ts`>                   | <modified>   | <Step 0: generic snapshot>                          |
| <`lib/engines/asteroids.ts`>               | <modified>   | <Step 0: emit `extras`>                             |
| <`components/game-player.tsx`>             | <modified>   | <Step 0: extras, nullable lives, per-game controls> |
| <`lib/home-content.ts`>                    | <modified>   | <old id → new id>                                   |
| <`app/globals.css`>                        | <modified>   | <cover / HUD extra styles>                          |
| <`public/games/<id>/…`>                    | <new>        | <sprites>                                           |
| `CLAUDE.md`                                | modified     | Migration list                                      |

`references/started-games/<folder>/` is read only and is not modified.

## Implementation plan

Use the `/frontend-design` skill for the UI steps. Before writing client components, check `node_modules/next/dist/docs/` (`01-app/`).

0. <Step 0 only> Generalize the engine contract and migrate Asteroids to it. Verify: `npx tsc --noEmit` passes; `/games/asteroids/play` looks and plays exactly as before (3X stat, hearts, legend, saving).
1. Apply the catalog migration with the Supabase MCP and mirror it in `supabase/migrations/`. Update old-id references and the cover. Verify: `execute_sql` shows the row; `/games` shows the <TITLE> card<; `/games/<old-id>` is a 404>.
2. Create `lib/engines/<id>.ts`: constants, entities and drawing <with assets>. Verify: `npx tsc --noEmit` passes.
3. Finish `create<Name>`: closure state, phases, input, loop, snapshot diffing, `destroy()`. Register it in `ENGINES`. Verify: `/games/<id>/play` shows the ready overlay and Space starts a run.
4. <HUD extras / styles, if any.> Verify: the acceptance criteria below, by hand.
5. Update `CLAUDE.md`. Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

<!-- Start from integration.md "Verification checklist", make every item concrete for this game (real points, real level rules). -->

- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] <…>
- [ ] `references/started-games/<folder>/` has no changes in `git status`.

## Decisions taken and discarded

| Decision          | Chosen                    | Discarded                             | Why                                                        |
| ----------------- | ------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Catalog entry     | <…>                       | <…>                                   | <…>                                                        |
| Gameplay          | <…>                       | <…>                                   | <…>                                                        |
| HUD extras        | <…>                       | <…>                                   | <…>                                                        |
| Input             | <…>                       | <…>                                   | <…>                                                        |
| End of run        | <…>                       | <…>                                   | <…>                                                        |
| Assets / sound    | <…>                       | <…>                                   | <…>                                                        |
| <Engine contract> | <Generalize now (Step 0)> | <Per-game fields in `EngineSnapshot`> | <Every future game plugs in without touching `GamePlayer`> |

## Identified risks

| Risk                                                              | Mitigation                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Strict Mode double mount creates two loops or duplicate listeners | All state in the factory closure; `destroy()` idempotent and removes every listener; acceptance criterion for it. |
| Game keys (<Space…>) break typing in the modal                    | Events from inputs are ignored and `over` handles no keys.                                                        |
| <Step 0 regresses Asteroids>                                      | <Acceptance criterion replays Asteroids end to end.>                                                              |
| <Replacing a placeholder drops its scores>                        | <Stated in Data model; placeholders only had test scores.>                                                        |
| <Sprites not loaded on first frame>                               | <Engine waits for image load before drawing sprites.>                                                             |

## What is **not** in this spec

- Sound<, unless opted in>.
- Touch controls.
- <Dropped reference features.>
- Engines for other games.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
