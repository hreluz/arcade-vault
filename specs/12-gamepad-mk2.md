# SPEC 12 — Gamepad MK-II touch pad

> **Status:** Approved
> **Depends on:** SPEC 11
> **Date:** 2026-11-02
> **Objective:** Restyle the on-screen touch pad as the neon Gamepad MK-II from `references/gamepad-assets/`, keeping the SPEC 11 input behavior and tap sizes.

## Why this spec exists

SPEC 11 made the four real games playable on touch phones, but its pad is a set of loose buttons under the CRT. `references/gamepad-assets/` holds the design that should replace it: a single controller shell with a beveled D-pad, a center hub gem and glossy A / B buttons.

This is a visual change to an existing component. The reference's script is not ported, because `components/touch-pad.tsx` already handles holds, multi-touch, auto-repeat and release.

The reference cannot be copied exactly on a phone. Its side-by-side layout only fits 375 px with 46 px D-pad buttons, and SPEC 11 already rejected 56 px as too small after a real-phone test. This spec keeps the tested sizes and staggers A / B instead.

## Scope

**In:**

- The MK-II look on `.touch-pad` under `(pointer: coarse)`: shell, double border, dot texture, beveled D-pad buttons with SVG arrows, center hub with a pulsing gem, and glossy round A / B buttons.
- A / B colors from the reference: A magenta, B cyan. This replaces the yellow B.
- A staggered A / B layout: A high on the right, B low on the left.
- The letter `A` / `B` on each action button, with the game's action as a small caption (`ROTATE`, `DROP`, `THRUST`, `FIRE`).
- Every slot always rendered: unused buttons are dimmed, disabled and silent.
- The `PadButton` type: `label` becomes an optional `caption`, used only by `a` / `b`.

**Out of scope (for future specs):**

- Showing the gamepad on desktop or fine pointers, including mouse use and lighting buttons from the keyboard.
- The Gamepad API (physical controllers).
- Landscape layout, fullscreen and orientation lock.
- New game actions, or changes to which key each button sends.
- Touch support for the simulated games.
- A controls toggle or a haptics setting.
- Automated tests (no test runner is configured).

## Data model

No new persisted data. The only type change is in `lib/engines/types.ts`:

```ts
export type PadButton = {
  slot: PadSlot;
  code: PadCode;
  ariaLabel: string;
  caption?: string; // action shown next to A / B, e.g. "ROTATE"; D-pad buttons have none
  repeat?: true;
};
```

`PadCode`, `PadSlot`, `press()` and `GameCanvasHandle` do not change.

The `ENGINES` layouts in `lib/engines/index.ts` keep their slots, codes, `ariaLabel` and `repeat`. D-pad entries drop `label`, and `a` / `b` entries rename it to `caption`:

| Game      | Active D-pad slots    | `a` caption | `b` caption | Dimmed slots   |
| --------- | --------------------- | ----------- | ----------- | -------------- |
| Snake     | up, down, left, right | —           | —           | a, b           |
| Tetris    | left, right, down     | `ROTATE`    | `DROP`      | up             |
| Asteroids | left, right           | `THRUST`    | `FIRE`      | up, down       |
| Arkanoid  | left, right           | —           | —           | up, down, a, b |

## Behavior

### Touch pad (`components/touch-pad.tsx`)

- The component name, the `Props` type, and the `.touch-pad` and `.pad-*` class prefixes stay.
- The pointer handling is unchanged: pointer capture, per-finger holds, 170 ms / 50 ms auto-repeat, release on `pointerup` / `pointercancel` / `lostpointercapture` / `blur` / unmount, and `navigator.vibrate(10)`.
- D-pad buttons render the reference's four SVG arrows, keyed by slot, with `fill="currentColor"`.
- Action buttons render the letter from their slot, plus `caption` when present.
- The hub and its gem are `aria-hidden` and take no input.
- An unused slot renders `<button type="button" disabled aria-hidden="true" tabIndex={-1}>` with its arrow or letter, no caption and no handlers. It never calls `onPress` or vibrates.

### Layout (`app/globals.css`, designed with `/frontend-design`)

