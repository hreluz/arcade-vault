# SPEC 06 — Games table and real leaderboards

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 04, SPEC 05
> **Date:** 2026-10-12
> **Objective:** Move the game catalog into a Supabase `games` table and replace every mock leaderboard with real scores saved anonymously from the game-over modal of engine games.

## Why this spec exists

The catalog is a hardcoded `GAMES` array in `lib/games.ts`, and every leaderboard is fake data from `seededScores()`. SAVE SCORE in the game-over modal is cosmetic. SPEC 04 wired the Supabase clients but left them unused, and SPEC 05 deferred score persistence to its own spec. This is that spec. It is the first one that creates tables, so it also sets the pattern for migrations, RLS and type regeneration. There is no auth yet: scores are anonymous and spoofable on purpose, and an auth spec will tighten that later.

## Scope

**In:**

- A `games` table seeded with the 8 current catalog entries (same ids, titles, copy, category, cover and color, same order).
- A `scores` table: one row per saved run (arcade-style, the same name can appear many times).
- A `game_best_scores` view with the top score per game.
- RLS on both tables. `anon` and `authenticated` can `select` both. `anon` and `authenticated` can `insert` into `scores` only. No update or delete policies anywhere.
- CHECK constraints as the real guard: name `^[A-Z0-9_]{1,10}$`, score integer `0..10000000`, `game_id` FK to `games`.
- A cookie-less, server-only Supabase client for public reads, so pages keep using `generateStaticParams` at build time.
- A server-only data module (`lib/catalog.ts`) that every page uses to read games, best scores and leaderboards.
- Every page that used `GAMES`, `getGame` or `seededScores` reads from Supabase instead: `/`, `/games`, `/games/[id]`, `/games/[id]/play`, `/hall-of-fame`.
- `best` comes from `game_best_scores`. It shows `—` when a game has no scores. `plays` is removed from the type, the cards and the detail stat strip.
- `seededScores`, `PLAYERS` and the `GAMES` array are deleted.
- A `saveScore` Server Action: validates input, checks that the game has a real engine (`ENGINES[gameId]`), rate-limits per IP with `rateLimit()` (5 saves / 60 s), inserts, calls `revalidatePath` for the pages that show scores, and returns the new rank.
- Game-over modal for engine games: SAVE SCORE calls `saveScore`. While pending the button reads `SAVING…` and is disabled. On success it shows `▸ SCORE SAVED — RANK #NN_` and the input row disappears until PLAY AGAIN. On failure it shows an inline error and keeps the button for a retry.
- Game-over modal for simulated games: the input row is replaced by `SCORES NOT RECORDED FOR THIS DEMO`.
- Leaderboards on `/games/[id]` (top 10) and `/hall-of-fame` (top 12 per game, tabs + podium + table) show real rows.
- Empty state on any board with no rows: `NO SCORES YET — BE THE FIRST`. The podium hides empty slots.
- Degraded state: a leaderboard read failure shows `SCORES UNAVAILABLE` in that board only. A catalog read failure throws to a new `app/error.tsx` (`SIGNAL LOST` + RETRY button calling `reset()`).
- Regenerated `lib/supabase/database.types.ts`.
- `CLAUDE.md` Supabase section updated: the public client, `lib/catalog.ts`, and the migration names.

**Out of scope (for future specs):**

- Authentication, user accounts, linking scores to users.
- Anti-cheat beyond CHECK constraints and the app-path rate limit (signed runs, server-side replay, score plausibility per game).
- A secret / service-role admin client.
- The home page "LATEST SCORES" ticker (`TICKER` in `lib/home-content.ts`) and the home stats strip. They stay mock data.
- Tracking plays, or showing a play count anywhere.
- Best-per-player ranking, pagination, time-filtered boards (weekly, monthly).
- A leaderboard on the play page.
- Admin UI or any write path for `games` (catalog changes go through migrations).
- Moderating or deleting offensive names.
- Real engines for the other games.
- Automated tests (no test runner is configured).

## Data model

### Migration `create_games`

```sql
create table public.games (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null check (cover like 'cover-%'),
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order int  not null unique,
  created_at timestamptz not null default now()
);
alter table public.games enable row level security;
create policy "games are public" on public.games for select to anon, authenticated using (true);
-- + insert of the 8 current entries, sort_order 1..8 in today's array order
```

