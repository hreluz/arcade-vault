# SPEC 11 — Touch controls for the real games

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09, SPEC 10
> **Date:** 2026-10-26
> **Objective:** Make Arkanoid, Tetris, Snake and Asteroids playable on a touch phone in portrait, through an on-screen gamepad under the CRT that drives the engines through a new typed `press()` input API.

## Why this spec exists

Every real engine listens only to `keydown` / `keyup` on `window` (Arkanoid also follows `mousemove`). On a touch device the ready overlay hides the keyboard prompt and shows `KEYBOARD REQUIRED` (`@media (pointer: coarse)` in `app/globals.css`), so the four real games cannot be played on a phone at all. SPEC 10 deferred touch controls to their own spec; this is it.

The chosen approach is one shared on-screen pad (D-pad + two action buttons) with a per-game layout declared in `ENGINES`, rather than per-engine gestures. Buttons do not fake keyboard events. Instead, `GameEngine` gets an explicit `press(code, down)` method that each engine routes into the same handler its key listeners use, so touch and keyboard share one code path per game. Tetris relies on the OS key-repeat for held moves, so the pad provides its own auto-repeat for the buttons that need it.

## Scope

**In:**

- Contract: `press(code, down)` on `GameEngine` (required), a `PadButton` type and a required `pad` field on `EngineEntry`.
- All four engines: key handling refactored into `handleKeyDown(code, repeat)` / `handleKeyUp(code)`, called by both the `window` listeners and `press()`. Keyboard behaviour is unchanged.
- Arkanoid: the canvas `mousemove` listener becomes `pointermove` + `pointerdown` (mouse, touch and pen), so dragging a finger on the canvas moves the paddle.
- `components/touch-pad.tsx`: the on-screen pad (D-pad slots `up` / `down` / `left` / `right`, action slots `a` / `b`). Buttons are held while the finger is down, with optional auto-repeat. It supports multi-touch (e.g. hold ← and press FIRE), and calls `navigator.vibrate(10)` on each press where supported.
- `GameCanvasHandle` gains `start` and `press`.
- Player on touch (`pointer: coarse`) devices:
  - The ready overlay shows `TAP TO START` (replacing `KEYBOARD REQUIRED`), and tapping it starts the run.
  - The keyboard legend is hidden in the ready overlay and in `.crt-bottom`.
  - The pad is shown under the CRT.
  - The CRT frame is compacted, so the CRT and the full pad fit on a 375×667 viewport.
- Gesture blocking on the pad, the canvas and the ready overlay: no page scroll, no double-tap zoom, no long-press callout / context menu, no text selection, no tap highlight.
- A mobile layout for the HUD (stats and the SOUND / PAUSE / END / EXIT row) at narrow widths.

**Out of scope (for future specs):**

- Landscape layout, the Fullscreen API and orientation lock.
- Swipe / tap gestures on the canvas, except Arkanoid's paddle drag.
- A CONTROLS ON / OFF toggle, or showing the pad on fine pointers (touch laptops, desktop).
- A per-game touch legend (`touchControls` strings).
- Auto-fire on a held FIRE in Asteroids (FIRE behaves exactly like Space: one shot per press).
- A haptics on/off setting.
- Touch support for the four simulated games (they have no ready overlay and no pad, and stay as they are).
- Committing `allowedDevOrigins` in `next.config.ts` (machine-specific LAN IP for testing on a real phone; it stays local).
- The Gamepad API, PWA / installability, and new game actions.
- Automated tests (no test runner is configured).

## Data model

### Contract (`lib/engines/types.ts`)

```ts
// Keyboard codes the pad can send; each engine already handles these keys.
export type PadCode = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Space";

export type PadSlot = "up" | "down" | "left" | "right" | "a" | "b";

export type PadButton = {
  slot: PadSlot; // where it sits: D-pad (up/down/left/right) or action (a/b)
  code: PadCode; // what press() receives
  label: string; // visible text, e.g. "◀", "ROTATE", "FIRE"
  ariaLabel: string; // accessible name of the action, e.g. "Move left"
  repeat?: true; // while held, re-send press(code, true) after 170 ms, then every 50 ms
};

export interface GameEngine {
  // ...existing methods unchanged
  press(code: PadCode, down: boolean): void; // on-screen input; same effect as the key going down / up
}
```