- Tokens and values come from `references/gamepad-assets/gamepad.html`. The `--cyan`, `--magenta`, `--line` and `--pixel` tokens already exist in the app.
- `.touch-pad` stays hidden by default and shows only under `(pointer: coarse)`. Its margin to the CRT stays ≤ 12 px.
- Shell: 1 px border plus the inset border and dot texture, with 10 px / 12 px padding and a total height ≤ 230 px.
- D-pad: three 64 px columns and rows with a 6 px gap (204 px), with the hub in the center cell.
- Action area: it takes the remaining width, with A aligned to the right edge and B to the left edge.
  - Heights, top to bottom: A caption 12 px, A 72 px, a 4 px gap, B 72 px, B caption 12 px (172 px in total).
  - The vertical offset alone keeps the circles apart, so the horizontal stagger can shrink with the screen without them overlapping. It is about 41 px at 375 px wide and close to 0 at 320 px.
- Under `max-width: 359px`, the shell's side padding drops to 6 px and the D-pad gap to 4 px. This fits 64 px and 72 px buttons at 320 px with no horizontal scroll.
- Captions: `--pixel` at 7 px, in the button's color. A's caption sits above A and B's sits below B, so neither touches the other circle. Captions are positioned inside the button with `pointer-events: none`, so they do not widen the tap target.
- Pressed state uses the existing `data-pressed` attribute, not the reference's `.on` class. It applies the reference's sunken position, glow and A / B dashed ring. `:hover` styles are not ported, since they stick on touch screens.
- Dimmed slots: no glow, about 35 % opacity, and no pressed state.
- `prefers-reduced-motion`: the gem does not pulse and pressed buttons do not move.
- The SPEC 11 gesture blocking stays on `.touch-pad`, `.pad-btn`, `.game-canvas` and `.ready-overlay`.
- Fine pointers render exactly as before.

## Files

| File                       | Kind     | Purpose                                                |
| -------------------------- | -------- | ------------------------------------------------------ |
| `lib/engines/types.ts`     | modified | `label` becomes optional `caption`                     |
| `lib/engines/index.ts`     | modified | Layouts use `caption`; D-pad entries drop `label`      |
| `components/touch-pad.tsx` | modified | SVG arrows, hub, letters, captions, dimmed slots       |
| `app/globals.css`          | modified | MK-II styles replace the `.touch-pad` / `.pad-*` rules |
| `CLAUDE.md`                | modified | Touch controls section and specs list                  |

`components/game-player.tsx` does not change. `references/gamepad-assets/` is read only, and no image or font is copied from it.

## Implementation plan

Use the `/frontend-design` skill for the UI steps. Before writing client components, check `node_modules/next/dist/docs/` (`01-app/`).

1. Change `PadButton` and the `ENGINES` layouts. Render `caption` in place of `label` in `TouchPad`, and arrow characters by slot. Verify: `npx tsc --noEmit` passes and the pad still works.
2. Render all six slots in `TouchPad`, with SVG arrows, the hub, letters, captions and disabled unused slots. Verify under Playwright touch emulation: Arkanoid shows six buttons and only ◀ ▶ respond.
3. Replace the `.touch-pad` and `.pad-*` styles with the MK-II look, including the stagger, dimmed and pressed states. Verify: screenshots at 375×667 in `.playwright-screenshots/`, compared with `references/gamepad-assets/gamepad-neon.png`.
4. Add the `max-width: 359px` adjustments and the reduced-motion rules. Verify: 320×568 has no horizontal scroll.
5. Update `CLAUDE.md` (Touch controls section, specs list). Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] Under touch emulation at 375×667, all four real games show one shell with the D-pad on the left, the hub gem in the center, A high on the right and B low on its left.
- [ ] At 375×667, with the top of the CRT at the top of the viewport, the whole CRT and whole gamepad are visible.
- [ ] Measured with `getBoundingClientRect`, D-pad buttons are 64×64 px and A / B are 72×72 px at 375 px and at 320 px wide.
- [ ] The gamepad's shell is at most 230 px tall at 375 px wide.
- [ ] 375×667, 360×640 and 320×568 have no horizontal scroll, and the A and B circles do not overlap.
- [ ] A is magenta and B is cyan.
- [ ] Tetris shows `ROTATE` above A and `DROP` below B. Asteroids shows `THRUST` above A and `FIRE` below B. Each caption is fully visible and touches no other button.
- [ ] Snake shows dimmed A / B with no captions. Arkanoid shows dimmed ▲ ▼ A B with no captions. Tetris dims ▲ and Asteroids dims ▲ ▼.
- [ ] Tapping a dimmed button sends no input, shows no pressed state and does not vibrate.
- [ ] Every SPEC 11 touch behavior still passes: Snake's two queued turns, Tetris auto-repeat, Asteroids holding ◀ while tapping FIRE, and no stuck button after a release outside the button or a tab switch.
- [ ] A pressed button shows the sunken glow state. With `prefers-reduced-motion`, the gem does not pulse and pressed buttons do not move.
- [ ] Touching the gamepad never scrolls or zooms the page, and a long press shows no callout, selection or context menu.
- [ ] Desktop at 1280 px shows no gamepad, and the four games look and play as before.
- [ ] Simulated games (e.g. `/games/glutton/play`) show no gamepad.
- [ ] No console errors or hydration warnings on any player page, in desktop or touch emulation.
- [ ] Files under `references/gamepad-assets/` are unchanged.

