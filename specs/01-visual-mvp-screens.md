# SPEC 01 — Visual MVP of all Arcade Vault screens

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-10-04
> **Objective:** Port the five screens in `references/templates/` (library, game detail, player, sign in, hall of fame) to Next.js App Router pages with English copy and mock data, visuals only, with no real games or persistence.

## Why this spec exists

The reference design in `references/templates/` is a single-file React 18 prototype. It uses hash routing, globals on `window` and Babel in the browser. The theme (`app/globals.css`) and fonts (`app/layout.tsx`) were already ported in the previous commit. This spec covers the screens themselves. The goal is a navigable, pixel-faithful MVP that later specs (real games, auth, real leaderboards) can build on.

## Scope

**In:**

- Five routes using the App Router:
  - `/` — Library (hero, search, category chips, game grid, empty state).
  - `/games/[id]` — Game detail (cover, tags, description, stat strip, actions, top-10 leaderboard).
  - `/games/[id]/play` — Simulated player (HUD, CRT frame with the animated CSS arena, pause overlay, Game Over modal).
  - `/login` — Auth card with Sign In / Create Account tabs, guest button and decorative social buttons.
  - `/hall-of-fame` — Per-game tabs, top-3 podium and a 12-row ranking table.
- A shared sticky navbar with the logo, active-link highlight, a static "CREDITS · 03" counter, a "Sign In" button and a mobile hamburger drawer.
- A shared footer.
- A themed 404 page (`app/not-found.tsx`) for unknown game ids.
- Mock data ported to TypeScript: 8 games, categories and a deterministic `seededScores`.
- All UI copy translated to English. `<html lang="en">` stays.
- Styling reuses the component classes already in `app/globals.css`. The templates' inline `style={{}}` objects become Tailwind utilities that use the theme tokens.

**Out of scope (for future specs):**

- Any real playable game. The player only simulates score ticking over a CSS animation.
- Authentication of any kind (real or mocked in `localStorage`). The nav always shows "Sign In".
- Persisting scores. "Save Score" only shows the saved confirmation.
- The "Your best score" row in the Hall of Fame (it needs a user).
- Real Google/GitHub OAuth. Those buttons are decorative.
- Backend, database or API routes.
- A working credits/coins system.
- Automated tests (no test runner is configured).

## Data model

`lib/games.ts` is the single source of mock data. It is a plain TS module that both server and client components can import.

```ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;          // URL slug, e.g. "block-buster"
  title: string;       // e.g. "BLOCK BUSTER"
  short: string;       // one-line card description (English)
  long: string;        // detail page paragraph (English)
  cat: Category;
  cover: `cover-${string}`; // CSS class from globals.css, e.g. "cover-bricks"
  color: GameColor;    // picks the PLAY button variant on the card
  best: number;        // global best score
  plays: string;       // display string, e.g. "12.4K"
};

export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/2026"

export const GAMES: Game[];                                   // the 8 games from data.jsx, English titles/ids, same covers/colors/numbers
export const CATEGORIES: readonly ["ALL", ...Category[]];     // "TODOS" → "ALL"
export function getGame(id: string): Game | undefined;
export function seededScores(seed: number, count?: number): ScoreRow[]; // same LCG algorithm as data.jsx
```

Conventions:

- Cover classes, colors, `best` and `plays` values are copied unchanged from `references/templates/data.jsx`.
- Game titles, `short` and `long` are translated to English. Ids are kebab-case slugs of the English titles (see the title table below).
- The library search matches the title or the `short` description.
- `seededScores` must stay deterministic so server and client render the same rows and hydration does not mismatch.
- Numbers are formatted with `toLocaleString("en-US")` everywhere, with an explicit locale to avoid hydration mismatches.
- Seeds use the game's 1-based position in `GAMES` (`n`), so every game gets a distinct board: detail uses `n * 17 + 3` (10 rows) and the Hall of Fame uses `n * 23 + 7` (12 rows). The template's `id.length` seeds gave equal-length ids identical boards.

No persistent data is introduced. There is no `localStorage`, cookies or server storage.

## Files