- `press(code, true)` calls `handleKeyDown(code, false)`, and `press(code, false)` calls `handleKeyUp(code)`. A repeated `press(code, true)` from the pad's auto-repeat is handled like a fresh keydown (`repeat` = `false`). Every engine already treats a repeated down of a held key correctly: Tetris moves once per down, Asteroids only sets `justPressed` when the key was not already held, Snake ignores a repeated direction, and Arkanoid sets the held flag again.
- Phase rules are the keyboard's own. A press in `ready` with `Space` starts the run (Tetris DROP, Asteroids FIRE), and in `paused` / `over` direction presses are ignored.
- The pad never sends `KeyP` / `Escape`. Pause and resume go through the existing HUD buttons.

### Registry (`lib/engines/index.ts`)

```ts
export type EngineEntry = {
  factory: EngineFactory;
  controls: string; // one-line keyboard legend (hidden on coarse pointers)
  pad: PadButton[]; // on-screen layout; required for every real engine
  sound?: true;
};
```

| Game      | `left`                | `right`                | `up`        | `down`                | `a`              | `b`          |
| --------- | --------------------- | ---------------------- | ----------- | --------------------- | ---------------- | ------------ |
| Snake     | `◀` ArrowLeft         | `▶` ArrowRight         | `▲` ArrowUp | `▼` ArrowDown         | —                | —            |
| Tetris    | `◀` ArrowLeft, repeat | `▶` ArrowRight, repeat | —           | `▼` ArrowDown, repeat | `ROTATE` ArrowUp | `DROP` Space |
| Asteroids | `◀` ArrowLeft         | `▶` ArrowRight         | —           | —                     | `THRUST` ArrowUp | `FIRE` Space |
| Arkanoid  | `◀` ArrowLeft         | `▶` ArrowRight         | —           | —                     | —                | —            |

An empty slot is not rendered, but it keeps its place in the grid, so the D-pad shape stays the same across games.

### Canvas handle (`components/game-canvas.tsx`)

```ts
export type GameCanvasHandle = Pick<
  GameEngine,
  "start" | "pause" | "resume" | "end" | "restart" | "press"
>;
```

### Touch pad (`components/touch-pad.tsx`, client)

```ts
type Props = { buttons: PadButton[]; onPress: (code: PadCode, down: boolean) => void };
export default function TouchPad(props: Props): JSX.Element;
```

- One `<button type="button">` per entry, positioned by `slot` in a two-area grid: the D-pad on the left and actions `a` (top) / `b` (bottom) on the right.
- `pointerdown`:
  - `setPointerCapture`, then `onPress(code, true)` and `navigator.vibrate?.(10)` (guarded with `typeof navigator.vibrate === "function"`).
  - A pressed visual state.
  - If `repeat`, a timer that re-sends `onPress(code, true)` after 170 ms, then every 50 ms.
- `pointerup`, `pointercancel` and `lostpointercapture`: clear the timer, `onPress(code, false)`, and drop the pressed state. Each button tracks its own pointer id, so several buttons can be held at once.
- On `window` `blur` and on unmount, every held button is released (timers cleared, `onPress(code, false)`).
- `contextmenu` is prevented. The pad has `aria-label="Touch controls"`, and each button an `aria-label` naming the action (e.g. "Move left", "Rotate", "Fire").
- No new persisted data. Haptics have no setting.

## Behavior

### Engines (`lib/engines/*.ts`)

- Each `onKeyDown(e)` keeps its `isEditable` check and its `preventDefault()` on `GAME_KEYS`, then calls `handleKeyDown(e.code, e.repeat)`. `onKeyUp(e)` calls `handleKeyUp(e.code)`. The body of each handler is the existing `switch`, unchanged.
- `press()` is added to the returned engine object. It is a no-op after `destroy()`.
- Arkanoid: `onMouseMove` becomes `onPointerMove`, registered for `pointermove` and `pointerdown` on the canvas and removed in `destroy()`. It keeps the same `phase === "playing"` check and logical-coordinate mapping. A tap moves the paddle under the finger at once; a drag follows it.

