import type { GameSkins } from "@/lib/skins/types";

// Frogger draws everything with canvas primitives, so every element has a role.
export type FroggerRole =
  | "bg" // canvas margins around the board and the CRT screen
  | "road" // terrain
  | "river" // terrain
  | "safe" // terrain: the middle and start rows, behind the canvas HUD
  | "goalRow" // terrain: the bank around the slots
  | "goal" // terrain: an open slot
  | "goalBorder" // critical: outlines the slots the frog must land in
  | "frog" // critical: also the life icons
  | "frogLegs" // decorative
  | "eye" // decorative
  | "pupil" // decorative
  | "carA" // critical: lane colour, index = row % 3
  | "carB" // critical: lane colour (no car lane uses this index with today's lane map)
  | "carC" // critical: lane colour
  | "wheel" // decorative
  | "truck" // critical
  | "cab" // critical
  | "log" // critical
  | "logLine" // decorative
  | "turtle" // critical
  | "shell" // decorative
  | "hud" // critical: score and level text on the safe row
  | "timeHigh" // critical: time bar above 50 %
  | "timeMid" // critical: time bar above 20 %
  | "timeLow"; // critical: time bar at 20 % or less

export const froggerSkins: GameSkins<FroggerRole> = {
  // The 1981 arcade cabinet: black road, navy river, purple median, red turtles.
  classic: {
    light: {
      colors: {
        bg: "#f4f1e8",
        road: "#f4f1e8",
        river: "#dceaf6",
        safe: "#e9dff0",
        goalRow: "#d5e8c8",
        goal: "#f4f1e8",
        goalBorder: "#8a6400",
        frog: "#003a0e",
        frogLegs: "#2f8a3f",
        eye: "#ffffff",
        pupil: "#000000",
        carA: "#c81e1e",
        carB: "#8f6f00",
        carC: "#1f4fc0",
        wheel: "#3a3a3a",
        truck: "#6b6b6b",
        cab: "#3a3a3a",
        log: "#b0702c",
        logLine: "#6e4215",
        turtle: "#e04a30",
        shell: "#8a1f10",
        hud: "#1a1a1a",
        timeHigh: "#1f7a1f",
        timeMid: "#946a00",
        timeLow: "#c81e1e",
      },
      glow: 0,
    },
    dark: {
      colors: {
        bg: "#000000",
        road: "#000000",
        river: "#00004a",
        safe: "#3c1464",
        goalRow: "#004d00",
        goal: "#00004a",
        goalBorder: "#ffd800",
        frog: "#33ee33",
        frogLegs: "#1fa81f",
        eye: "#ffffff",
        pupil: "#000000",
        carA: "#ff3030",
        carB: "#ffd800",
        carC: "#40a0ff",
        wheel: "#666666",
        truck: "#d8d8d8",
        cab: "#ffffff",
        log: "#a0602a",
        logLine: "#5a3312",
        turtle: "#d02020",
        shell: "#701010",
        hud: "#ffffff",
        timeHigh: "#33ee33",
        timeMid: "#ffd800",
        timeLow: "#ff5050",
      },
      glow: 0,
    },
  },
  // The platform look. Frogger shipped with no shadowBlur, so `glow` has nothing to
  // scale here: see the comment on setPalette in lib/engines/frogger.ts.
  neon: {
    light: {
      colors: {
        bg: "#f5f7ff",
        road: "#f5f7ff",
        river: "#dff2f8",
        safe: "#e2f6ec",
        goalRow: "#d3f0e0",
        goal: "#f5f7ff",
        goalBorder: "#8a7a00",
        frog: "#003a1c",
        frogLegs: "#00885a",
        eye: "#ffffff",
        pupil: "#000000",
        carA: "#c4005a",
        carB: "#8a7a00",
        carC: "#0078a0",
        wheel: "#2a2f45",
        truck: "#5f6480",
        cab: "#33384f",
        log: "#a8741f",
        logLine: "#6b4810",
        turtle: "#0088a8",
        shell: "#004f63",
        hud: "#14182b",
        timeHigh: "#007a48",
        timeMid: "#8a7a00",
        timeLow: "#c4005a",
      },
      glow: 0.4,
    },
    // Regression baseline: the colours the engine shipped with, hex for hex.
    dark: {
      colors: {
        bg: "#000000",
        road: "#000000",
        river: "#04143f",
        safe: "#0a3d1f",
        goalRow: "#5fd38a",
        goal: "#0a3d1f",
        goalBorder: "#ffd700",
        frog: "#00ff88",
        frogLegs: "#00a35a",
        eye: "#ffffff",
        pupil: "#000000",
        carA: "#ff2d2d",
        carB: "#f5ff00",
        carC: "#2d8cff",
        wheel: "#111111",
        truck: "#8a8f98",
        cab: "#c2c7d0",
        log: "#8b5a2b",
        logLine: "#5e3b1a",
        turtle: "#1fa84f",
        shell: "#0c6b2e",
        hud: "#ffffff",
        timeHigh: "#00ff88",
        timeMid: "#f5ff00",
        timeLow: "#ff2d2d",
      },
      glow: 1,
    },
  },
  // An 8-bit fantasy console: PICO-8 colours only.
  retro: {
    light: {
      colors: {
        bg: "#fff1e8",
        road: "#fff1e8",
        river: "#29adff",
        safe: "#ffccaa",
        goalRow: "#ffccaa",
        goal: "#fff1e8",
        goalBorder: "#7e2553",
        frog: "#008751",
        frogLegs: "#1d2b53",
        eye: "#fff1e8",
        pupil: "#000000",
        carA: "#ff004d",
        carB: "#ab5236",
        carC: "#1d2b53",
        wheel: "#000000",
        truck: "#5f574f",
        cab: "#000000",
        log: "#1d2b53",
        logLine: "#83769c",
        turtle: "#000000",
        shell: "#5f574f",
        hud: "#000000",
        timeHigh: "#008751",
        timeMid: "#ab5236",
        timeLow: "#7e2553",
      },
      glow: 0,
    },
    dark: {
      colors: {
        bg: "#000000",
        road: "#000000",
        river: "#1d2b53",
        safe: "#5f574f",
        goalRow: "#7e2553",
        goal: "#000000",
        goalBorder: "#ffec27",
        frog: "#00e436",
        frogLegs: "#008751",
        eye: "#fff1e8",
        pupil: "#000000",
        carA: "#ff004d",
        carB: "#ffec27",
        carC: "#29adff",
        wheel: "#5f574f",
        truck: "#c2c3c7",
        cab: "#fff1e8",
        log: "#ab5236",
        logLine: "#7e2553",
        turtle: "#008751",
        shell: "#1d2b53",
        hud: "#fff1e8",
        timeHigh: "#00e436",
        timeMid: "#ffec27",
        timeLow: "#ff77a8",
      },
      glow: 0,
    },
  },
};
