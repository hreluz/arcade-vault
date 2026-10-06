import Link from "next/link";
import type { Game } from "@/lib/games";

export default function MiniCard({ game }: { game: Game }) {
  return (
    <Link href={`/games/${game.id}`} className="mini-card block">
      <div className="mini-cover">
        <div className={"cover-bg " + game.cover} />
      </div>
      <div className="mini-meta">
        <div className="mini-title">{game.title}</div>
        <div className="mini-cat">{game.cat}</div>
      </div>
    </Link>
  );
}