| File | Kind | Purpose |
| --- | --- | --- |
| `lib/games.ts` | module | Mock data, types, `getGame`, `seededScores` |
| `components/nav.tsx` | client | Navbar + mobile drawer; active link via `usePathname` |
| `components/game-card.tsx` | client | Card with mouse-tilt effect; links to `/games/[id]` |
| `components/library-browser.tsx` | client | Search input, category chips, filtered grid, empty state |
| `components/leaderboard.tsx` | server | "TOP SCORES" list for the detail page |
| `components/game-player.tsx` | client | HUD, CRT, simulated score timer, pause, Game Over modal |
| `components/auth-form.tsx` | client | Tabs, form fields, guest/social buttons |
| `components/hall-of-fame-board.tsx` | client | Game tabs, podium, ranking table |
| `app/layout.tsx` | modified | Renders `<Nav />`, `<main className="av-main">` and the footer |
| `app/page.tsx` | replaced | Hero + `<LibraryBrowser />` |
| `app/games/[id]/page.tsx` | new | Detail page; `generateStaticParams`, `generateMetadata`, `notFound()` |
| `app/games/[id]/play/page.tsx` | new | Wraps `<GamePlayer />`; `generateStaticParams`, `notFound()` |
| `app/login/page.tsx` | new | Wraps `<AuthForm />` |
| `app/hall-of-fame/page.tsx` | new | Header + `<HallOfFameBoard />` + back button |
| `app/not-found.tsx` | new | Themed 404 with a link to `/` |

## English copy (key strings)

| Template (ES) | MVP (EN) |
| --- | --- |
| Biblioteca / Salón de la Fama | Library / Hall of Fame |
| CRÉDITOS · 03 / Iniciar Sesión / MENÚ | CREDITS · 03 / Sign In / MENU |
| INSERTA UNA MONEDA PARA JUGAR _ | INSERT COIN TO PLAY _ |
| Buscar un juego por nombre… | Search a game by name… |
| TODOS | ALL |
| MEJOR PUNTUACIÓN / JUGAR | BEST SCORE / PLAY |
| NO HAY RESULTADOS / Intenta otra búsqueda o categoría. | NO RESULTS / Try another search or category. |
| 1 JUGADOR / TECLADO / TÁCTIL | 1 PLAYER / KEYBOARD / TOUCH |
| Partidas / Mejor global / Dificultad | Plays / Global best / Difficulty |
| ▶ JUGAR AHORA / VOLVER AL VAULT | ▶ PLAY NOW / BACK TO VAULT |
| MEJORES PUNTUACIONES | TOP SCORES |
| Jugador / Puntuación / Vidas / Nivel | Player / Score / Lives / Level |
| PAUSA / REANUDAR / FIN / SALIR | PAUSE / RESUME / END / EXIT |
| EN PAUSA / PULSA REANUDAR PARA CONTINUAR | PAUSED / PRESS RESUME TO CONTINUE |
| SEÑAL OK / CARGA · 1MB | SIGNAL OK / LOAD · 1MB |
| FIN DEL JUEGO / PUNTUACIÓN FINAL | GAME OVER / FINAL SCORE |
| TUS INICIALES / GUARDAR PUNTUACIÓN | YOUR INITIALS / SAVE SCORE |
| ▸ PUNTUACIÓN GUARDADA_ | ▸ SCORE SAVED_ |
| JUGAR DE NUEVO | PLAY AGAIN |
| INVITADO | GUEST |
| ACCESO AL SISTEMA · v2.6 | SYSTEM ACCESS · v2.6 |
| INICIAR SESIÓN / CREAR CUENTA | SIGN IN / CREATE ACCOUNT |
| Usuario / Correo electrónico / Contraseña | Username / Email / Password |
| ENTRAR AL VAULT / CREAR Y JUGAR | ENTER THE VAULT / CREATE AND PLAY |
| JUGAR COMO INVITADO / O CONTINÚA CON | PLAY AS GUEST / OR CONTINUE WITH |
| AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE | BY ENTERING YOU ACCEPT THE ARCADE HALL TERMS |
| SALÓN DE LA FAMA / LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA | HALL OF FAME / THE NAMES THAT NEVER LEAVE THE SCREEN |
| CAMPEÓN / RANGO / JUGADOR / PUNTUACIÓN / FECHA | CHAMPION / RANK / PLAYER / SCORE / DATE |
| VOLVER A LA BIBLIOTECA | BACK TO LIBRARY |
| © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0 | © 2026 ARCADE VAULT · MADE WITH PIXELS AND NEON · v2.6.0 |

