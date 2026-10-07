"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { EngineFactory, EngineSnapshot, GameEngine } from "@/lib/engines/types";

export type GameCanvasHandle = Pick<GameEngine, "pause" | "resume" | "end" | "restart">;

type Props = {
  factory: EngineFactory;
  onChange: (s: EngineSnapshot) => void;
  ref?: Ref<GameCanvasHandle>;
};

// Owns the engine's lifecycle: created on mount, destroyed on unmount. Under
// Strict Mode's double mount the first engine is destroyed before the second
// is created, so only one loop and one set of listeners survive.
export default function GameCanvas({ factory, onChange, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Read through a ref so a new callback identity never recreates the engine.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = factory(canvas, { onChange: (s) => onChangeRef.current(s) });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [factory]);

  useImperativeHandle(
    ref,
    () => ({
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      end: () => engineRef.current?.end(),
      restart: () => engineRef.current?.restart(),
    }),
    [],
  );

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Game screen" />;
}
