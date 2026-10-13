import "server-only";
import type { Category, Game, GameColor, ScoreRow } from "@/lib/games";
import type { Tables } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

// The CHECK constraints on public.games guarantee these narrowings.
function toGame(row: Tables<"games">, best: number | null): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as Category,
    cover: row.cover as Game["cover"],
    color: row.color as GameColor,
    best,
  };
}

// "DD/MM/YYYY" in UTC, so server and client render the same date.
function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getUTCFullYear()}`;
}

// Ordered by sort_order, with each game's best score merged in. Throws on error.
export async function getGames(): Promise<Game[]> {
  const supabase = createPublicClient();
  const [games, bests] = await Promise.all([
    supabase.from("games").select("*").order("sort_order"),
    supabase.from("game_best_scores").select("game_id, best"),
  ]);
  if (games.error) throw new Error(`Failed to load games: ${games.error.message}`);
  if (bests.error) throw new Error(`Failed to load best scores: ${bests.error.message}`);

  const bestById = new Map<string, number>();
  for (const { game_id, best } of bests.data) {
    if (game_id !== null && best !== null) bestById.set(game_id, best);
  }
  return games.data.map((row) => toGame(row, bestById.get(row.id) ?? null));
}

// Throws on error; undefined when no game has that id.
export async function getGame(id: string): Promise<Game | undefined> {
  const supabase = createPublicClient();
  const [game, best] = await Promise.all([
    supabase.from("games").select("*").eq("id", id).maybeSingle(),
    supabase.from("game_best_scores").select("best").eq("game_id", id).maybeSingle(),
  ]);
  if (game.error) throw new Error(`Failed to load game ${id}: ${game.error.message}`);
  if (best.error) throw new Error(`Failed to load best score for ${id}: ${best.error.message}`);
  if (!game.data) return undefined;
  return toGame(game.data, best.data?.best ?? null);
}

// Ranked score desc, created_at asc (an earlier equal score ranks higher).
// Returns null when the scores cannot be read, so a board can degrade on its own.
export async function getTopScores(gameId: string, limit: number): Promise<ScoreRow[] | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error(`Failed to load scores for ${gameId}: ${error.message}`);
    return null;
  }
  return data.map((row, i) => ({
    rank: i + 1,
    name: row.name,
    score: row.score,
    date: formatDate(row.created_at),
  }));
}
