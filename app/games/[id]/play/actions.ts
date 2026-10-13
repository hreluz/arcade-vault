"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ENGINES } from "@/lib/engines";
import { rateLimit } from "@/lib/rate-limit";
import { createPublicClient } from "@/lib/supabase/public";

const NAME_PATTERN = /^[A-Z0-9_]{1,10}$/;
const MAX_SCORE = 10_000_000;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;

export type SaveScoreResult =
  | { status: "ok"; rank: number }
  | { status: "error"; reason: "invalid" | "no-engine" | "rate-limited" | "failed" };

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

// Saves one finished run from the game-over modal and returns its board rank. Never throws to the client.
// The CHECK constraints on public.scores are the real guard; this only protects the app path.
export async function saveScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<SaveScoreResult> {
  const { gameId, score } = input ?? {};
  const name = typeof input?.name === "string" ? input.name.trim().toUpperCase() : "";

  if (
    typeof gameId !== "string" ||
    !NAME_PATTERN.test(name) ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE
  ) {
    return { status: "error", reason: "invalid" };
  }

  // Only games with a real engine produce real scores; simulated ones would pollute the boards.
  if (!ENGINES[gameId]) return { status: "error", reason: "no-engine" };

  if (!rateLimit(`score:${await clientIp()}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return { status: "error", reason: "rate-limited" };
  }

  const supabase = createPublicClient();
  const { data: row, error: insertError } = await supabase
    .from("scores")
    .insert({ game_id: gameId, name, score })
    .select("created_at")
    .single();
  if (insertError) {
    console.error(`[scores] Insert failed for ${gameId}: ${insertError.message}`);
    return { status: "error", reason: "failed" };
  }

  // Rank order is score desc, created_at asc: count the rows that beat this one.
  const { count, error: rankError } = await supabase
    .from("scores")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .or(`score.gt.${score},and(score.eq.${score},created_at.lt."${row.created_at}")`);
  if (rankError || count === null) {
    console.error(`[scores] Rank query failed for ${gameId}: ${rankError?.message ?? "no count"}`);
    return { status: "error", reason: "failed" };
  }

  for (const path of ["/", "/games", `/games/${gameId}`, "/hall-of-fame"]) revalidatePath(path);

  return { status: "ok", rank: count + 1 };
}
