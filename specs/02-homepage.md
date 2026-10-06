# SPEC 02 — Landing homepage

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-10-05
> **Objective:** Port the landing page in `references/templates/home-about/home.jsx` to `/` with English copy, and move the Library from `/` to `/games`.

## Why this spec exists

SPEC 01 put the Library at `/`. The new reference in `references/templates/home-about/` adds a marketing landing page as the entry point, and adds "Home" to the nav. The Library therefore needs a new URL. The same folder also contains an About + Contact page (`about.jsx`), which is deliberately left for its own spec.

## Scope

**In:**

- A new landing page at `/` with the seven sections of `home.jsx`, in order:
  1. Hero: floating pixel silhouettes (8 SVGs), eyebrow, three-line title, subtitle, two CTAs and the scroll hint.
  2. `// 01` WHY ARCADE VAULT? — four feature cards with pixel icons.
  3. `// 02` GAMES AVAILABLE NOW — a rail with the first 6 games of `GAMES` and a "VIEW ALL GAMES →" button.
  4. Stats band — three stat blocks. The first is derived from `GAMES.length`.
  5. `// 03` LIVE ACTIVITY — a "LATEST SCORES" ticker (7 static rows) and a "TOP PLAYERS · TODAY" list (5 static rows).
  6. `// 04` PRICING — the $0 plan card with stamp and the three-item FAQ.
  7. Final CTA — "READY TO PLAY?".
- Scroll-reveal animation on sections 2–7 (the `.reveal` → `.reveal.in` behavior of the template).
- A `prefers-reduced-motion: reduce` rule: `.reveal` content is shown immediately and the hero silhouettes stop animating.
- The Library moves to `/games`. It renders exactly what `/` renders today (the `av-hero` + `<LibraryBrowser />`).
- Nav: links become **Home · Library · Hall of Fame** on desktop and in the mobile drawer. The logo links to `/`.
- Existing links that mean "go to the library" are retargeted from `/` to `/games`.
- The home CSS from `references/templates/home-about/styles.css` is ported into `app/globals.css`.
- All copy translated to English (see the copy table).

**Out of scope (for future specs):**

- The About + Contact page (`about.jsx`) and its "About" nav link.
- Real live activity, real top players or real play counts. Ticker and top list are static mock rows.
- Auth. "CREATE ACCOUNT" and "START FREE" only link to `/login`.
- Any change to the Library, detail, player, login or Hall of Fame screens beyond the link targets listed below.
- Automated tests (no test runner is configured).

## Data model

This feature introduces no persistent data. It reuses `GAMES` and `Game` from `lib/games.ts` (SPEC 01).

Static homepage content lives in `lib/home-content.ts`:

```ts
import type { GameColor } from "@/lib/games";

export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export type Feature = { icon: FeatureIconKind; title: string; desc: string; color: GameColor };
export type TickerRow = { player: string; gameId: string; score: number; ago: string; color: GameColor };
export type TopPlayer = { rank: number; player: string; score: number };
export type FaqItem = { q: string; a: string };

export const FEATURES: Feature[];       // 4 items, same order/colors as home.jsx
export const TICKER: TickerRow[];       // 7 rows, same players/scores/colors as home.jsx
export const TOP_PLAYERS: TopPlayer[];  // 5 rows, same as home.jsx
export const PRICING_PERKS: string[];   // 6 bullets
export const FAQ: FaqItem[];            // 3 items
```

Conventions:

- `TickerRow.gameId` references a `Game.id`. The visible name is read from `getGame(gameId)!.title`, so the ticker always shows the English titles of SPEC 01.
- Template game names map to ids as: Caída → `falldown`, Glotón → `glutton`, Invasores → `invaders`, Rocas → `rocks`, Bloque Buster → `block-buster`, Serpentina → `serpentine`, Ranaria → `froggeria`.
- Numbers are formatted with `toLocaleString("en-US")`, as in SPEC 01.
- The top-players bar width stays `100 - i * 16` percent, as in the template.
- The games rail is `GAMES.slice(0, 6)`.
- The first stat is `` `${GAMES.length}` `` with unit "GAMES" and sub "AND COUNTING". It shows `8` today.

## Files

