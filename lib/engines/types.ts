export type EnginePhase = "ready" | "playing" | "paused" | "over";

export type HudStat = { key: string; label: string; value: string }; // value already formatted, e.g. "4.2s"

export type EngineSnapshot = {
  phase: EnginePhase;
  score: number;
  level: number;
  lives: number | null; // null = the game has no lives; the HUD hides the stat
  extras: HudStat[]; // game-specific HUD stats, in display order; [] when none
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
}

export type EngineFactory = (canvas: HTMLCanvasElement, cb: EngineCallbacks) => GameEngine;

// Compares HUD extras by value, so a fresh array each frame doesn't re-render React.
export function sameExtras(a: HudStat[], b: HudStat[]): boolean {
  return (
    a.length === b.length &&
    a.every((s, i) => s.key === b[i].key && s.label === b[i].label && s.value === b[i].value)
  );
}
