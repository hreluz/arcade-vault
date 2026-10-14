# SPEC 09 — Arkanoid sound effects

> **Status:** Approved
> **Depends on:** SPEC 07, SPEC 08
> **Date:** 2026-10-13
> **Objective:** Play the reference Arkanoid's two sound effects (ball bounce and brick break) through the Web Audio API, with a remembered SOUND ON / OFF button in the player HUD.

## Why this spec exists

SPEC 08 ported Arkanoid without sound because sound needs a mute concern in the player and a change to the engine contract. The reference plays `ball-bounce.mp3` and `break-sound.mp3` with `new Audio(...).cloneNode().play()` on every hit. This spec adds both sounds, an optional `setMuted()` in the engine contract and one mute button shared by every game that declares sound. Arkanoid is the only reference game that ships sound files, so it is the only engine that gets `sound: true`.

## Scope

**In:**

- Assets: `ball-bounce.mp3` and `break-sound.mp3` copied from `references/started-games/04-arkanoid/assets/sounds/` to `public/games/arkanoid/`.
- Contract: optional `setMuted?(muted: boolean): void` on `GameEngine`, optional `sound?: true` on `EngineEntry`. Asteroids and Tetris are not modified.
- Arkanoid engine: Web Audio playback of the two sounds at the reference's trigger points, `setMuted()`, autoplay-policy unlock, cleanup in `destroy()`.
- Player: a `SOUND ON` / `SOUND OFF` button, first in `.hud-actions`, shown only when the game's `ENGINES` entry has `sound: true`.
- Persistence: the setting is stored in `localStorage` under `arcade-vault:sound` and applies to every game with sound.

**Out of scope (for future specs):**

- Volume control (slider or fixed gain). Sounds play at the files' own level.
- A keyboard shortcut for mute (`M`). The Arkanoid legend does not change.
- New sounds: lost life, level change, game over, menu clicks, music.
- Sound for Asteroids, Tetris or the simulated games.
- Sound for touch / mobile beyond what the browser allows by default.

## Data model

### Assets

| File                                    | Source                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| `public/games/arkanoid/ball-bounce.mp3` | `references/started-games/04-arkanoid/assets/sounds/` (10.6 KB) |
| `public/games/arkanoid/break-sound.mp3` | `references/started-games/04-arkanoid/assets/sounds/` (8.7 KB)  |

### Contract (`lib/engines/types.ts`, `lib/engines/index.ts`)

```ts
export interface GameEngine {
  // ...existing methods unchanged
  setMuted?(muted: boolean): void; // only engines with sound implement it
}

export type EngineEntry = {
  factory: EngineFactory;
  controls: string;
  sound?: true; // the player shows the SOUND button
};

arkanoid: { factory: createArkanoid, controls: "← → / MOUSE MOVE · P PAUSE", sound: true },
```

- `GameCanvasHandle` is unchanged. `GameCanvas` gets a new prop `muted: boolean`. It calls `engine.setMuted?.(muted)` right after creating the engine and whenever `muted` changes. A change of `muted` never recreates the engine.

### Sound setting (`lib/sound-setting.ts`, client)

- `localStorage` key `arcade-vault:sound`, value `"on"` or `"off"`. A missing or unknown value, or a `localStorage` that throws, means `"on"`.
- `useSoundSetting(): [soundOn: boolean, setSoundOn: (on: boolean) => void]`, built on `useSyncExternalStore`:
  - `getServerSnapshot` always returns `"on"`, so the server HTML says `SOUND ON` and hydration never mismatches. After hydration the stored value applies.
  - It subscribes to the `storage` event (other tabs) and to an in-page event fired by `setSoundOn`, so every mounted player stays in sync.
  - `setSoundOn` writes the key (write errors are ignored, and the value still applies in memory for the session).

### Arkanoid audio (`lib/engines/arkanoid.ts`)

- New closure state: `audio: AudioContext | null`, `buffers: { bounce: AudioBuffer | null; break: AudioBuffer | null }`, `bytes` (the fetched `ArrayBuffer`s), `muted: boolean` (starts `false`), an `AbortController` for the fetches.
- New module-level constants: `BOUNCE_SRC = "/games/arkanoid/ball-bounce.mp3"`, `BREAK_SRC = "/games/arkanoid/break-sound.mp3"`.
- Loading: the factory `fetch`es both files into `ArrayBuffer`s. It does **not** create an `AudioContext` (creating one before a user gesture logs a Chrome autoplay warning).
- Unlock: `start()`, `resume()` and `restart()` call `ensureAudio()`. They all run inside a user gesture (Space keydown, P keydown, RESUME / PLAY AGAIN click). The first call creates the `AudioContext` and decodes both buffers. Later calls only `audio.resume()` if the context is `suspended`. `Escape` is not a user-activation key, but by the time `Escape` resumes, the context already exists.
- Playback: `play(buffer)` does nothing if `muted`, `audio` is null or the buffer is not decoded yet. Otherwise it creates a new `AudioBufferSourceNode` connected to `audio.destination` and starts it at once. Overlapping sounds are allowed, as in the reference.
- Triggers, identical to the reference's `update(dt)`:

  | Event                                 | Sound             |
  | ------------------------------------- | ----------------- |
  | Ball hits the left, right or top wall | `ball-bounce.mp3` |
  | Ball bounces off the paddle           | `ball-bounce.mp3` |
  | Ball breaks a brick                   | `break-sound.mp3` |
  | Lost ball, level change, end of run   | none              |

