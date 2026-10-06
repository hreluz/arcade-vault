import type { GameColor } from "@/lib/games";

export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export type Feature = { icon: FeatureIconKind; title: string; desc: string; color: GameColor };
export type TickerRow = { player: string; gameId: string; score: number; ago: string; color: GameColor };
export type TopPlayer = { rank: number; player: string; score: number };
export type FaqItem = { q: string; a: string };

export const FEATURES: Feature[] = [
  {
    icon: "GAMEPAD",
    title: "CLASSIC GAMES",
    desc: "Arkanoid, Tetris, Snake and many more. The best arcades of all time in one place.",
    color: "cyan",
  },
  {
    icon: "FREE",
    title: "100% FREE",
    desc: "No subscriptions, no hidden fees. Every game is available for free.",
    color: "yellow",
  },
  {
    icon: "TROPHY",
    title: "LADDER BOARDS",
    desc: "Compete with players from around the world. Climb the ranking and prove who is the best.",
    color: "magenta",
  },
  {
    icon: "ROCKET",
    title: "ALWAYS GROWING",
    desc: "We add new games all the time. Come back often, there will always be something new to play.",
    color: "green",
  },
];

export const TICKER: TickerRow[] = [
  { player: "NEONFOX", gameId: "falldown", score: 184220, ago: "2 min ago", color: "magenta" },
  { player: "PX_KAI", gameId: "glutton", score: 96400, ago: "5 min ago", color: "yellow" },
  { player: "Z3R0COOL", gameId: "invaders", score: 54190, ago: "8 min ago", color: "green" },
  { player: "VAULT_07", gameId: "rocks", score: 41200, ago: "12 min ago", color: "cyan" },
  { player: "GLITCHA", gameId: "block-buster", score: 28450, ago: "18 min ago", color: "cyan" },
  { player: "ARKADYA", gameId: "serpentine", score: 7820, ago: "24 min ago", color: "green" },
  { player: "CYBER_LU", gameId: "froggeria", score: 18900, ago: "31 min ago", color: "yellow" },
];

export const TOP_PLAYERS: TopPlayer[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];

export const PRICING_PERKS: string[] = [
  "Access to every game",
  "Global ranking and Hall of Fame",
  "No ads between games",
  "Save your scores",
  "New games every month",
  "Works in any browser",
];

export const FAQ: FaqItem[] = [
  {
    q: "IS IT REALLY FREE?",
    a: 'Yes. Arcade Vault is a non-profit project made out of love for the classics. There is no hidden "premium" version.',
  },
  {
    q: "DO I NEED AN ACCOUNT?",
    a: "No. You can play as a guest. If you want to save your score and appear in the ranking, sign up in 10 seconds.",
  },
  {
    q: "HOW DO YOU SURVIVE WITHOUT CHARGING?",
    a: "It's a community project. If you like it, share it. That's the only currency we accept.",
  },
];
