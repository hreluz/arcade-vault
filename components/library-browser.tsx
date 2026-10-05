"use client";

import { useMemo, useState } from "react";
import GameCard from "@/components/game-card";
import { CATEGORIES, GAMES } from "@/lib/games";

type CategoryFilter = (typeof CATEGORIES)[number];

export default function LibraryBrowser() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryFilter>("ALL");

  const filtered = useMemo(
    () =>
      GAMES.filter(
        (g) => (cat === "ALL" || g.cat === cat) && g.title.toLowerCase().includes(q.toLowerCase()),
      ),
    [q, cat],
  );

  return (
    <>
      <div className="av-filters">
        <div className="av-search">
          <span className="ico" aria-hidden="true">
            ⌕
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a game by name…"
            aria-label="Search a game by name"
          />
        </div>
        <div className="av-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={"chip" + (cat === c ? " active" : "")}
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full p-20 text-center text-ink-faint">
            <div className="pixel mb-3 text-[14px] text-magenta">NO RESULTS</div>
            <div>Try another search or category.</div>
          </div>
        )}
      </div>
    </>
  );
}
