"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { EngineFactory, EngineSnapshot, GameEngine } from "@/lib/engines/types";
import type { SkinPalette } from "@/lib/skins/types";

export type GameCanvasHandle = Pick<GameEngine, "start" | "pause" | "resume" | "end" | "restart" | "press">;

type Props = {
  factory: EngineFactory;
  onChange: (s: EngineSnapshot) => void;
  muted: boolean;
  palette?: SkinPalette<string>; // only skinned games
  ref?: Ref<GameCanvasHandle>;
};

// Owns the engine's lifecycle: created on mount, destroyed on unmount. Under
// Strict Mode's double mount the first engine is destroyed before the second
// is created, so only one loop and one set of listeners survive.
export default function GameCanvas({ factory, onChange, muted, palette, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Read through a ref so a new callback identity never recreates the engine.
  const onChangeRef = useRef(onChange);
  // Same for muted: a change reaches the live engine without recreating it.
  const mutedRef = useRef(muted);
  // Same for the palette.
  const paletteRef = useRef(palette);
  useEffect(() => {
    onChangeRef.current = onChange;
    mutedRef.current = muted;
    paletteRef.current = palette;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = factory(canvas, { onChange: (s) => onChangeRef.current(s) });
    engineRef.current = engine;
    engine.setMuted?.(mutedRef.current);
    if (paletteRef.current) engine.setPalette?.(paletteRef.current);
    return () => {
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [factory]);

  useEffect(() => {
    engineRef.current?.setMuted?.(muted);
  }, [muted]);

  useEffect(() => {
    if (palette) engineRef.current?.setPalette?.(palette);
  }, [palette]);

  useImperativeHandle(
    ref,
    () => ({
      start: () => engineRef.current?.start(),
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      end: () => engineRef.current?.end(),
      restart: () => engineRef.current?.restart(),
      press: (code, down) => engineRef.current?.press(code, down),
    }),
    [],
  );

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Game screen" />;
}