### Migration `create_scores`

```sql
create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games(id) on delete cascade,
  name       text not null check (name ~ '^[A-Z0-9_]{1,10}$'),
  score      int  not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);
create index scores_board_idx on public.scores (game_id, score desc, created_at asc);
alter table public.scores enable row level security;
create policy "scores are public" on public.scores for select to anon, authenticated using (true);
create policy "anyone can submit a score" on public.scores for insert to anon, authenticated with check (true);

create view public.game_best_scores with (security_invoker = true) as
  select game_id, max(score) as best from public.scores group by game_id;
```

Ranking order everywhere: `score desc, created_at asc` (an earlier equal score ranks higher).

### TypeScript

```ts
// lib/games.ts — types and constants only, no data
export type Game = {
  id: string; title: string; short: string; long: string;
  cat: Category; cover: `cover-${string}`; color: GameColor;
  best: number | null; // null = no scores yet
};
export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/YYYY", UTC
// Category, GameColor, CATEGORIES unchanged. GAMES, PLAYERS, getGame, seededScores removed.
```

```ts
// lib/supabase/public.ts
import "server-only";
export function createPublicClient(): SupabaseClient<Database>; // supabase-js createClient, no cookies, persistSession: false
```

```ts
// lib/catalog.ts
import "server-only";
export async function getGames(): Promise<Game[]>;                   // ordered by sort_order, best merged in; throws on error
export async function getGame(id: string): Promise<Game | undefined>; // throws on error, undefined if missing
export async function getTopScores(gameId: string, limit: number): Promise<ScoreRow[] | null>; // null = unavailable
```

```ts
// app/games/[id]/play/actions.ts
"use server";
export type SaveScoreResult =
  | { status: "ok"; rank: number }
  | { status: "error"; reason: "invalid" | "no-engine" | "rate-limited" | "failed" };
export async function saveScore(input: { gameId: string; name: string; score: number }): Promise<SaveScoreResult>;
```

- `name` is trimmed and upper-cased, then must match `^[A-Z0-9_]{1,10}$`. `score` must be an integer in `0..10000000`.
- The client IP comes from the same helper pattern as `app/about/actions.ts` (`clientIp()`); the rate-limit key is `score:<ip>`.
- After the insert, rank = 1 + count of rows for that game with `score > s`, or `score = s` and `created_at < new row's created_at`.
- `revalidatePath` targets: `/`, `/games`, `/games/${gameId}`, `/hall-of-fame`.
- The modal input keeps its current filter (upper-case, max 10) and also strips characters outside `A-Z0-9_`. The default stays `GUEST`.

## Files

| File                                  | Kind     | Purpose                                                                 |
| ------------------------------------- | -------- | ----------------------------------------------------------------------- |
| Supabase migrations `create_games`, `create_scores` | new (remote) | Tables, seed, RLS, view                                    |
| `lib/supabase/database.types.ts`      | regenerated | Types for `games`, `scores`, `game_best_scores`                      |
| `lib/supabase/public.ts`              | new      | Cookie-less server-only client for public reads                         |
| `lib/catalog.ts`                      | new      | `getGames`, `getGame`, `getTopScores`                                   |
| `lib/games.ts`                        | modified | Types only; data and `seededScores` removed; `best` nullable, no `plays`|
| `app/games/[id]/play/actions.ts`      | new      | `saveScore` Server Action                                               |
| `app/page.tsx`                        | modified | Games preview and count from `getGames()`; ticker untouched             |
| `app/games/page.tsx`                  | modified | Passes `games` to `LibraryBrowser`                                      |
| `components/library-browser.tsx`      | modified | Takes `games` as a prop                                                 |
| `components/game-card.tsx`            | modified | `best` shows `—` when null                                              |
| `app/games/[id]/page.tsx`             | modified | DB catalog, real top 10, Plays stat removed, best `—` when null         |
| `app/games/[id]/play/page.tsx`        | modified | DB catalog; passes `canSave = !!ENGINES[id]` context as needed          |
| `components/game-player.tsx`          | modified | Real save flow, pending/error/rank states, demo message for simulated games |
| `components/leaderboard.tsx`          | modified | Accepts `ScoreRow[] \| null`; empty and unavailable states              |
| `app/hall-of-fame/page.tsx`           | modified | Fetches games + top 12 per game, passes to the board                    |
| `components/hall-of-fame-board.tsx`   | modified | Takes boards as props; empty/unavailable states; podium hides empty slots |
| `app/error.tsx`                       | new, client | `SIGNAL LOST` + RETRY                                                 |
| `app/globals.css`                     | modified | Empty / unavailable / error / save-error styles                         |
| `CLAUDE.md`                           | modified | Supabase section: public client, `lib/catalog.ts`, migrations           |

