# Games with themes

Maintained by the `skin-designer` agent (`.claude/agents/skin-designer.md`). Last updated: 2026-11-02.
Required per game: Classic (default), Neon, Retro — each with a light and a dark palette (6 palettes).
The agent skins one game per run: the game named in the prompt, or the first unchecked item in the Queue.

## Queue

- [x] frogger

## Games with skins

| Game    | Id        | classic L/D | neon L/D | retro L/D | Min contrast                                                                                  | Palette file           | Spec | Date       |
| ------- | --------- | ----------- | -------- | --------- | --------------------------------------------------------------------------------------------- | ---------------------- | ---- | ---------- |
| FROGGER | `frogger` | yes / yes   | yes / yes | yes / yes | classic 3.58 / 3.91, neon 3.79 / 3.60, retro 3.55 / 3.99 (L / D, gameplay roles against `bg`) | `lib/skins/frogger.ts` | —    | 2026-11-02 |

## In progress

| Game | Id  | Status | Spec | Next step |
| ---- | --- | ------ | ---- | --------- |

## Not skinned yet

| Game       | Id           | Engine                     | Notes                         |
| ---------- | ------------ | -------------------------- | ----------------------------- |
| ARKANOID   | `arkanoid`   | `lib/engines/arkanoid.ts`  |                               |
| TETRIS     | `tetris`     | `lib/engines/tetris.ts`    |                               |
| SNAKE      | `snake`      | `lib/engines/snake.ts`     |                               |
| ASTEROIDS  | `asteroids`  | `lib/engines/asteroids.ts` |                               |
| GLUTTON    | `glutton`    | —                          | Placeholder: skins land with its game spec |
| INVADERS   | `invaders`   | —                          | Placeholder: skins land with its game spec |
| PIXEL DUEL | `pixel-duel` | —                          | Placeholder: skins land with its game spec |

## Change log

- 2026-11-02 — frogger: first skinned game (Case A). Built the skin platform (`lib/skins/types.ts`, `lib/skins/setting.ts`, `setPalette`, `skins:`, SKIN and MODE buttons, `.crt-screen` following `bg`) and wrote the 6 Frogger palettes. Created this file, which did not exist.
- 2026-11-02 — frogger: decision: the engine does not read `glow`, and Neon draws no halos. Discarded: adding `shadowBlur` so Neon glows. Why: the engine shipped with no `shadowBlur`, and `neon.dark` must look exactly as it did. The palettes still carry `glow: 1` and `0.4` to satisfy the contract.
- 2026-11-02 — frogger: decision: added a `bg` role separate from `road`, both `#000000` in `neon.dark`. Discarded: reusing `road` for the margins and the CRT. Why: every other skinned game needs a `bg`, and a future light road may differ from the margins.
- 2026-11-02 — frogger: decision: terrain roles (`road`, `river`, `safe`, `goalRow`, `goal`) count as surfaces, not gameplay-critical. Discarded: holding them to 3:1 against `bg`. Why: light palettes need pale terrain so dark entities stand out on it, and the slots are marked by `goalBorder`, which is held to 3:1.
- 2026-11-02 — frogger: decision: besides rule 2, checked each element against the surface it is drawn on. Remaining pairs under 3:1: `neon.dark` frog/turtle 2.31, goalBorder/goalRow 1.34 and time bar/goalRow 1.40-1.97 (baseline, may not change); `retro.dark` frog/turtle 2.65 and log/river 2.62, `retro.light` frog/river 1.86 (PICO-8 has no closer colour; the frog in the water is dead on landing).
- 2026-11-02 — frogger: decision: the Classic and Neon light palettes use a near-black green frog (`#003a0e`, `#003a1c`); Retro light uses `#008751` on navy logs and black turtles. Discarded: a mid green like the dark palettes. Why: logs and turtles must reach 3:1 against the pale `bg`, so the frog must be much darker to stand out while riding them.
- 2026-11-02 — frogger: decision: Classic follows the 1981 cabinet (navy river, purple median, red turtles, white trucks). Discarded: green turtles as in the Neon baseline. Why: this is the skin's reference, and red separates the turtles from the frog.
- 2026-11-02 — frogger: decision: SKIN and MODE sit in their own `.hud-actions` group before the SOUND / PAUSE group. Discarded: the same group. Why: `.hud-actions` does not wrap on phones, so five buttons overflow at 375 px; two groups give two rows there with no CSS change. Checked: no horizontal scroll at 375 px.
- 2026-11-02 — frogger: decision: left the ready overlay as is (cyan text on a dark radial gradient), which shows as a dark smudge in light palettes. Discarded: a light variant. Why: `.ready-overlay` is outside the `.crt-screen` rules this agent may edit, and the text stays readable on it.
- 2026-11-02 — frogger: decision: `carB` is set in all palettes though no car lane uses it today (car rows 12, 11, 9 and 8 give index 0 or 2 of `row % 3`). Discarded: dropping the role. Why: the engine keeps its three-colour lookup untouched.
- 2026-11-02 — frogger: decision: added the checked `frogger` item to the Queue, which did not exist yet. Discarded: an empty Queue. Why: it records the target of this run, and no other game was added.
