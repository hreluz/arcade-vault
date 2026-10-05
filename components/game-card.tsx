"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import type { Game } from "@/lib/games";

const BUTTON_VARIANT: Record<Game["color"], string> = {
  cyan: "",
  green: "",
  magenta: "magenta",
  yellow: "yellow",
};

export default function GameCard({ game }: { game: Game }) {
  const tiltRef = useRef<HTMLAnchorElement>(null);

  // Inline transform overrides the .card:hover transform while the pointer moves; cleared on leave.
  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };
  const onLeave = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "";
  };

  return (
    <Link
      ref={tiltRef}
      href={`/games/${game.id}`}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover} />
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>BEST SCORE</span>
            <b>{game.best.toLocaleString("en-US")}</b>
          </div>
          {/* The whole card is the link; PLAY is its visual call to action. */}
          <span className={"btn " + BUTTON_VARIANT[game.color]}>PLAY</span>
        </div>
      </div>
    </Link>
  );
}
