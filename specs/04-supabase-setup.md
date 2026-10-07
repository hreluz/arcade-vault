# SPEC 04 — Supabase setup

> **Status:** Approved
> **Depends on:** none
> **Date:** 2026-10-07
> **Objective:** Wire Supabase into the Next.js app with typed browser and server clients built on `@supabase/ssr`, without adding any feature that uses them.

## Why this spec exists

The Supabase project already exists (it is configured as an MCP server in `.mcp.json`, project ref `sislzmvgqurapxcyzsww`), but the app has no way to talk to it. Auth, scores and leaderboards will all need Supabase. This spec lays down only the plumbing — dependencies, env vars, clients and generated types — so later specs can use it without re-deciding how the connection works.

## Scope

**In:**

- Dependencies: `@supabase/supabase-js`, `@supabase/ssr` and `server-only`.
- Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable `sb_publishable_...` key), documented in `.env.template` and filled in the local `.env`.
- A small env helper that reads both vars and throws a clear error when either is missing.
- A browser client (`createBrowserClient`) for Client Components.
- A server client (`createServerClient` + `cookies()` from `next/headers`) for Server Components, Server Actions and Route Handlers, guarded with `import "server-only"`.
- A generated `Database` types file, produced with the Supabase MCP `generate_typescript_types` tool, and both clients typed with it.
- A "Supabase" section in `CLAUDE.md` explaining which client to use where and how to regenerate types.

**Out of scope (for future specs):**

- Authentication of any kind (login, sign-up, sessions, OAuth). `components/auth-form.tsx` is not touched.
- The `proxy.ts` (formerly middleware) that refreshes auth sessions. It belongs to the auth spec.
- Any table, migration, RLS policy, storage bucket or edge function.
- Using the clients from any page, component or action. No existing file imports them after this spec.
- Persisting scores or replacing any mock data (`lib/games.ts`, `lib/home-content.ts`).
- A health-check route or any other new endpoint or UI.
- A service-role / secret-key admin client.
- Supabase CLI, local Supabase stack, or an npm script to regenerate types.
- Automated tests (no test runner is configured).

## Data model

This feature introduces no tables or persistent data. It adds two pieces of typed configuration:

```ts
// lib/supabase/env.ts
export function getSupabaseEnv(): { url: string; publishableKey: string };
// Reads process.env.NEXT_PUBLIC_SUPABASE_URL and
// process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
// Each var is referenced literally (not via a dynamic key) so Next.js inlines
// them in the client bundle.
// Throws: Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.template to .env and fill them in.")
```

```ts
// lib/supabase/database.types.ts — generated, never hand-edited
export type Database = {/* output of generate_typescript_types */};
```

Client signatures:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient<Database>; // browser, sync

// lib/supabase/server.ts
import "server-only";
export async function createClient(): Promise<SupabaseClient<Database>>; // awaits cookies()
```

Server client cookie handling follows the `@supabase/ssr` pattern: `getAll()` returns `cookieStore.getAll()`; `setAll()` calls `cookieStore.set(...)` for each cookie inside a `try/catch`, because Server Components cannot write cookies (the future proxy will handle refresh).

## Files

| File                                 | Kind                     | Purpose                                                                                         |
| ------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `package.json` / `package-lock.json` | modified                 | Add `@supabase/supabase-js`, `@supabase/ssr`, `server-only`                                     |
| `.env.template`                      | modified                 | Document `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                  |
| `.env`                               | modified (not committed) | Real values fetched via MCP `get_project_url` / `get_publishable_keys`; existing vars untouched |
| `lib/supabase/env.ts`                | new                      | `getSupabaseEnv()`                                                                              |
| `lib/supabase/client.ts`             | new                      | Browser client                                                                                  |
| `lib/supabase/server.ts`             | new                      | Server client, `server-only`                                                                    |
| `lib/supabase/database.types.ts`     | new                      | Generated `Database` type                                                                       |
| `CLAUDE.md`                          | modified                 | "Supabase" section: client choice, env vars, type regeneration via MCP                          |

## Implementation plan

