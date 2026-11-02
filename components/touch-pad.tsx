"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { PadButton, PadCode, PadSlot } from "@/lib/engines/types";

type Props = {
  buttons: PadButton[];
  onPress: (code: PadCode, down: boolean) => void;
};

// Auto-repeat for buttons with `repeat`, standing in for the OS key-repeat.
const REPEAT_DELAY = 170;
const REPEAT_EVERY = 50;

const DPAD_SLOTS: PadSlot[] = ["up", "left", "right", "down"];
const ACTION_SLOTS: PadSlot[] = ["a", "b"];

// The finger holding a button and its pending repeat, if any.
type Hold = { pointerId: number; code: PadCode; timer: ReturnType<typeof setTimeout> | null };

// On-screen gamepad for touch devices (CSS shows it only under pointer: coarse).
// Each button is held while its finger is down, so several can be held at once.
export default function TouchPad({ buttons, onPress }: Props) {
  const holds = useRef(new Map<PadSlot, Hold>());
  const [pressed, setPressed] = useState<ReadonlySet<PadSlot>>(new Set());

  // Read through a ref so a new callback identity never drops a held button.
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  });

  const syncPressed = () => setPressed(new Set(holds.current.keys()));

  const release = (slot: PadSlot) => {
    const hold = holds.current.get(slot);
    if (!hold) return;
    if (hold.timer) clearTimeout(hold.timer);
    holds.current.delete(slot);
    onPressRef.current(hold.code, false);
  };

  // A lost blur or unmount must never leave thrust or the paddle stuck on.
  useEffect(() => {
    const map = holds.current;
    const releaseAll = () => {
      if (map.size === 0) return;
      for (const slot of [...map.keys()]) release(slot);
      syncPressed();
    };
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      for (const slot of [...map.keys()]) release(slot);
    };
  }, []);

  const down = (button: PadButton) => (e: PointerEvent<HTMLButtonElement>) => {
    // No focus, no emulated mouse events, no text selection.
    e.preventDefault();
    if (holds.current.has(button.slot)) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const hold: Hold = { pointerId: e.pointerId, code: button.code, timer: null };
    holds.current.set(button.slot, hold);
    onPressRef.current(button.code, true);
    if (typeof navigator.vibrate === "function") navigator.vibrate(10);

    if (button.repeat) {
      const tick = (delay: number) => {
        hold.timer = setTimeout(() => {
          onPressRef.current(button.code, true);
          tick(REPEAT_EVERY);
        }, delay);
      };
      tick(REPEAT_DELAY);
    }
    syncPressed();
  };

  // pointerup, pointercancel and lostpointercapture all end the hold of that finger.
  const up = (slot: PadSlot) => (e: PointerEvent<HTMLButtonElement>) => {
    if (holds.current.get(slot)?.pointerId !== e.pointerId) return;
    release(slot);
    syncPressed();
  };

  const renderSlot = (slot: PadSlot) => {
    const button = buttons.find((b) => b.slot === slot);
    // An empty slot renders nothing; the grid keeps its place.
    if (!button) return null;
    return (
      <button
        key={slot}
        type="button"
        className={`pad-btn pad-${slot}`}
        data-pressed={pressed.has(slot) || undefined}
        aria-label={button.ariaLabel}
        onPointerDown={down(button)}
        onPointerUp={up(slot)}
        onPointerCancel={up(slot)}
        onLostPointerCapture={up(slot)}
      >
        {button.label}
      </button>
    );
  };

  return (
    <div
      className="touch-pad"
      role="group"
      aria-label="Touch controls"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="pad-dpad">{DPAD_SLOTS.map(renderSlot)}</div>
      <div className="pad-actions">{ACTION_SLOTS.map(renderSlot)}</div>
    </div>
  );
}
