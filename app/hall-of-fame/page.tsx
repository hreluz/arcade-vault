import type { Metadata } from "next";
import Link from "next/link";
import HallOfFameBoard, { type Boards } from "@/components/hall-of-fame-board";
import { getGames, getTopScores } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Hall of Fame · Arcade Vault",
};

export default async function HallOfFamePage() {
  const games = await getGames();
  const tops = await Promise.all(games.map((g) => getTopScores(g.id, 12)));
  const boards: Boards = Object.fromEntries(games.map((g, i) => [g.id, tops[i]]));

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>HALL OF FAME</h1>
        <p className="pixel text-[10px]">THE NAMES THAT NEVER LEAVE THE SCREEN</p>
      </div>

      <HallOfFameBoard games={games} boards={boards} />

      <div className="mt-8 text-center">
        <Link href="/games" className="btn lg">
          BACK TO LIBRARY
        </Link>
      </div>
    </div>
  );
}
