export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: `cover-${string}`;
  color: GameColor;
  best: number | null; // null = no scores yet
};

export type ScoreRow = { rank: number; name: string; score: number; date: string };

export const CATEGORIES = ["ALL", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const satisfies readonly [
  "ALL",
  ...Category[],
];
