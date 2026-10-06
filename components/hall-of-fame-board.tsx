"use client";

import { useMemo, useState } from "react";
import { GAMES, seededScores } from "@/lib/games";

const TOP_CLASS = [" top1", " top2", " top3"];

export default function HallOfFameBoard() {
  const [tab, setTab] = useState(GAMES[0].id);
  const rows = useMemo(
    () => seededScores((GAMES.findIndex((g) => g.id === tab) + 1) * 23 + 7, 12),
    [tab],
  );
  const [first, second, third] = rows;

  return (
    <>
      <div className="hall-tabs">
        {GAMES.map((g) => (
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

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{second.name}</div>
          <div className="score">{second.score.toLocaleString("en-US")}</div>
          <div className="date">{second.date}</div>
        </div>
        <div className="podium-slot gold">
          <div className="pixel text-[9px] tracking-[0.18em] text-gold">CHAMPION</div>
          <div className="rank-num mt-1 text-[36px]">01</div>
          <div className="name">{first.name}</div>
          <div className="score text-[20px]">{first.score.toLocaleString("en-US")}</div>
          <div className="date">{first.date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{third.name}</div>
          <div className="score">{third.score.toLocaleString("en-US")}</div>
          <div className="date">{third.date}</div>
        </div>
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
            key={r.name + i}
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
  );
}