## Implementation plan

Use the `/frontend-design` skill for the UI steps (7–9). Before writing code, read the Next.js 16 docs in `node_modules/next/dist/docs/` for `generateStaticParams`, `revalidatePath`, Server Actions and `error.tsx`.

1. Apply migration `create_games` (table, RLS, policy, seed of the 8 entries) with the Supabase MCP. Verify with `execute_sql`: 8 rows in `sort_order`; `get_advisors` shows no RLS warning.
2. Apply migration `create_scores` (table, index, RLS, policies, view). Verify: an insert with name `ab` or score `-1` fails; a valid insert succeeds and is then deleted with `execute_sql`.
3. Regenerate `lib/supabase/database.types.ts` with `generate_typescript_types`. Verify: `npx tsc --noEmit` passes.
4. Create `lib/supabase/public.ts` and `lib/catalog.ts`. Nothing uses them yet. Verify: `npx tsc --noEmit` passes.
5. Switch `/games`, `/games/[id]`, `/games/[id]/play` and `/` to `lib/catalog.ts` (`LibraryBrowser` gets `games` as a prop). Make `best` nullable, remove `plays`, and delete `GAMES` / `getGame` from `lib/games.ts`. Verify: every page renders the same 8 games; best shows `—`.
6. Switch `Leaderboard` and the Hall of Fame to `getTopScores`, add the empty and unavailable states, and delete `seededScores` / `PLAYERS`. Verify: boards show `NO SCORES YET — BE THE FIRST`.
7. Add `app/error.tsx`. Verify: temporarily breaking the env URL shows `SIGNAL LOST`, and RETRY works after restoring it.
8. Create `saveScore` in `app/games/[id]/play/actions.ts`.
9. Wire the game-over modal in `GamePlayer`: save flow with pending, success-with-rank and error states for engine games; demo message for simulated games. Verify: the acceptance criteria below, by hand.
10. Update the Supabase section of `CLAUDE.md`. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] The Supabase project has `games` (8 rows), `scores` and the `game_best_scores` view, with RLS enabled on both tables; `get_advisors` (security) reports no RLS issue for them.
- [ ] `lib/supabase/database.types.ts` includes `games`, `scores` and `game_best_scores`, and was not hand-edited.
- [ ] `lib/games.ts` contains no game data, no `seededScores` and no `PLAYERS`; `grep -r "seededScores\|GAMES\b" app components lib` finds nothing.
- [ ] `/`, `/games`, `/games/[id]` and `/hall-of-fame` show the same 8 games, in the same order, as before this spec.
- [ ] No page or card shows a play count.
- [ ] With an empty `scores` table, every game card and detail page shows best `—`, and every board shows `NO SCORES YET — BE THE FIRST`.
- [ ] Finishing an Asteroids run and saving as `TEST_1` shows `▸ SCORE SAVED — RANK #NN_` with the correct rank, and the input row is gone until PLAY AGAIN.
- [ ] After that save, reloading `/games/asteroids` and `/hall-of-fame` (ASTEROIDS tab) shows the `TEST_1` row with today's date, and the ASTEROIDS card best equals the top score.
- [ ] Two saves with the same score: the earlier one ranks higher.
- [ ] Typing `ab-c!` in the name input results in `ABC`.
- [ ] The 6th save within 60 s from the same IP is rejected with a visible error, and the button stays for a retry.
- [ ] Calling `saveScore` for `block-buster` returns `no-engine`; the `block-buster` game-over modal shows `SCORES NOT RECORDED FOR THIS DEMO` and no input.
- [ ] A direct REST insert with name `toolongname123` or score `-5` is rejected by the database.
- [ ] A direct REST `update` or `delete` on `scores` or `games` with the publishable key affects 0 rows.
- [ ] With the scores query forced to fail, the board shows `SCORES UNAVAILABLE` and the rest of the page renders.
- [ ] With the catalog query failing, the page shows `SIGNAL LOST` with a working RETRY button.
- [ ] The Hall of Fame podium with only 1 score shows only the gold slot.
- [ ] No `NEXT_PUBLIC_` var holds a secret key, and no new env var was added.
- [ ] The home ticker and stats strip render as before.