### Player (`components/game-player.tsx`)

- When `entry` exists, `<TouchPad buttons={entry.pad} onPress={(c, d) => engineRef.current?.press(c, d)} />` is rendered right after `.crt`. It is always in the DOM (no hydration mismatch), and CSS shows it only under `(pointer: coarse)`.
- Ready overlay:
  - `.ready-touch` reads `TAP TO START`, in the same pixel style and pulse as `.ready-prompt`.
  - A `click` on the overlay calls `engineRef.current?.start()` only when `window.matchMedia("(pointer: coarse)").matches`, so desktop clicks change nothing.
  - The click is a user gesture, so Arkanoid's `AudioContext` is created inside it (SPEC 09).
- `.crt-legend` is hidden under `(pointer: coarse)`. The `.ready-keys` block is already hidden there.
- Simulated games render neither the pad nor the ready overlay.

### Layout (`app/globals.css`, designed with `/frontend-design`)

- `.touch-pad`:
  - Hidden by default, `display: grid` under `(pointer: coarse)`.
  - Neon styling consistent with `.btn`: cyan D-pad and magenta / yellow actions.
  - D-pad buttons 64×64 px and round action buttons 72×72 px, with a pressed state (glow + slight scale).
  - The whole pad is at most 210 px tall.
- Gesture blocking on `.touch-pad`, `.game-canvas` and `.ready-overlay`: `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`.
- Under `(pointer: coarse)` the `.crt` padding drops from 24 px to 8 px (with a smaller border radius), and the gap between the CRT and the pad is ≤ 12 px.
- HUD at `max-width: 640px`: compact stats (smaller label / value sizes, tighter gaps), and `.hud-actions` as one non-wrapping row of equal-width buttons (`flex: 1`, smaller padding and font), so SOUND / PAUSE / END / EXIT fit on 375 px without horizontal scroll.
- Desktop (fine pointer, ≥ 641 px) renders exactly as before.

## Files

| File                         | Kind     | Purpose                                                       |
| ---------------------------- | -------- | ------------------------------------------------------------- |
| `lib/engines/types.ts`       | modified | `PadCode`, `PadSlot`, `PadButton`, `press()` on `GameEngine`  |
| `lib/engines/index.ts`       | modified | `pad` on `EngineEntry` and on the four entries                |
| `lib/engines/snake.ts`       | modified | `handleKeyDown` / `handleKeyUp`, `press()`                    |
| `lib/engines/tetris.ts`      | modified | Same                                                          |
| `lib/engines/asteroids.ts`   | modified | Same                                                          |
| `lib/engines/arkanoid.ts`    | modified | Same, plus `pointermove` / `pointerdown` paddle               |
| `components/game-canvas.tsx` | modified | Handle exposes `start` and `press`                            |
| `components/touch-pad.tsx`   | new      | On-screen pad                                                 |
| `components/game-player.tsx` | modified | Renders the pad, tap to start                                 |
| `app/globals.css`            | modified | Pad, gesture blocking, compact CRT, legend hiding, mobile HUD |
| `CLAUDE.md`                  | modified | Game engines section: `press()`, `pad`, touch pad             |

`next.config.ts` is not part of this change.

## Implementation plan

Use the `/frontend-design` skill for the UI steps. Before writing client components, check `node_modules/next/dist/docs/` (`01-app/`).

