---
name: new-game
description: Turns a reference game (references/started-games/NN-name) into a spec that ports it to a typed canvas engine, registers it in the Supabase catalog and wires it to the real leaderboards, following the SPEC 05 + SPEC 06 pattern. Writes only the spec; /spec-impl implements it.
disable-model-invocation: true
argument-hint: "<reference folder, e.g. 03-tetris>"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(git status:*), mcp__supabase__list_migrations, mcp__supabase__execute_sql
---

# /new-game — Reference game → platform spec

## Session context

Today's date (use this for the spec header, never guess it):
!`date +%F`

Specs that already exist:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist yet"`

Reference games available:
!`ls references/started-games/ 2>/dev/null || echo "No references/started-games/ folder"`

Current engine registry:
!`cat lib/engines/index.ts 2>/dev/null || echo "lib/engines/index.ts does not exist"`

Current engine contract:
!`cat lib/engines/types.ts 2>/dev/null || echo "lib/engines/types.ts does not exist"`

---

This skill produces **one spec** that takes a vanilla reference game and makes it a real Arcade Vault game: typed engine, React HUD, catalog row in Supabase, scores saved to the real leaderboards. It is a specialised `/spec`: same philosophy, same template, same rules — but it already knows the platform, so the questions focus on the game itself.

**You don't write code here.** Your output is `specs/NN-<id>-game.md` in `Draft` state. The user approves it and runs `/spec-impl`.

Supporting files in this skill's directory — read both before Phase 3:

- `integration.md` — the platform contract and the per-game integration checklist (the "how"). Every spec this skill writes must respect it.
- `spec-skeleton.md` — the spec skeleton, derived from SPEC 05 and SPEC 06. Fill it in; do not invent a different structure.

Reply in the language of the user's prompt. Write the spec itself in **English**, like every existing spec.

## Phase 1 — Study the reference and the platform

1. Resolve `$ARGUMENTS` to a folder in `references/started-games/`. If it is empty or ambiguous, list the available folders (session context) and ask which one. If a game id is already in `ENGINES`, say so and stop unless the user wants a rework spec.
2. Read the reference completely: `CLAUDE.md`, `README.md`, `index.html`, every `.js` file (`game.js`, `levels.js`, `assets/*.js`), and its `specs/` folder if present. List the assets (`ls -R`). Extract and note:
   - logical canvas size and aspect ratio;
   - every gameplay constant (speeds, sizes, scoring table, lives, level progression, drop rates, timers);
   - entities / classes and the main loop (how `dt` is computed, if at all);
   - input map (keys, mouse, touch) and pause / restart keys;
   - lose and win conditions (e.g. "all levels cleared");
   - anything the platform must remove: globals, `window`/`document` listeners never removed, canvas-drawn HUD, canvas overlays (pause, game over, win), non-English text, `alert`, sounds;
   - assets (sprites, spritesheets, fonts, sounds) and how they load;
   - the realistic maximum score (it must fit the DB CHECK `0..10000000`).
3. Read the platform: `specs/05-asteroids-game.md`, `specs/06-games-table-and-leaderboards.md`, `lib/engines/*`, `components/game-canvas.tsx`, `components/game-player.tsx`, `lib/catalog.ts`, `app/games/[id]/play/actions.ts`, `lib/home-content.ts`, the latest files in `supabase/migrations/`, and the `cover-*` rules in `app/globals.css`.
4. Read the current catalog with `mcp__supabase__execute_sql` — **read-only `select` only**, never DDL or DML:
   `select id, title, cat, cover, color, sort_order from public.games order by sort_order;`
   Also run `mcp__supabase__list_migrations`. If Supabase is unreachable, fall back to the seed in `supabase/migrations/*create_games.sql` plus later migrations, and say so.

## Phase 2 — Detect the contract state

Compare the session-context registry and contract with **Generic contract** in `integration.md`:

- **Not generic yet** (registry values are bare `EngineFactory`, or `EngineSnapshot` still has `tripleShot` / game-specific fields): the spec **must** include the "Step 0 — Generalize the engine contract" block from the skeleton, and its acceptance criteria must prove Asteroids still behaves exactly as before.
- **Already generic**: delete that block from the skeleton. The new game only adds an entry.

Tell the user which case applies in one line before asking questions.