- Sounds only fire from `updatePlaying`, so `ready`, `paused` and `over` are silent. A sound already playing when the game pauses plays out (they are under 1 s).
- `setMuted(m)` sets `muted`. It does not stop sounds already playing.
- `destroy()` also aborts the fetches and calls `audio.close()` (errors ignored). A decode that finishes after `destroy()` is ignored.
- If a fetch or decode fails, that sound stays `null` and the game runs silently. No error is thrown.

### Player (`components/game-player.tsx`)

- `const [soundOn, setSoundOn] = useSoundSetting();`
- When `entry?.sound`, `.hud-actions` starts with `<button type="button" className="btn ghost" aria-pressed={soundOn}>` labelled `SOUND ON` or `SOUND OFF`. A click toggles the setting and then drops focus (the same `releaseFocus` as PAUSE / END), so Space never re-clicks it.
- `<GameCanvas ... muted={!soundOn} />`.
- Games without `sound` (Asteroids, Tetris, simulated games) show no SOUND button.

## Files

| File                                    | Kind     | Purpose                                                  |
| --------------------------------------- | -------- | -------------------------------------------------------- |
| `public/games/arkanoid/ball-bounce.mp3` | new      | Copy of the reference bounce sound                       |
| `public/games/arkanoid/break-sound.mp3` | new      | Copy of the reference break sound                        |
| `lib/engines/types.ts`                  | modified | Optional `setMuted?` on `GameEngine`                     |
| `lib/engines/index.ts`                  | modified | `sound?: true` on `EngineEntry`; Arkanoid `sound: true`  |
| `lib/engines/arkanoid.ts`               | modified | Web Audio loading, unlock, triggers, `setMuted`, cleanup |
| `lib/sound-setting.ts`                  | new      | `useSoundSetting()` over `localStorage`                  |
| `components/game-canvas.tsx`            | modified | `muted` prop forwarded to `setMuted?`                    |
| `components/game-player.tsx`            | modified | SOUND ON / OFF button                                    |
| `app/globals.css`                       | modified | Only if needed: `flex-wrap: wrap` on `.hud-actions`       |
| `CLAUDE.md`                             | modified | Note the sound convention (`sound: true` + `setMuted`)   |

`references/started-games/04-arkanoid/` is read only and is not modified.

## Implementation plan

Use the `/frontend-design` skill for the UI step. Before writing client components, check `node_modules/next/dist/docs/` (`01-app/`).