1. Contract: add `PadCode`, `PadSlot`, `PadButton` and `press()` to `lib/engines/types.ts`. In each of the four engines, extract `handleKeyDown` / `handleKeyUp` from the key listeners and add `press()`. Add `pad` to `EngineEntry` and the four layouts to `ENGINES`. Verify: `npx tsc --noEmit` passes, and on desktop every game plays exactly as before.
2. Arkanoid: replace `mousemove` with `pointermove` + `pointerdown`. Verify: mouse control on desktop is unchanged.
3. `GameCanvasHandle` gets `start` and `press`. Build `components/touch-pad.tsx` and render it in `GamePlayer`. Add the tap-to-start click and the `TAP TO START` text. Verify under Playwright touch emulation (375×667, `hasTouch`, `isMobile`): the pad appears and each game starts by tapping.
4. CSS: pad styles, gesture blocking, compact CRT under `(pointer: coarse)`, hidden `.crt-legend`, mobile HUD at ≤ 640 px. Verify: the CRT + pad fit at 375×667, and desktop at 1280 px is unchanged (screenshots in `.playwright-screenshots/`).
5. Check the acceptance criteria below by hand, in emulation and if possible on a real phone over the LAN (local `allowedDevOrigins`, not committed).
6. Update `CLAUDE.md` (Game engines section). Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] On desktop (fine pointer, 1280 px), the four games look and play exactly as before: keyboard controls, legends in the ready overlay and in `.crt-bottom`, Arkanoid mouse control, and no pad visible. Clicking the ready overlay does not start a game.
- [ ] Under touch emulation (375×667, `hasTouch`, `isMobile`), `/games/<id>/play` for each of the four games shows `TAP TO START` and no `KEYBOARD REQUIRED`. Tapping the overlay starts the run, and no keyboard legend is visible anywhere on the player.
- [ ] Under the same emulation, when the page is scrolled so the top of the CRT is at the top of the viewport, the whole CRT and the whole pad are visible. There is no horizontal scroll, and the HUD's four buttons sit on one row.
- [ ] Snake: ▲ ▼ ◀ ▶ steer, and two quick taps between steps queue two turns (as with the keyboard).
- [ ] Tetris: one tap of ◀ / ▶ / ▼ moves one cell, holding auto-repeats after a short delay, ROTATE rotates once per tap, and DROP hard-drops once per tap.
- [ ] Asteroids: holding ◀ / ▶ rotates continuously, holding THRUST thrusts, and FIRE fires one shot per tap (holding fires no more). Holding ◀ while tapping FIRE works (multi-touch).
- [ ] Arkanoid: holding ◀ / ▶ moves the paddle, and dragging a finger on the canvas moves the paddle under it. With SOUND ON, the bounce / break sounds play after starting by tap.
- [ ] Releasing a finger outside its button, or a pointer cancel, stops the action (no stuck thrust or paddle). Switching tabs pauses the game and leaves no button held.
- [ ] Touching the pad or the canvas never scrolls or zooms the page, and a long press shows no callout, selection or context menu.
- [ ] The HUD PAUSE / RESUME / END buttons work by tap. While paused, pad direction presses do nothing. The GAME OVER modal's initials input and SAVE SCORE work on touch, and saving a score shows `▸ SCORE SAVED — RANK #NN_`.
- [ ] On Android, each pad press gives a short vibration. Where `navigator.vibrate` is missing (iOS, desktop) there is no error.
- [ ] EXIT and coming back (also in `npm run dev` Strict Mode): one press acts once, so there is one engine and no leftover repeat timer.
- [ ] Simulated games (e.g. `/games/glutton/play`) show no pad and still show the fake arena, three hearts and `SCORES NOT RECORDED FOR THIS DEMO`.
- [ ] No console errors or hydration warnings on any player page, in desktop or touch emulation.

## Decisions taken and discarded

