# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault is a platform for playing retro arcade games online and competing for the highest score. The catalog has 8 games; 4 have a real canvas engine (ARKANOID, TETRIS, SNAKE, ASTEROIDS) and the other 4 (GLUTTON, INVADERS, FROGGERIA, PIXEL DUEL) are placeholders that run a simulated score in the player.

Routes (`app/`):

- `/` home, `/games` library (search + category filter in `components/library-browser.tsx`), `/games/[id]` game detail with its leaderboard, `/games/[id]/play` the player, `/hall-of-fame` top scores per game.
-  Games like `arkanoid`, `asteroids` , `snake`, `tetris` and more  ... (see `references/implemented-games.md`)
- `/about` with a contact form, `/login` sign-in / sign-up form (visual only; no auth yet, it just routes to `/games`).
- `app/error.tsx` and `app/not-found.tsx` handle errors and unknown ids.

`references/` holds the source material and is not app code (ignored by Prettier): `templates/` is the original HTML/JSX design the UI was ported from, `started-games/` the vanilla reference games, `source-assets/` game assets.

## Workflow and skills

Development is spec-driven. Write or update a spec before implementing a feature:

- `/spec` writes a spec in `specs/NN-slug.md` (template in `.agents/skills/spec/template.md`); `/spec-impl` implements an approved spec and creates the `spec-NN-slug` branch automatically (`specs/.spec-config.yml`, `AutoCreateBranch: true`). Both come from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (`npx skills@latest add Klerith/fernando-skills`), installed in `.agents/skills/` and symlinked into `.claude/skills/`.
- `/new-game <folder>` (project skill, `.claude/skills/new-game/`) turns a game from `references/started-games/` into a spec that ports it to a typed engine, adds its catalog row (replacing a placeholder) and wires it to the leaderboards. It only writes the spec; run `/spec-impl` after. `integration.md` there is the per-game integration checklist.
- Always use `/frontend-design` to design the user interface.
- Save Playwright screenshots to `.playwright-screenshots/` (git-ignored).

Specs so far: 01 visual MVP screens, 02 homepage, 03 about/contact, 04 Supabase setup, 05 Asteroids, 06 games table + leaderboards, 07 Tetris, 08 Arkanoid, 09 Arkanoid sound, 10 Snake.

## Commands

Always use Node 24.18.1 via nvm (pinned in `.nvmrc`). Shell state does not persist between commands, so prefix every Node/npm/npx command with it, e.g. `source ~/.nvm/nvm.sh && nvm use && npm run dev`.

```bash
npm run dev           # dev server at http://localhost:3000 (also regenerates AGENTS.md)
npm run build         # production build (includes type checking; needs Supabase, see below)
npm run start         # serve the production build
npm run lint          # ESLint (flat config: next core-web-vitals + typescript + prettier)
npm run format        # Prettier write (format:check to only check)
npx tsc --noEmit      # type-check without building
```

There is no test runner configured yet.

Claude Code hooks (`.claude/settings.json`): after every Write/Edit, `.claude/hooks/format-and-lint.sh` strips trailing whitespace, runs Prettier and `eslint --fix` on the file, and reports leftover ESLint errors back. Prettier config: `.prettierrc.json` (print width 100, double quotes, trailing commas).

## Stack and conventions

- **Next.js 16.3 (App Router) + React 19.2.** APIs differ from older Next.js; check `node_modules/next/dist/docs/` (`01-app/`, `03-architecture/`) before using a Next.js API. Example: the root layout types its props with the global `LayoutProps<"/">` helper instead of hand-written prop types.
- **Tailwind CSS v4** through `@tailwindcss/postcss`. No `tailwind.config.js`. The neon retro theme lives in `app/globals.css`: CSS variables (`--bg`, `--ink`, `--cyan`, `--magenta`, `--yellow`, `--green`, `--gold`/`--silver`/`--bronze`, `--line`…) mapped to utilities via `@theme inline` (`bg-bg`, `text-ink-dim`, `border-line`, `font-pixel`, `font-mono`), plus the component classes and keyframes ported from the templates. Fonts are set with `next/font/google` in `app/layout.tsx`: Press Start 2P (`font-pixel`), JetBrains Mono and Courier Prime (`font-mono`, also the default sans).
- **TypeScript strict mode.** The `@/*` path alias points to the repo root (not `src/`), e.g. `@/app/...`.
- **Shared types** in `lib/games.ts` (`Game`, `ScoreRow`, `Category`, `CATEGORIES`, `GameColor`). Static page copy lives in `lib/home-content.ts`.
- **Contact form.** `sendContactMessage` Server Action in `app/about/actions.ts` sends mail through Resend (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, optional `CONTACT_FROM_EMAIL`), with a honeypot field and a per-IP rate limit. Validation rules in `lib/contact.ts` are shared by the client form and the action.
- **Rate limiting.** `rateLimit(key, limit, windowMs)` in `lib/rate-limit.ts` is an in-memory sliding window (lost on restart, not shared across instances). Server-only by convention.

