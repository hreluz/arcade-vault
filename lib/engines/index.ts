import { createArkanoid } from "@/lib/engines/arkanoid";
import { createAsteroids } from "@/lib/engines/asteroids";
import { createTetris } from "@/lib/engines/tetris";
import type { EngineFactory } from "@/lib/engines/types";

export type EngineEntry = {
  factory: EngineFactory;
  controls: string; // one-line legend
  sound?: true; // the player shows the SOUND button
};

export const ENGINES: Partial<Record<string, EngineEntry>> = {
  arkanoid: { factory: createArkanoid, controls: "← → / MOUSE MOVE · P PAUSE", sound: true },
  asteroids: { factory: createAsteroids, controls: "← → ROTATE · ↑ THRUST · SPACE FIRE · P PAUSE" },
  tetris: { factory: createTetris, controls: "← → MOVE · ↑ ROTATE · ↓ SOFT DROP · SPACE DROP · P PAUSE" },
};