| Decision            | Chosen                                                                    | Discarded                                       | Why                                                                                             |
| ------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Input model         | Shared on-screen pad with per-game layout                                 | Per-engine canvas gestures; hybrid              | One component for all games, predictable, testable; Asteroids is awkward with gestures.         |
| Games               | All four real engines in this spec                                        | Shared layer + one game                         | The goal is "the games run on mobile"; each extra game is just a `pad` entry.                   |
| Bridge              | Typed `press(code, down)` on `GameEngine`, same handler as keys           | Synthetic `KeyboardEvent`s on `window`          | Explicit contract; no clash with `isEditable`, `isTrusted` or `repeat` semantics.               |
| `press` required    | Required on `GameEngine`, `pad` required on `EngineEntry`                 | Optional                                        | Every new real engine must be playable on touch.                                                |
| Hold / repeat       | Held state for every button; auto-repeat (170 ms / 50 ms) on Tetris moves | One action per tap                              | Asteroids thrust and Arkanoid need holds; Tetris needs the key-repeat it gets from the OS.      |
| Asteroids FIRE      | One shot per press, like Space                                            | Auto-fire while held                            | Same gameplay on touch and keyboard.                                                            |
| Start               | Tap the ready overlay (coarse pointers only)                              | START button in the pad                         | No duplicate of the HUD PAUSE; the tap is a gesture that unlocks audio.                         |
| Arkanoid            | Drag on canvas + ◀ ▶ buttons (`pointermove` / `pointerdown`)              | Buttons only                                    | Drag is the natural paddle control; pointer events also keep mouse working.                     |
| Orientation         | Portrait only                                                             | Landscape layout; fullscreen + orientation lock | Simplest to get right; Fullscreen API is unavailable for pages on iOS Safari.                   |
| Visibility          | `(pointer: coarse)` media query, pad always in DOM                        | Toggle in HUD; always visible                   | Desktop unchanged; CSS-only switch avoids hydration mismatches.                                 |
| Legend on touch     | Hidden; pad labels explain the controls                                   | Per-game `touchControls` string                 | Keyboard keys are meaningless on a phone; no second legend to maintain.                         |
| Fit                 | CRT + pad fit 375×667 when scrolled to the CRT, compact CRT frame         | Page may scroll between CRT and pad             | Players must see the game while using the pad.                                                  |
| Pad size            | D-pad 64 px, round action buttons 72 px, pad ≤ 210 px tall                | 56 px buttons, pad ≤ 180 px                     | 56 px was planned too small to hit reliably (real-phone test after Step 3); still fits 375×667. |
| `ariaLabel`         | Per-button `ariaLabel` in the `pad` layout                                | Visible `label` as the accessible name          | The same key means different actions per game (↑ = Steer up / Rotate / Thrust).                 |
| HUD                 | Compact mobile HUD at ≤ 640 px, actions on one row                        | Leave it wrapping; own spec                     | Needed so the player page works on a phone; small CSS change.                                   |
| Haptics             | `navigator.vibrate(10)` per press, no setting                             | No haptics; a setting                           | Cheap tactile feedback on Android; iOS silently ignores it.                                     |
| Pause on touch      | Existing HUD PAUSE / RESUME                                               | Pad button sending `KeyP`                       | Already works by tap; keeps the pad focused on gameplay.                                        |
| `allowedDevOrigins` | Left out (local only)                                                     | Commit the LAN IP                               | Machine-specific value.                                                                         |

## Identified risks

| Risk                                                                      | Mitigation                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A missed `pointerup` leaves a button held (stuck thrust / paddle)         | Pointer capture, release on `pointercancel`, `lostpointercapture`, `window` blur and unmount; acceptance criterion.                         |
| Auto-repeat timer survives unmount or Strict Mode remount                 | Timers live per button and are cleared on release and unmount; acceptance criterion.                                                        |
| iOS Safari still zooms or scrolls on double tap / drag                    | `touch-action: none` on pad, canvas and overlay, plus `user-select` / callout / tap-highlight resets; checked on a real device if possible. |
| Refactoring key handlers changes keyboard behaviour                       | Handler bodies move unchanged; step 1 verifies desktop play before any UI work; acceptance criterion.                                       |
| Arkanoid audio does not unlock on iOS                                     | Start is a `click` on the overlay (a user gesture recognised by iOS), so `AudioContext` is created inside it.                               |
| `pointer: coarse` misclassifies hybrid devices (touch laptops get no pad) | Accepted; a CONTROLS toggle is out of scope and can come in its own spec.                                                                   |
| Playwright emulation differs from real devices (vibrate, callouts, audio) | Real-phone check over the LAN with a local `allowedDevOrigins`.                                                                             |
| Pad + CRT do not fit on smaller phones (e.g. 320 px wide)                 | Target is 375×667; smaller screens may scroll, and that is accepted.                                                                        |

## What is **not** in this spec

- Landscape, fullscreen or orientation lock.
- Canvas gestures other than Arkanoid's paddle drag.
- A controls toggle or a touch legend.
- Auto-fire, a haptics setting or new game actions.
- Touch for simulated games.
- Committing `allowedDevOrigins`.
- Gamepad API, PWA.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