## Phase 3 — Ask the game-specific questions

Use `AskUserQuestion`, 3–5 questions per block, 2–4 options each, your recommendation first and labelled `(Recommended)`. Wait for answers between blocks. Never ask about things the platform already decides (see `integration.md` → **Fixed by the platform**); record those directly.

Always cover:

1. **Catalog row.**
   - If a simulated placeholder resembles the game (e.g. `falldown` ≈ Tetris, `block-buster` ≈ Arkanoid, `serpentine` ≈ Snake, `invaders` ≈ Space Invaders, `pixel-duel` ≈ Pong), offer: replace it (UPDATE, keep its `sort_order`, like ROCKS → ASTEROIDS) vs add a new row (next `sort_order`). If replacing changes the `id`, warn that its scores are cascade-deleted and that `lib/home-content.ts` references must change.
   - Then confirm: `id` (`^[a-z0-9-]+$`), `title`, `short`, `long` copy (must describe the real game, no features it lacks), `cat`, `color`, and cover (reuse the placeholder's `cover-*` class vs a new CSS cover). Propose concrete copy; let the user edit.
2. **Gameplay fidelity.** Constants identical to the reference (recommended) vs tuned. List the mechanics you found and ask which are in (e.g. Tetris ghost piece, hard drop; Arkanoid level select in pause → usually out).
3. **HUD.** Which values the React HUD shows: `score`, `level`, `lives` (or none → `null`), and game-specific `extras` (e.g. Tetris `LINES`; Arkanoid `BLOCKS` left). For things that are not a number — e.g. Tetris NEXT piece — offer: draw it on the canvas beside the centred playfield (recommended, the canvas has spare width) vs a React preview vs drop it.
4. **Input.** Map reference controls to the platform (Space starts, `P`/`Esc` pause — fixed). Ask only about conflicts (e.g. Tetris uses Space for hard drop: Space both starts and hard-drops? ↑ rotates?) and about mouse input (Arkanoid paddle follows the mouse: keep, with coordinate mapping, vs keyboard only). Propose the one-line `controls` legend.
5. **End of run.** What ends the run besides losing all lives (e.g. Arkanoid "all levels cleared" → phase `over` with the final score, vs loop back to level 1 with faster ball). Win screens become the existing GAME OVER modal unless the user wants a different title.
6. **Assets.** Default: sprites/images copied to `public/games/<id>/` and loaded by the engine; **sound out of scope** (as in SPEC 05). Offer: keep sprites (recommended) vs redraw with neon canvas primitives; sound out (recommended) vs in (then the spec must add a mute concern).

Stop asking when you can answer, without assuming anything: which files appear or change, what the first and last executable steps are, and how to verify the game is finished.

## Phase 4 — Write the spec

1. Copy the structure of `spec-skeleton.md` and fill every `<placeholder>`. Remove the hints in `<!-- -->` comments and any conditional block that does not apply. Keep headings exactly as in SPEC 05/06.
2. Every rule in `integration.md` → **Engine rules** that applies goes into Scope / Behavior; every row of **Per-game integration checklist** goes into Files and the Implementation plan; **Verification checklist** items become acceptance criteria, made concrete for this game (real numbers: points per brick, lines per level, etc.).
3. Record every answer from Phase 3 in **Decisions taken and discarded** with what was discarded and why.
4. Number: highest in `specs/` + 1, two digits. Slug: `<id>-game`. Date: from the session context. `**Depends on:**` SPEC 05, SPEC 06 (plus the previous game spec if it introduced the generic contract). Verify each dependency exists.
5. Write `specs/NN-<id>-game.md` with status `Draft`. Do not ask permission and do not ask about the file name; only ask if the file already exists.
6. Confirm to the user:
   - path of the spec;
   - whether it includes the one-time contract generalization step;
   - it is `Draft`: re-read it, set `Approved`, then run `/spec-impl NN-<id>-game`.
   - **Stop.** Do not offer to implement it.

## Hard rules

- Never write code or touch anything outside `specs/` during this command.
- Never apply migrations or run write SQL. `execute_sql` is for the read-only catalog query in Phase 1.
- Never modify `references/` — the spec must say the reference folder stays read only.
- Never assume a catalog decision, copy text or gameplay change the user did not confirm.
- The spec must not promise anything the reference game does not do.