1. Read the Next.js 16 docs for `cookies()` and environment variables in `node_modules/next/dist/docs/`, and the current `@supabase/ssr` Next.js guide (context7 or Supabase MCP `search_docs`), to confirm the APIs before writing code.
2. Install `@supabase/supabase-js`, `@supabase/ssr` and `server-only` with npm (Node 24.18.1 via nvm). Build still passes.
3. Fetch the project URL and publishable key with the Supabase MCP. Add both vars (empty, with comments) to `.env.template` and the real values to `.env`, leaving `RESEND_API_KEY`, `CONTACT_TO_EMAIL` and `SUPABASE_DB_PASSWORD` as they are.
4. Generate `lib/supabase/database.types.ts` with the MCP `generate_typescript_types` tool and save its output verbatim.
5. Create `lib/supabase/env.ts`.
6. Create `lib/supabase/client.ts` (browser client typed with `Database`).
7. Create `lib/supabase/server.ts` (server client typed with `Database`, `server-only`, async `cookies()`).
8. Add the "Supabase" section to `CLAUDE.md`.
9. Run `npx tsc --noEmit`, `npm run lint` and `npm run build`.
10. Run a one-off, uncommitted connectivity check (e.g. a scratch script that creates a client with the `.env` values and calls a cheap request such as `auth.getSession()` or a `select` against the REST endpoint) and confirm it reaches the project without a network or key error. Delete the script.

## Acceptance criteria

- [ ] `@supabase/supabase-js`, `@supabase/ssr` and `server-only` are listed in `dependencies` of `package.json`.
- [ ] `.env.template` contains `NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` with no real values.
- [ ] `.env` contains both vars with real values, and `.env` is still ignored by git.
- [ ] `lib/supabase/env.ts`, `client.ts`, `server.ts` and `database.types.ts` exist.
- [ ] Both `createClient` functions return `SupabaseClient<Database>`.
- [ ] `lib/supabase/server.ts` starts with `import "server-only"` and awaits `cookies()`.
- [ ] With either env var unset, calling `getSupabaseEnv()` throws the documented error message.
- [ ] No file outside `lib/supabase/` imports from `lib/supabase/`.
- [ ] No `proxy.ts` / `middleware.ts` exists.
- [ ] No migration, table or policy was created in the Supabase project.
- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] The one-off connectivity check reached the project with the publishable key, and the script was not committed.
- [ ] `CLAUDE.md` has a "Supabase" section covering client choice, env vars and type regeneration via MCP.
- [ ] Every existing page (`/`, `/games`, `/games/[id]`, `/about`, `/login`, `/hall-of-fame`) renders as before.

## Decisions taken and discarded

| Decision              | Chosen                                                      | Discarded                                       | Why                                                                                              |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Client library        | `@supabase/ssr` browser + server clients                    | single `supabase-js` client; server-only client | Official App Router pattern; cookie-based sessions are ready when auth lands, no rewrite needed. |
| Session-refresh proxy | Deferred to the auth spec                                   | Include `proxy.ts` now                          | Without login it only adds a hop to every request and does nothing.                              |
| API key               | Publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)    | Legacy anon JWT key                             | Current Supabase key format; legacy anon keys are being phased out.                              |
| Missing env vars      | Throw a clear error when a client is created                | Non-null assertion `!`                          | Fails fast with an actionable message; pages that don't use Supabase are unaffected.             |
| Server import guard   | `server-only`                                               | Rely on `next/headers` failing at runtime       | Misuse from a Client Component fails at build time instead of runtime.                           |
| Types                 | Generated `database.types.ts`, regenerated via Supabase MCP | Untyped clients; npm script with Supabase CLI   | Typed queries from day one without requiring `supabase login` on each machine.                   |
| Verification          | Build/lint/tsc + one-off uncommitted connectivity check     | Committed health-check route                    | Keeps the scope to plumbing only; no new public endpoint.                                        |

## Identified risks

- **Empty schema.** The project has no tables yet, so `database.types.ts` will be mostly empty. It must be regenerated by every spec that adds a migration; stale types will compile but lie.
- **Public key exposure.** `NEXT_PUBLIC_*` values are inlined in the client bundle. This is expected for the publishable key, but it means every future table **must** have RLS enabled; the publishable key alone grants whatever RLS allows.
- **`@supabase/ssr` vs Next.js 16 API drift.** The Supabase guide may still show `middleware.ts` or sync `cookies()`. Step 1 exists to check the Next.js 16 docs before copying any snippet.
- **Missing env in other environments.** A deploy without the two vars builds fine but throws on the first Supabase call. Acceptable while nothing uses the clients; the deploy env must be set before a feature depends on them.
