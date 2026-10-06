import type { ScoreRow } from "@/lib/games";

const TOP_CLASS = [" top1", " top2", " top3"];

export default function Leaderboard({ scores }: { scores: ScoreRow[] }) {
  return (
    <div className="leaderboard">
      <h3>TOP SCORES</h3>
      {scores.map((r, i) => (
        <div key={r.name} className={"lb-row" + (TOP_CLASS[i] ?? "")}>
          <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
          <div className="pl">
            {r.name}
            <div className="text-[10px] tracking-[0.1em] text-ink-faint">{r.date}</div>
          </div>
          <div className="sc">{r.score.toLocaleString("en-US")}</div>
        </div>
      ))}
    </div>
  );
}