1. Copy both mp3s to `public/games/arkanoid/`. Add `setMuted?` to `GameEngine` and `sound?: true` to `EngineEntry`. Verify: `npx tsc --noEmit` passes; `/games/arkanoid/ball-bounce.mp3` and `/games/arkanoid/break-sound.mp3` return 200; all three engine games behave as before.
2. In `lib/engines/arkanoid.ts`: fetch the bytes, `ensureAudio()` in `start()` / `resume()` / `restart()`, `play()` at the three trigger points, `setMuted()`, and the `destroy()` cleanup. Verify: on `/games/arkanoid/play`, wall, paddle and brick hits are audible (unmuted by default), and the console has no autoplay warning.
3. Create `lib/sound-setting.ts`. Add the `muted` prop to `GameCanvas`, the SOUND button to `GamePlayer`, and `sound: true` to the Arkanoid entry. Verify: the button toggles sound mid-run without restarting the run, and the setting survives a reload.
4. Verify the acceptance criteria below, by hand.
5. Update `CLAUDE.md` (in the Stack/engine notes: engines with sound set `sound: true` in `ENGINES`, implement `setMuted`, and the setting lives in `arcade-vault:sound`). Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` succeed.
- [ ] `/games/arkanoid/play` loads with no console errors or warnings (no autoplay warning, no 404 for either mp3) and no hydration warnings.
- [ ] No sound plays on the ready screen.
- [ ] After Space starts the run, `ball-bounce.mp3` plays on every left, right or top wall hit and every paddle bounce.
- [ ] `break-sound.mp3` plays on every broken brick.
- [ ] Losing a ball, advancing a level and the end of the run play no sound of their own.
- [ ] Nothing plays while paused or in the GAME OVER modal.
- [ ] PLAY AGAIN and RESUME (button, `P` or `Esc`) keep sound working.
- [ ] The HUD shows `SOUND ON` first in `.hud-actions` on Arkanoid. Clicking it shows `SOUND OFF` (`aria-pressed="false"`) and silences all hits. Clicking again restores them. The run is not restarted or paused by the toggle.
- [ ] After clicking the SOUND button, Space does not re-click it, and `←` / `→` still move the paddle.
- [ ] `SOUND OFF` survives a reload and a visit to another game and back; `localStorage["arcade-vault:sound"]` is `"off"`. Turning it back on stores `"on"`.
- [ ] Changing the setting in one tab updates the button in another open Arkanoid tab.
- [ ] With `localStorage` blocked (e.g. a browser with site data disabled), the page still loads with `SOUND ON` and the toggle works for the session.
- [ ] With the mp3s unreachable (blocked in DevTools), the game still plays silently and no exception is thrown.
- [ ] EXIT and coming back (also in `npm run dev` Strict Mode): each hit plays its sound once, not twice.
- [ ] Asteroids, Tetris and the simulated games (e.g. `/games/serpentine/play`) show no SOUND button and are otherwise unchanged.
- [ ] At 375 px width the HUD actions (SOUND, PAUSE, END, EXIT) fit with no horizontal scroll.
- [ ] `references/started-games/04-arkanoid/` has no changes in `git status`.

## Decisions taken and discarded

| Decision         | Chosen                                                                 | Discarded                                           | Why                                                                                                  |
| ---------------- | ---------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Playback         | Web Audio API: one `AudioContext`, decoded buffers, one source per hit | `HTMLAudioElement.cloneNode().play()` (reference)   | Low latency for rapid bounces; no new element per hit; `close()` silences everything on `destroy()`. |
| Context creation | Lazily in `start()` / `resume()` / `restart()`                         | In the factory                                      | A context created before a user gesture logs a Chrome autoplay warning and starts suspended.         |
| Events           | Verbatim: bounce on walls and paddle, break on bricks                  | Extra cues for lost life / game over                | No assets exist for them; no sound invention.                                                        |
| Mute             | SOUND ON / OFF button, remembered                                      | No mute; not remembered                             | Players need to silence the game without muting the tab, and expect the choice to persist.           |
| Storage          | `localStorage["arcade-vault:sound"] = "on" \| "off"`                   | `av-muted = "1" \| "0"`                             | Namespaced and readable; missing value means on.                                                     |
| Reading storage  | `useSyncExternalStore` with server snapshot `"on"`                     | `useEffect` + `setState` after mount                | No hydration mismatch, no set-state-in-effect, and cross-tab sync through the `storage` event.       |
| Contract         | Optional `setMuted?()` + `sound?: true` entry flag                     | Required `setMuted` on every engine; factory option | Asteroids and Tetris stay untouched; a factory option would recreate the engine (and lose the run).  |
| Button           | Text `SOUND ON` / `SOUND OFF`, `btn ghost`, first in `.hud-actions`    | Icon-only ♪ button                                  | Readable in the pixel font; `aria-pressed` gives the state to screen readers.                        |
| Volume           | On / off only, files' own level                                        | Fixed gain; slider                                  | Matches the reference; a slider can come later.                                                      |
| Shortcut         | None                                                                   | `M` toggles sound                                   | Keeps the legend and the engine's key handling unchanged.                                            |
| Audio code       | Inside `lib/engines/arkanoid.ts`                                       | Shared `lib/engines/audio.ts` helper                | Only one engine has sound; extract a helper when a second one needs it.                              |
| Scope            | Arkanoid only                                                          | Also Asteroids / Tetris                             | They have no sound assets in the references.                                                         |

## Identified risks

| Risk                                                                | Mitigation                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autoplay policy blocks audio or logs a warning                      | No `AudioContext` until a user gesture; `ensureAudio()` runs inside start / resume / restart.                                                                                                                             |
| Strict Mode double mount plays each sound twice                     | One context per engine; `destroy()` closes it and aborts fetches; acceptance criterion for it.                                                                                                                            |
| A late decode writes into a destroyed engine                        | Decode results are ignored after `destroy()`.                                                                                                                                                                             |
| `localStorage` unavailable or throws                                | Reads fall back to `"on"`; writes are caught and the setting stays in memory.                                                                                                                                             |
| Hydration mismatch between server `SOUND ON` and stored `SOUND OFF` | `getServerSnapshot` returns `"on"`; `useSyncExternalStore` swaps to the stored value after hydration.                                                                                                                     |
| Fourth HUD button overflows at 375 px                               | `.hud-actions` is `display: flex` with no wrap today. If the four buttons overflow at 375 px, add `flex-wrap: wrap` to `.hud-actions` in `app/globals.css` (the only CSS change allowed). Acceptance criterion at 375 px. |
| The first hits after start are silent while buffers decode          | Decoding two ~10 KB files takes milliseconds; `play()` skips undecoded buffers instead of queueing them.                                                                                                                  |

## What is **not** in this spec

- Volume control.
- A mute keyboard shortcut.
- New sounds or music.
- Sound for Asteroids, Tetris or the simulated games.

Each one of those, if it lands, goes in its own spec.