## Decisions taken and discarded

| Decision            | Chosen                                                             | Discarded                                    | Why                                                                                 |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Spec size           | One spec for both tables and the leaderboards                      | Split into games table + scores specs        | User's call: one PR, the two halves only make sense together.                       |
| Catalog source      | Supabase `games` table, seeded by migration                        | Keep `lib/games.ts`; fallback to it on error | One source of truth, and `scores` gets a real FK.                                   |
| Identity            | Anonymous name via Server Action                                   | Wait for auth; direct browser insert         | Real boards now; the action gives validation and a rate limit on the app path.      |
| Insert guard        | Anon insert policy + CHECK constraints                             | Secret-key admin client, no anon insert      | No secret to manage. Direct REST inserts are accepted until auth lands.             |
| Name format         | `^[A-Z0-9_]{1,10}$`, default `GUEST`                               | Exactly 3 initials                           | Keeps the current input and fits the existing name style (`PX_KAI`).                |
| Which games save    | Only games in `ENGINES` (today: ASTEROIDS)                         | All games                                    | Simulated scores would pollute real boards.                                         |
| Simulated modal     | `SCORES NOT RECORDED FOR THIS DEMO`                                | Keep cosmetic SAVE SCORE                     | Nothing in the UI should pretend to save.                                           |
| Ranking             | Every run is a row; `score desc, created_at asc`                   | Best per name                                | Arcade-style, and the simplest query.                                               |
| `best`              | Derived via `game_best_scores` view; `—` when none                 | Static column                                | Must agree with the boards.                                                         |
| `plays`             | Removed                                                            | Static column; count of saved scores         | Nothing tracks plays; a fake or tiny number misleads.                               |
| Empty boards        | Empty state, no fake rows                                          | Seed fake scores; hide boards                | No fake data in the DB; every game keeps its tab.                                   |
| Freshness           | Static pages via a cookie-less public client + `revalidatePath` on save | Fully dynamic pages; time-based revalidate | Fast static pages, and a new score is visible on the next reload.                  |
| Abuse limits        | CHECK bounds + 5 saves / 60 s per IP + one save per run            | Nothing; captcha                             | Cheap, reuses `rateLimit()`.                                                        |
| Failure handling    | Catalog → `app/error.tsx`; boards → `SCORES UNAVAILABLE`; save → inline retry | Hardcoded fallback catalog           | The page is useless without a catalog; a board failure should not take it down.     |
| Rank in modal       | Show `RANK #NN` after saving                                       | Plain `SCORE SAVED`                          | Immediate feedback that the save was real.                                          |
| Home ticker         | Stays mock                                                         | Real latest scores                           | Keeps scope; it needs its own design for "ago" and an empty feed.                   |

## Identified risks

| Risk                                                        | Mitigation                                                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Anyone can insert fake scores directly via REST             | Accepted until auth. CHECK constraints bound the damage. Spec out-of-scope lists anti-cheat and moderation.            |
| `npm run build` now needs Supabase reachable (`generateStaticParams`) | Documented in `CLAUDE.md`. The deploy env must have both vars set.                                           |
| In-memory rate limit resets on restart and is per instance  | Same accepted limitation as the contact form; noted in `lib/rate-limit.ts`.                                            |
| `revalidatePath` misses a page that shows scores            | The target list is fixed in the Data model; an acceptance criterion reloads each one after a save.                     |
| Stale `database.types.ts`                                   | Regenerated in step 3, right after the migrations.                                                                     |
| Using the cookie client at build time breaks static generation | `lib/catalog.ts` uses only `createPublicClient()`; the cookie client stays for future auth-aware code.              |
| A game added to the DB without a cover class or engine      | CHECK on `cover like 'cover-%'`; new ids render on demand (`dynamicParams` default) and fall back to the simulated player. |

## What is **not** in this spec

- Authentication or linking scores to users.
- Anti-cheat beyond constraints and the rate limit; name moderation.
- A secret-key admin client.
- The home ticker and stats strip (still mock).
- Play counts.
- Best-per-player, pagination or time-filtered boards.
- A leaderboard on the play page.
- Real engines for other games.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