## Decisions taken and discarded

| Decision       | Chosen                                                   | Discarded                                        | Why                                                                                    |
| -------------- | -------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Visibility     | Touch only, `(pointer: coarse)`                          | Also on desktop, lit by the keyboard             | Desktop stays unchanged, with no taller player page or new input path.                 |
| Fit on phones  | Keep 64 / 72 px, stagger A / B                           | The reference's 46 / 64 px side by side; stacked | Keeps the sizes tested on a real phone and stays close to the reference.               |
| Stagger        | Vertical offset fixed, horizontal offset fills the space | Fixed diagonal offset                            | The circles can never overlap, and 320 px still fits without shrinking the buttons.    |
| A / B labels   | Letter plus a small action caption                       | Action text on the button; letter only           | Keeps the reference look, and the touch legend is hidden so players need the action.   |
| Unused buttons | Dimmed and disabled                                      | Hidden, as in SPEC 11                            | The same physical controller in every game, with no broken cross in Arkanoid or Snake. |
| `label` field  | Optional `caption`, D-pad arrows drawn as SVG by slot    | Keep `label` on every button                     | A D-pad `label` would be dead data, because arrows now depend only on the slot.        |
| Input code     | Keep `TouchPad`'s pointer handling                       | Port the reference's script                      | The reference only toggles a class; the existing code holds, repeats and releases.     |
| Class names    | Keep `.touch-pad` and `.pad-*`                           | Reference's `.gp`, `.dp`, `.ab`                  | The `mobile-porter` agent and SPEC 11 refer to these names.                            |
| B color        | Cyan, from the reference                                 | Yellow, from SPEC 11                             | Matches the design being implemented.                                                  |
| Hover styles   | Not ported                                               | Copy `:hover` rules                              | The pad only shows on touch screens, where hover states stick after a tap.             |

## Identified risks

| Risk                                                                 | Mitigation                                                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Captions or the dashed ring widen the tap target or block a neighbor | Both use `pointer-events: none`; the ring is decorative and captions are checked by a criterion.                             |
| The shell makes the gamepad too wide on narrow phones                | Reduced padding and gap under 360 px; 320 px and 360 px are acceptance criteria.                                             |
| Layered glows and the gem animation slow low-end phones during play  | The gem animates only `opacity` and `transform`; glow transitions are limited to the pressed button.                         |
| Emulation differs from a real device                                 | Sizes are unchanged from SPEC 11, and a real-phone check over the LAN is advised (local `allowedDevOrigins`, not committed). |

## What is **not** in this spec

- The gamepad on desktop or fine pointers.
- The Gamepad API.
- Landscape, fullscreen or orientation lock.
- New game actions or changed key mappings.
- Touch for simulated games.
- A controls toggle or a haptics setting.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