| File | Kind | Purpose |
| --- | --- | --- |
| `lib/home-content.ts` | module | Static homepage content and types |
| `components/home-silhouettes.tsx` | server | The 8 decorative pixel SVGs (`.home-silos`) |
| `components/feature-icon.tsx` | server | Pixel icons GAMEPAD / FREE / TROPHY / ROCKET |
| `components/mini-card.tsx` | server | Rail card; a `Link` to `/games/[id]` |
| `components/reveal.tsx` | client | Wrapper that renders a `<section>` with `reveal` and adds `in` when it enters the viewport |
| `app/page.tsx` | replaced | The landing page composed from the pieces above |
| `app/games/page.tsx` | new | The Library: today's `app/page.tsx` content moved verbatim, plus `metadata` title |
| `components/nav.tsx` | modified | Home link, `home` section, Library active on `/games` and `/games/*` |
| `app/globals.css` | modified | Home, activity and pricing styles, plus the reduced-motion rule |
| `app/not-found.tsx` | modified | "BACK TO LIBRARY" → `/games` |
| `app/hall-of-fame/page.tsx` | modified | "BACK TO LIBRARY" → `/games` |
| `app/games/[id]/page.tsx` | modified | "BACK TO VAULT" → `/games` |
| `components/game-player.tsx` | modified | "BACK TO VAULT" → `/games` |
| `components/auth-form.tsx` | modified | Submit redirect and "PLAY AS GUEST" → `/games` |

## Link targets on the homepage

| Element | Target |
| --- | --- |
| ▶ EXPLORE GAMES | `/games` |
| ✦ CREATE ACCOUNT | `/login` |
| Mini card | `/games/<id>` |
| VIEW ALL GAMES → | `/games` |
| VIEW HALL → | `/hall-of-fame` |
| START FREE → | `/login` |
| INSERT COIN → | `/games` |

All of them are `next/link` `Link` elements styled with the existing `.btn` / `.lb-link` classes. No `onClick` navigation.

## English copy (key strings)

| Template (ES) | Homepage (EN) |
| --- | --- |
| Inicio | Home |
| ▸ INSERTA UNA MONEDA_ | ▸ INSERT A COIN_ |
| EL ARCADE / CLÁSICO ESTÁ / DE VUELTA | THE CLASSIC / ARCADE IS / BACK |
| Juega los mejores clásicos directamente en tu navegador. Sin descargas. Sin costo. Solo diversión. | Play the greatest classics right in your browser. No downloads. No cost. Just fun. |
| ▶ EXPLORAR JUEGOS / ✦ CREAR CUENTA | ▶ EXPLORE GAMES / ✦ CREATE ACCOUNT |
| DESLIZA | SCROLL |
| ¿POR QUÉ ARCADE VAULT? | WHY ARCADE VAULT? |
| JUEGOS CLÁSICOS | CLASSIC GAMES |
| Arkanoid, Tetris, Snake y muchos más… | Arkanoid, Tetris, Snake and many more. The best arcades of all time in one place. |
| 100% GRATIS | 100% FREE |
| Sin suscripciones, sin pagos ocultos… | No subscriptions, no hidden fees. Every game is available for free. |
| LADDER BOARDS | LADDER BOARDS |
| Compite con jugadores de todo el mundo… | Compete with players from around the world. Climb the ranking and prove who is the best. |
| SIEMPRE CRECIENDO | ALWAYS GROWING |
| Agregamos nuevos juegos constantemente… | We add new games all the time. Come back often, there will always be something new to play. |
| JUEGOS DISPONIBLES AHORA | GAMES AVAILABLE NOW |
| VER TODOS LOS JUEGOS → | VIEW ALL GAMES → |
| 12+ / JUEGOS / Y CONTANDO | 8 / GAMES / AND COUNTING |
| MILES / DE PARTIDAS / JUGADAS CADA DÍA | THOUSANDS / OF GAMES / PLAYED EVERY DAY |
| GLOBAL / RANKING / COMPITE CON EL MUNDO | GLOBAL / RANKING / COMPETE WITH THE WORLD |
| ACTIVIDAD EN VIVO | LIVE ACTIVITY |
| ▸ ÚLTIMAS PUNTUACIONES | ▸ LATEST SCORES |
| hace N min | N min ago |
| ▸ TOP JUGADORES · HOY / VER SALÓN → | ▸ TOP PLAYERS · TODAY / VIEW HALL → |
| PRECIOS | PRICING |
| PLAN ÚNICO / JUGADOR VAULT / $0 / SIEMPRE | SINGLE PLAN / VAULT PLAYER / $0 / FOREVER |
| SIN TRUCOS · SIN LETRA PEQUEÑA | NO TRICKS · NO FINE PRINT |
| Acceso a todos los juegos | Access to every game |
| Ranking global y salón de la fama | Global ranking and Hall of Fame |
| Sin anuncios entre partidas | No ads between games |
| Guarda tus puntuaciones | Save your scores |
| Nuevos juegos cada mes | New games every month |
| Funciona en cualquier navegador | Works in any browser |
| EMPEZAR GRATIS → | START FREE → |
| No pedimos tarjeta. Nunca lo haremos. | We don't ask for a card. We never will. |
| FREE PLAY (stamp) | FREE PLAY |
| ¿REALMENTE ES GRATIS? | IS IT REALLY FREE? |
| Sí. Arcade Vault es un proyecto sin fines de lucro… | Yes. Arcade Vault is a non-profit project made out of love for the classics. There is no hidden "premium" version. |
| ¿NECESITO CREAR CUENTA? | DO I NEED AN ACCOUNT? |
| No. Puedes jugar como invitado… | No. You can play as a guest. If you want to save your score and appear in the ranking, sign up in 10 seconds. |
| ¿CÓMO SOBREVIVEN SIN COBRAR? | HOW DO YOU SURVIVE WITHOUT CHARGING? |
| Es un proyecto comunitario… | It's a community project. If you like it, share it. That's the only currency we accept. |
| ¿LISTO PARA JUGAR? / INSERTAR MONEDA → | READY TO PLAY? / INSERT COIN → |
| Gratis. Sin registro obligatorio. Empieza en segundos. | Free. No sign-up required. Start in seconds. |