### Game titles and ids

| Template title (id) | MVP title (id) |
| --- | --- |
| BLOQUE BUSTER (`bloque-buster`) | BLOCK BUSTER (`block-buster`) |
| CAÍDA (`caida`) | FALLDOWN (`falldown`) |
| SERPENTINA (`serpentina`) | SERPENTINE (`serpentine`) |
| GLOTÓN (`gloton`) | GLUTTON (`glutton`) |
| INVASORES (`invasores`) | INVADERS (`invaders`) |
| ROCAS (`rocas`) | ROCKS (`rocks`) |
| RANARIA (`ranaria`) | FROGGERIA (`froggeria`) |
| DUELO PIXEL (`duelo-pixel`) | PIXEL DUEL (`pixel-duel`) |

## Implementation plan

Before each step that touches a Next.js API (`params`, `generateStaticParams`, `notFound`, `usePathname`, `PageProps`), check `node_modules/next/dist/docs/`. Follow the project rule of using the `/frontend-design` skill for UI work.

1. Create `lib/games.ts` with the types, the 8 translated games, `CATEGORIES`, `getGame` and `seededScores`. Verify: `npx tsc --noEmit` passes.
2. Create `components/nav.tsx` and update `app/layout.tsx` to render the nav, `<main className="av-main">{children}</main>` and the English footer. Verify: `npm run dev` shows the nav on `/`. The hamburger opens and closes the drawer below 840px.
3. Create `components/game-card.tsx` and `components/library-browser.tsx`. Replace `app/page.tsx` with the hero and the browser. Verify: the grid shows 8 cards, and search and chips filter. A no-match query shows "NO RESULTS".
4. Create `components/leaderboard.tsx` and `app/games/[id]/page.tsx` with `generateStaticParams`, `generateMetadata` (game title) and `notFound()` for unknown ids. Verify: clicking a card opens its detail page with 10 ranked rows. The top 3 rows are gold, silver and bronze.
5. Create `app/not-found.tsx`. Verify: `/games/nope` renders the themed 404 with a link back to `/`.
6. Create `components/game-player.tsx` and `app/games/[id]/play/page.tsx`. Verify: the score ticks up, PAUSE stops it and shows the overlay, and END opens the Game Over modal. SAVE SCORE shows "▸ SCORE SAVED_". PLAY AGAIN resets, and BACK TO VAULT / EXIT navigate.
7. Create `components/auth-form.tsx` and `app/login/page.tsx`. Verify: the tabs toggle the email field. Submit and "PLAY AS GUEST" navigate to `/`. Social buttons do nothing.
8. Create `components/hall-of-fame-board.tsx` and `app/hall-of-fame/page.tsx`. Verify: the 8 game tabs switch the podium and the 12-row table. "BACK TO LIBRARY" goes to `/`.
9. Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npm run build` completes with no type or lint errors.
- [ ] `npm run lint` reports no errors.
- [ ] `/`, `/games/[id]` (all 8 ids), `/games/[id]/play` (all 8 ids), `/login` and `/hall-of-fame` render with no console errors and no hydration warnings.
- [ ] `/games/does-not-exist` and `/games/does-not-exist/play` render the themed 404 page.
- [ ] The library shows 8 cards. Typing "rock" leaves only ROCKS. Selecting "PUZZLE" leaves only FALLDOWN. A query of "zzz" shows "NO RESULTS".
- [ ] Clicking a card or its PLAY button navigates to `/games/<id>`.
- [ ] "▶ PLAY NOW" navigates to `/games/<id>/play`. "BACK TO VAULT" navigates to `/`.
- [ ] On the player the score increases while not paused and stops while paused.
- [ ] END opens the Game Over modal with the final score. SAVE SCORE replaces the input with "▸ SCORE SAVED_". PLAY AGAIN resets score to 0, lives to 3 and level to 01.
- [ ] EXIT on the player navigates to `/games/<id>`.
- [ ] Nothing is written to `localStorage`, `sessionStorage` or cookies (verified in DevTools → Application after using every screen).
- [ ] On `/login` the "CREATE ACCOUNT" tab shows the Email field and "SIGN IN" hides it. Submitting the form navigates to `/`.
- [ ] The Hall of Fame shows a podium (02 / 01 CHAMPION / 03) and a 12-row table. Clicking another game tab changes both.
- [ ] The nav's "Library" link is active on `/`, `/games/<id>` and `/games/<id>/play`. "Hall of Fame" is active on `/hall-of-fame`.
- [ ] At 375px viewport width the nav links are hidden, the hamburger opens the drawer and no page scrolls horizontally.
- [ ] No visible UI text remains in Spanish, including game titles.
- [ ] Every screen visually matches its counterpart in `references/templates/Arcade Vault.html` (same classes, colors, fonts and animations).

## Decisions

- **Yes:** English copy, `<html lang="en">`. Matches the existing layout metadata. The key-string table above is the translation reference.
- **Yes:** Game titles and ids translated to English (BLOCK BUSTER, FALLDOWN, etc.; see the title table). URLs match the visible titles.
- **No:** Keeping the Spanish titles and ids from the template.
- **No:** Spanish UI as in the templates. The user chose English.
- **Yes:** Real App Router routes (`/games/[id]`, `/games/[id]/play`, `/login`, `/hall-of-fame`). They give deep links, a working back button and static generation.
- **No:** Hash-based single-page routing as in `app.jsx`. It doesn't fit Next.js and has no real URLs.
- **No:** Spanish URL paths.
- **Yes:** Purely visual, with no storage at all. The nav always shows "Sign In". The player name defaults to "GUEST". "Save Score" only shows the confirmation.
- **No:** Mock login or score saving in `localStorage` (`av_user`, `av_scores`). It is deferred to a future auth/scores spec.
- **Yes:** Hide the Hall of Fame "Your best score" row. Without a user it never renders, which matches the template's guest state.
- **Yes:** A simulated player like the template: a score timer, a level bump every ~2,500 points, pause and the Game Over flow.
- **No:** A static player mockup.
- **Yes:** Reuse the component classes already ported to `app/globals.css`. Inline styles become Tailwind utilities with theme tokens.
- **No:** Rewriting everything in Tailwind utilities. It is more work and risks visual drift from the reference.
- **Yes:** `components/` and `lib/` at the repo root (`@/components/...`, `@/lib/games`).
- **No:** Colocated `app/_components/`.
- **Yes:** A themed `app/not-found.tsx` triggered by `notFound()`.
- **No:** The default unstyled Next.js 404.
- **Yes:** Pages are server components. Interactivity lives in small client components (`nav`, `game-card`, `library-browser`, `game-player`, `auth-form`, `hall-of-fame-board`).
- **Yes:** `generateStaticParams` on both game routes, since the 8 ids are known at build time.
- **Yes:** The Hall of Fame selected tab lives in component state, as in the template. Putting it in the URL (`?game=`) is not needed for an MVP.
- **Yes:** An explicit `"en-US"` locale for number formatting, which avoids server/client hydration mismatches.

## Risks

| Risk | Mitigation |
| --- | --- |
| Next.js 16 API differences (async `params`, `PageProps` helpers) | Read `node_modules/next/dist/docs/` before writing each page, as `AGENTS.md` requires. |
| Hydration mismatch from random or locale-dependent output | `seededScores` is deterministic. `Math.random` only runs inside the client timer. Numbers use the explicit `"en-US"` locale. |
| Card tilt sets `style.transform` imperatively and could conflict with the `.card:hover` CSS transform | Keep the template's behavior (inline transform wins while hovering, cleared on leave). |
| Player timer leaks after navigating away | The interval is cleared in the `useEffect` cleanup, as in the template. |

## What is **not** in this spec

- Real games of any kind.
- Authentication (real or mocked), sessions or user accounts.
- Score persistence or real leaderboards.
- OAuth providers.
- Backend, database or API routes.
- A credits/coins economy.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
