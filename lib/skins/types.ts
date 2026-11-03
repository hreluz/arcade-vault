// The skin contract: every skinned game has three skins, each with a light and a
// dark palette. Palettes live in lib/skins/<game-id>.ts.
export type SkinId = "classic" | "neon" | "retro";
export const SKIN_IDS: readonly SkinId[] = ["classic", "neon", "retro"];
export const DEFAULT_SKIN: SkinId = "classic";
export type ColorMode = "light" | "dark";

export type SkinPalette<R extends string> = {
  colors: Record<R, string>; // role → CSS colour ("#rrggbb" or "rgba(…)")
  glow: number; // shadowBlur multiplier: 0 = flat, 1 = the engine's reference glow
};

export type GameSkins<R extends string> = Record<SkinId, Record<ColorMode, SkinPalette<R>>>;
