# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault is a platform for playing games online and competing for the highest score. The repo is currently a fresh `create-next-app` scaffold: only `app/layout.tsx`, `app/page.tsx` and `app/globals.css` exist, all still template content.

Development follows a spec-driven workflow using the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (install with `npx skills@latest add Klerith/fernando-skills`). Write or update a spec before implementing a feature.

## Commands

Always use Node 24.18.1 via nvm (pinned in `.nvmrc`). Shell state does not persist between commands, so prefix every Node/npm/npx command with it, e.g. `source ~/.nvm/nvm.sh && nvm use && npm run dev`.

```bash
npm run dev     # dev server at http://localhost:3000 (also regenerates AGENTS.md)
npm run build   # production build (includes type checking)
npm run start   # serve the production build
npm run lint    # ESLint (flat config: next core-web-vitals + typescript)
npx tsc --noEmit  # type-check without building
```

There is no test runner configured yet.

## Skills

Use always /frontend-design to design the user interface


## Stack and conventions

- **Next.js 16.3 (App Router) + React 19.2.** APIs differ from older Next.js; check `node_modules/next/dist/docs/` (`01-app/`, `03-architecture/`) before using a Next.js API. Example: the root layout types its props with the global `LayoutProps<"/">` helper instead of hand-written prop types.
- **Tailwind CSS v4** through `@tailwindcss/postcss`. No `tailwind.config.js`; theme tokens live in `app/globals.css` via `@import "tailwindcss"` and `@theme inline`, mapped from CSS variables (`--background`, `--foreground`, Geist font variables set in `app/layout.tsx`).
- **TypeScript strict mode.** The `@/*` path alias points to the repo root (not `src/`), e.g. `@/app/...`.

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
- Scores are written by the `saveScore` Server Action in `app/games/[id]/play/actions.ts` (validation, `ENGINES` check, per-IP rate limit, `revalidatePath`). Ranking order everywhere is `score desc, created_at asc`.
- `npm run build` needs Supabase reachable and both env vars set, because `generateStaticParams` reads the `games` table.

Migrations are applied with the MCP `apply_migration` tool and mirrored in `supabase/migrations/<version>_<name>.sql`, using the version from `list_migrations` and the exact SQL that was applied. Add the file in the same change as every new migration. In order:

- `create_games` — `games` table (catalog, seeded with the 8 games, `sort_order`), RLS with public `select`. Catalog changes go through new migrations; there is no write path in the app.
- `create_scores` — `scores` table (one row per saved run, CHECK on name `^[A-Z0-9_]{1,10}$` and score `0..10000000`), RLS with public `select` and `insert` (no update/delete), and the `game_best_scores` view (`security_invoker`).
