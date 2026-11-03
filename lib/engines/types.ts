import type { SkinPalette } from "@/lib/skins/types";

export type EnginePhase = "ready" | "playing" | "paused" | "over";

export type HudStat = { key: string; label: string; value: string }; // value already formatted, e.g. "4.2s"

export type EngineSnapshot = {
  phase: EnginePhase;
  score: number;
  level: number;
  lives: number | null; // null = the game has no lives; the HUD hides the stat
  extras: HudStat[]; // game-specific HUD stats, in display order; [] when none
};

// Keyboard codes the touch pad can send; each engine already handles these keys.
export type PadCode = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Space";

export type PadSlot = "up" | "down" | "left" | "right" | "a" | "b";

export type PadButton = {
  slot: PadSlot; // where it sits: D-pad (up/down/left/right) or action (a/b)
  code: PadCode; // what press() receives
  ariaLabel: string; // accessible name of the action, e.g. "Move left"
  caption?: string; // action shown next to A / B, e.g. "ROTATE"; D-pad buttons have none
  repeat?: true; // while held, re-send press(code, true) after 170 ms, then every 50 ms
};

export type EngineCallbacks = {
  onChange: (s: EngineSnapshot) => void; // only when a field actually changed, never every frame
};

export interface GameEngine {
  start(): void; // ready → playing
  pause(): void; // playing → paused (no-op otherwise)
  resume(): void; // paused → playing (no-op otherwise)
  end(): void; // ready | playing | paused → over
  restart(): void; // any → playing, with a fresh run (skips the ready screen)
  destroy(): void; // cancels rAF and removes every listener; idempotent
  press(code: PadCode, down: boolean): void; // on-screen input; same effect as the key going down / up
  setMuted?(muted: boolean): void; // only engines with sound implement it
  setPalette?(palette: SkinPalette<string>): void; // only skinned engines; never restarts the run
}

export type EngineFactory = (canvas: HTMLCanvasElement, cb: EngineCallbacks) => GameEngine;

// Compares HUD extras by value, so a fresh array each frame doesn't re-render React.
export function sameExtras(a: HudStat[], b: HudStat[]): boolean {
  return (
    a.length === b.length &&
    a.every((s, i) => s.key === b[i].key && s.label === b[i].label && s.value === b[i].value)
  );
}
