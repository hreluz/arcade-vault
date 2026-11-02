import { createArkanoid } from "@/lib/engines/arkanoid";
import { createAsteroids } from "@/lib/engines/asteroids";
import { createSnake } from "@/lib/engines/snake";
import { createTetris } from "@/lib/engines/tetris";
import type { EngineFactory, PadButton } from "@/lib/engines/types";

export type EngineEntry = {
  factory: EngineFactory;
  controls: string; // one-line keyboard legend (hidden on coarse pointers)
  pad: PadButton[]; // on-screen touch layout; required for every real engine
  sound?: true; // the player shows the SOUND button
};

const LEFT: PadButton = { slot: "left", code: "ArrowLeft", ariaLabel: "Move left" };
const RIGHT: PadButton = { slot: "right", code: "ArrowRight", ariaLabel: "Move right" };

export const ENGINES: Partial<Record<string, EngineEntry>> = {
  arkanoid: {
    factory: createArkanoid,
    controls: "← → / MOUSE MOVE · P PAUSE",
    pad: [LEFT, RIGHT],
    sound: true,
  },
  asteroids: {
    factory: createAsteroids,
    controls: "← → ROTATE · ↑ THRUST · SPACE FIRE · P PAUSE",
    pad: [
      { ...LEFT, ariaLabel: "Rotate left" },
      { ...RIGHT, ariaLabel: "Rotate right" },
      { slot: "a", code: "ArrowUp", caption: "THRUST", ariaLabel: "Thrust" },
      { slot: "b", code: "Space", caption: "FIRE", ariaLabel: "Fire" },
    ],
  },
  snake: {
    factory: createSnake,
    controls: "← ↑ → ↓ / WASD STEER · P PAUSE",
    pad: [
      { slot: "up", code: "ArrowUp", ariaLabel: "Steer up" },
      { slot: "down", code: "ArrowDown", ariaLabel: "Steer down" },
      { ...LEFT, ariaLabel: "Steer left" },
      { ...RIGHT, ariaLabel: "Steer right" },
    ],
  },
  tetris: {
    factory: createTetris,
    controls: "← → MOVE · ↑ ROTATE · ↓ SOFT DROP · SPACE DROP · P PAUSE",
    pad: [
      { ...LEFT, repeat: true },
      { ...RIGHT, repeat: true },
      { slot: "down", code: "ArrowDown", ariaLabel: "Soft drop", repeat: true },
      { slot: "a", code: "ArrowUp", caption: "ROTATE", ariaLabel: "Rotate" },
      { slot: "b", code: "Space", caption: "DROP", ariaLabel: "Hard drop" },
    ],
  },
};
