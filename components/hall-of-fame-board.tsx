"use client";

import { useState } from "react";
import BoardMessage from "@/components/board-message";
import type { Game, ScoreRow } from "@/lib/games";

const TOP_CLASS = [" top1", " top2", " top3"];

// Keyed by game id; null means that game's scores could not be read.
export type Boards = Record<string, ScoreRow[] | null>;

function PodiumSlot({ row, tier }: { row: ScoreRow | undefined; tier: "gold" | "silver" | "bronze" }) {
  // An empty slot keeps its grid cell so the champion stays centered.
  if (!row) return <div className={"podium-slot empty " + tier} aria-hidden="true" />;
  const gold = tier === "gold";
  return (
    <div className={"podium-slot " + tier}>
      {gold && <div className="pixel text-[9px] tracking-[0.18em] text-gold">CHAMPION</div>}
      <div className={"rank-num" + (gold ? " mt-1 text-[36px]" : "")}>{String(row.rank).padStart(2, "0")}</div>
      <div className="name">{row.name}</div>
      <div className={"score" + (gold ? " text-[20px]" : "")}>{row.score.toLocaleString("en-US")}</div>
      <div className="date">{row.date}</div>
    </div>
  );
}

export default function HallOfFameBoard({ games, boards }: { games: Game[]; boards: Boards }) {
  const [tab, setTab] = useState(games[0].id);
  const rows = boards[tab] ?? null;

  return (
    <>
      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            className={"chip" + (tab === g.id ? " active" : "")}
            aria-pressed={tab === g.id}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows === null || rows.length === 0 ? (
        <div className="hall-table">
          <BoardMessage unavailable={rows === null} />
        </div>
      ) : (
        <>
          <div className="podium">
            <PodiumSlot row={rows[1]} tier="silver" />
            <PodiumSlot row={rows[0]} tier="gold" />
            <PodiumSlot row={rows[2]} tier="bronze" />
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANK</div>
              <div>PLAYER</div>
              <div>SCORE</div>
              <div>DATE</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={tab + r.rank}
                className={"tr" + (TOP_CLASS[i] ?? "")}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("en-US")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
