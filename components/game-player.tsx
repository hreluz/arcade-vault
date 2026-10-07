"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import GameCanvas, { type GameCanvasHandle } from "@/components/game-canvas";
import { ENGINES } from "@/lib/engines";
import type { EngineSnapshot } from "@/lib/engines/types";
import type { Game } from "@/lib/games";

type Run = { score: number; level: number };
const NEW_RUN: Run = { score: 0, level: 1 };

const CONTROLS = "← → ROTATE · ↑ THRUST · SPACE FIRE · P PAUSE";

export default function GamePlayer({ game }: { game: Game }) {
  const factory = ENGINES[game.id];
  const engineRef = useRef<GameCanvasHandle>(null);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [run, setRun] = useState<Run>(NEW_RUN);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("GUEST");
  const [saved, setSaved] = useState(false);

  // Simulated play (games without a real engine): the score ticks up and the
  // level bumps every ~2,500 points.
  useEffect(() => {
    if (factory || over || paused) return;
    const t = setInterval(() => {
      setRun(({ score, level }) => {
        const next = score + Math.floor(10 + Math.random() * 90);
        return { score: next, level: next % 2500 < 100 ? level + 1 : level };
      });
    }, 220);
    return () => clearInterval(t);
  }, [factory, over, paused]);

  // Engine games read everything from the latest snapshot; the rest keep the
  // simulated state.
  const phase = snapshot?.phase ?? "ready";
  const view = factory
    ? {
        score: snapshot?.score ?? 0,
        lives: snapshot?.lives ?? 3,
        level: snapshot?.level ?? 1,
        paused: phase === "paused",
        over: phase === "over",
      }
    : { score: run.score, lives, level: run.level, paused, over };
  const tripleShot = snapshot?.tripleShot ?? 0;

  // A focused HUD button would swallow the next Space, so engine games drop
  // focus after a click.
  const releaseFocus = (e: MouseEvent<HTMLButtonElement>) => {
    if (factory) e.currentTarget.blur();
  };

  const togglePause = (e: MouseEvent<HTMLButtonElement>) => {
    if (factory) {
      if (phase === "paused") engineRef.current?.resume();
      else engineRef.current?.pause();
    } else {
      setPaused((p) => !p);
    }
    releaseFocus(e);
  };

  const end = (e: MouseEvent<HTMLButtonElement>) => {
    if (factory) engineRef.current?.end();
    else setOver(true);
    releaseFocus(e);
  };

  const restart = (e: MouseEvent<HTMLButtonElement>) => {
    if (factory) {
      engineRef.current?.restart();
      setSaved(false);
      releaseFocus(e);
      return;
    }
    setRun(NEW_RUN);
    setLives(3);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat">
            <div className="l">Player</div>
            <div className="v text-ink">{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Score</div>
            <div className="v">{view.score.toLocaleString("en-US")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Lives</div>
            <div className="v">{"♥ ".repeat(view.lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Level</div>
            <div className="v">{String(view.level).padStart(2, "0")}</div>
          </div>
          {tripleShot > 0 && (
            <div className="hud-stat triple">
              <div className="l">3X</div>
              <div className="v">{tripleShot.toFixed(1)}s</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button type="button" className="btn yellow" onClick={togglePause}>
            {view.paused ? "RESUME" : "PAUSE"}
          </button>
          <button type="button" className="btn magenta" onClick={end}>
            END
          </button>
          <Link href={`/games/${game.id}`} className="btn ghost">
            EXIT
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {factory ? (
            <GameCanvas factory={factory} onChange={setSnapshot} ref={engineRef} />
          ) : (
            <div className="game-arena" aria-hidden="true">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {factory && phase === "ready" && (
            <div className="crt-content ready-overlay z-5">
              <div className="ready-keys">
                <div className="ready-prompt pixel neon-cyan">PRESS SPACE TO START</div>
                <div className="ready-controls mono">{CONTROLS}</div>
              </div>
              <div className="ready-touch pixel neon-magenta">KEYBOARD REQUIRED</div>
            </div>
          )}
          {view.paused && (
            <div className="crt-content z-5 bg-black/60">
              <div>
                <div className="pixel neon-yellow text-[22px]">PAUSED</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-ink-dim">
                  {factory ? "PRESS P OR RESUME TO CONTINUE" : "PRESS RESUME TO CONTINUE"}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SIGNAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          {factory ? <span className="crt-legend">{CONTROLS}</span> : <span>LOAD · 1MB</span>}
        </div>
      </div>

      {view.over && (
        <div className="modal-bd">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
            <h2 id="game-over-title">GAME OVER</h2>
            <div className="final-label">FINAL SCORE</div>
            <div className="final">{view.score.toLocaleString("en-US")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="YOUR INITIALS"
                  aria-label="Your initials"
                />
                <button type="button" className="btn yellow" onClick={() => setSaved(true)}>
                  SAVE SCORE
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ SCORE SAVED_</div>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={restart}>
                PLAY AGAIN
              </button>
              <Link href="/games" className="btn magenta">
                BACK TO VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