## Game engines

- Each real game is a framework-free canvas engine in `lib/engines/<id>.ts` implementing `GameEngine` from `lib/engines/types.ts` (`start` / `pause` / `resume` / `end` / `restart` / `destroy`, optional `setMuted`). It reports state through `onChange(EngineSnapshot)` (phase, score, level, lives or `null`, game-specific HUD `extras`) only when something changed, never every frame (use `sameExtras()`).
- `lib/engines/index.ts` holds the `ENGINES` registry, keyed by game id: `factory`, a one-line `controls` legend and optional `sound: true`. A game with no entry falls back to the simulated player and cannot save scores.
- `components/game-canvas.tsx` owns the engine lifecycle (one engine per mount, Strict Mode safe; callbacks and `muted` read through refs so they never recreate the engine). `components/game-player.tsx` renders the HUD, pause / game-over screens and the save-score form.
- **Game sound.** An engine with sound sets `sound: true` on its `ENGINES` entry (the player then shows the SOUND ON / OFF button) and implements the optional `setMuted()`. It creates its `AudioContext` only inside a user gesture (`start` / `resume` / `restart`) and closes it in `destroy()`. The setting is shared by every game and stored in `localStorage["arcade-vault:sound"]` (`"on"` | `"off"`) through `useSoundSetting()` in `lib/sound-setting.ts`. Only Arkanoid has sound today.

## Supabase

Project ref `sislzmvgqurapxcyzsww`, reachable through the `supabase` MCP server in `.mcp.json`. Clients live in `lib/supabase/`:

- `@/lib/supabase/client` — `createClient()` for Client Components (browser), built on `@supabase/ssr`.
- `@/lib/supabase/server` — `await createClient()` for Server Components, Server Actions and Route Handlers, built on `@supabase/ssr`. Reads cookies, so it makes a page dynamic. Guarded by `server-only`; create one per request. Kept for future auth-aware code.
- `@/lib/supabase/public` — `createPublicClient()`, a cookie-less `supabase-js` client for public reads and anonymous writes on the server. Guarded by `server-only`. Pages that use it stay static, so `generateStaticParams` can query Supabase at build time.
- All three read `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.template`) through `getSupabaseEnv()`, which throws if either is missing. Use the publishable key only; never put the secret / service-role key in a `NEXT_PUBLIC_` var. Every table must have RLS enabled.
- `lib/supabase/database.types.ts` is generated, never hand-edited. After any migration, regenerate it with the Supabase MCP `generate_typescript_types` tool and overwrite the file.
- There is no `proxy.ts` session refresh yet; it comes with authentication.

Data access:

- `@/lib/catalog` (server-only) is the only place pages read game data: `getGames()` and `getGame(id)` (throw on error, caught by `app/error.tsx`) and `getTopScores(gameId, limit)` (returns `null` on error so a single board shows `SCORES UNAVAILABLE`). It uses only `createPublicClient()`.
- Scores are written by the `saveScore` Server Action in `app/games/[id]/play/actions.ts` (validation, `ENGINES` check, per-IP rate limit, `revalidatePath` of `/`, `/games`, `/games/[id]` and `/hall-of-fame`). Ranking order everywhere is `score desc, created_at asc`.
- `npm run build` needs Supabase reachable and both env vars set, because `generateStaticParams` reads the `games` table.

Migrations are applied with the MCP `apply_migration` tool and mirrored in `supabase/migrations/<version>_<name>.sql`, using the version from `list_migrations` and the exact SQL that was applied. Add the file in the same change as every new migration. In order:

- `create_games` — `games` table (catalog, seeded with the 8 games, `sort_order`), RLS with public `select`. Catalog changes go through new migrations; there is no write path in the app.
- `create_scores` — `scores` table (one row per saved run, CHECK on name `^[A-Z0-9_]{1,10}$` and score `0..10000000`), RLS with public `select` and `insert` (no update/delete), and the `game_best_scores` view (`security_invoker`).
- `replace_falldown_with_tetris` — swaps the FALLDOWN placeholder for the real Tetris row (`tetris`, same `sort_order` 2).
- `replace_block_buster_with_arkanoid` — swaps the BLOCK BUSTER placeholder for the real Arkanoid row (`arkanoid`, same `sort_order` 1).
- `replace_serpentine_with_snake` — swaps the SERPENTINE placeholder for the real Snake row (`snake`, same `sort_order` 3).
