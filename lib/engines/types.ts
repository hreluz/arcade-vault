export type EnginePhase = "ready" | "playing" | "paused" | "over";

export type EngineSnapshot = {
  phase: EnginePhase;
  score: number;
  lives: number;
  level: number;
  tripleShot: number; // remaining seconds, rounded to 0.1; 0 when inactive
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