## Implementation plan

Before each step that touches a Next.js API (`Link`, `metadata`, `usePathname`), check `node_modules/next/dist/docs/`. Follow the project rule of using the `/frontend-design` skill for UI work.

1. Create `app/games/page.tsx` with the current content of `app/page.tsx` (hero + `<LibraryBrowser />`) and `metadata = { title: … }` in the style of the other pages. Leave `app/page.tsx` unchanged for now. Verify: `/games` and `/` both show the Library.
2. Retarget the library links to `/games` in `app/not-found.tsx`, `app/hall-of-fame/page.tsx`, `app/games/[id]/page.tsx`, `components/game-player.tsx` and `components/auth-form.tsx`. Verify: each button lands on `/games`.
3. Update `components/nav.tsx`: add the `home` section (exact `/`), make `library` match `/games` and `/games/*`, add "Home" as the first link on desktop and in the drawer, and point Library to `/games`. Verify: active highlight is correct on `/`, `/games`, `/games/<id>` and `/hall-of-fame`.
4. Port the home styles into `app/globals.css`, inside the same layer as the existing component classes: the `HOME PAGE` block (reference lines ~930–1070), and the `ACTIVITY` and `PRICING` blocks (~1621–1744). Skip any rule or `@keyframes` that already exists in `globals.css` (e.g. `fadeIn`, `slideIn`, `spinpix`, `pulse`). Add the `prefers-reduced-motion: reduce` rule for `.reveal` and `.home-silos .silo`. Verify: `npm run build` passes and the Library looks unchanged.
5. Create `lib/home-content.ts` with the translated content. Verify: `npx tsc --noEmit` passes.
6. Create `components/home-silhouettes.tsx`, `components/feature-icon.tsx` and `components/mini-card.tsx` as server components, ported from `home.jsx`.
7. Create `components/reveal.tsx`: a client component that renders `<section className={"reveal " + className + (visible ? " in" : "")}>`. It uses one `IntersectionObserver` with `threshold: 0.12`, sets `visible` once, then disconnects. The observer is disconnected on unmount.
8. Replace `app/page.tsx` with the landing page: the hero, then sections 2–7 wrapped in `<Reveal>`, using the link targets table. Verify: `/` matches the reference visually, from hero to final CTA.
9. Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npm run build` completes with no type or lint errors.
- [ ] `npm run lint` reports no errors.
- [ ] `/` renders the seven sections in the order of the Scope, with no console errors and no hydration warnings.
- [ ] `/games` renders the Library exactly as `/` did before this spec (hero, search, chips, 8 cards).
- [ ] The games rail shows exactly 6 cards (the first 6 of `GAMES`), each linking to `/games/<id>`.
- [ ] The first stat block reads `8` / `GAMES` / `AND COUNTING`.
- [ ] The ticker shows 7 rows with English game titles (e.g. FALLDOWN, GLUTTON) and scores formatted like `184,220`.
- [ ] The top-players list shows 5 rows. Rows 1–3 have the `top1` / `top2` / `top3` classes.
- [ ] Every homepage link goes to the target in the link targets table.
- [ ] Sections 2–7 start hidden and fade in when scrolled into view.
- [ ] With "prefers-reduced-motion: reduce" emulated in DevTools, sections 2–7 are visible without scrolling animation and the silhouettes do not move.
- [ ] The nav shows Home · Library · Hall of Fame on desktop and in the drawer. "Home" is active only on `/`. "Library" is active on `/games`, `/games/<id>` and `/games/<id>/play`. The logo links to `/`.
- [ ] "BACK TO LIBRARY" (404 and Hall of Fame), "BACK TO VAULT" (detail and Game Over), the login submit and "PLAY AS GUEST" all navigate to `/games`.
- [ ] At 375px viewport width no section of `/` scrolls horizontally, the feature grid is one column and the rail is two columns.
- [ ] No visible text on `/` remains in Spanish.
- [ ] Nothing is written to `localStorage`, `sessionStorage` or cookies.
- [ ] `/` visually matches `home.jsx` in `references/templates/home-about/` (same classes, colors, fonts and animations).

## Decisions

- **Yes:** Library moves to `/games`. It fits the existing `/games/[id]` and `/games/[id]/play` routes.
- **No:** `/library`. It would sit apart from the game detail URLs.
- **Yes:** Homepage only. About + Contact gets its own spec because it has a form with validation and success states.
- **No:** Adding the "About" nav link now. It would point to a page that doesn't exist yet.
- **Yes:** English copy, consistent with SPEC 01 and `<html lang="en">`.
- **No:** Spanish copy as in the reference.
- **Yes:** The games count and the rail come from `lib/games.ts`. The page never claims more games than exist.
- **No:** Copying "12+" verbatim.
- **Yes:** Ticker and top players are static mock rows. There is no real activity until a scores spec lands.
- **Yes:** Ticker rows reference games by `gameId` so titles come from the single source in `lib/games.ts`.
- **Yes:** Keep the PRICING section as in the template.
- **Yes:** The Library hero (`ARCADE VAULT · INSERT COIN TO PLAY`) moves with the Library to `/games`. The Library is visually unchanged.
- **No:** Removing the Library hero.
- **Yes:** Nav order Home · Library · Hall of Fame, logo → `/`.
- **Yes:** Library-meaning links (`BACK TO LIBRARY`, `BACK TO VAULT`, login submit, `PLAY AS GUEST`) go to `/games`. After this spec `/` is a landing page, not the place to pick a game.
- **Yes:** Respect `prefers-reduced-motion` for reveal and silhouettes.
- **Yes:** The SCROLL hint is anchored to the bottom of `.home-hero`, not the inner block. The template's position overlaps the CTAs.
- **No:** Template-exact motion with no reduced-motion handling.
- **Yes:** A `<Reveal>` client wrapper that owns its `in` class through React state.
- **No:** The template's `useReveal` hook, which queries `.reveal` globally and mutates `className` on elements React owns. It can be overwritten on re-render and needs the whole page to be a client component.
- **Yes:** The landing page is a server component. Only `<Reveal>` (and the existing nav) are client components.
- **Yes:** Reuse the template's CSS classes, ported into `app/globals.css`, as SPEC 01 did.
- **No:** Rewriting the home styles as Tailwind utilities. It risks visual drift from the reference.

## Risks

| Risk | Mitigation |
| --- | --- |
| Content in `.reveal` stays hidden if JS fails or is slow to hydrate | The reduced-motion rule shows it for those users. Above-the-fold hero is not wrapped in `<Reveal>`. |
| Duplicate rules or `@keyframes` when porting `styles.css` | Port only the HOME, ACTIVITY and PRICING blocks, and skip names already in `globals.css`. Diff the Library before/after visually. |
| A stale link to `/` that still means "library" | Step 2 lists every `href="/"` / `push("/")` found in `app/` and `components/`. A final `grep` for them is part of step 9. |
| `.home-hero` uses `min-height: calc(100vh - 60px)`, which depends on the nav height | Keep the template value. The nav height is unchanged from SPEC 01. |

## What is **not** in this spec

- About + Contact page and its nav link.
- Real live activity, real top players or real play counts.
- Authentication or account creation.
- Changes to the Library, detail, player, login or Hall of Fame screens beyond the link retargets.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
