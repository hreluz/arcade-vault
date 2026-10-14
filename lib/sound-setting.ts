import { useCallback, useSyncExternalStore } from "react";

// The player's SOUND ON / OFF choice, shared by every game with sound and
// remembered in localStorage. A missing, unknown or unreadable value means on.
const KEY = "arcade-vault:sound";
const CHANGE_EVENT = "arcade-vault:sound-change";

type Setting = "on" | "off";

// Fallback when localStorage throws (site data disabled): the setting still
// applies for the session.
let memory: Setting = "on";

function read(): Setting {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "on" || stored === "off") return stored;
    return stored === null ? memory : "on";
  } catch {
    return memory;
  }
}

function write(value: Setting) {
  memory = value;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Storage unavailable: keep the in-memory value.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Other tabs fire `storage`; this tab fires CHANGE_EVENT.
function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// The server always renders "on", so hydration never mismatches.
const getServerSnapshot = (): Setting => "on";

export function useSoundSetting(): [soundOn: boolean, setSoundOn: (on: boolean) => void] {
  const value = useSyncExternalStore(subscribe, read, getServerSnapshot);
  const setSoundOn = useCallback((on: boolean) => write(on ? "on" : "off"), []);
  return [value === "on", setSoundOn];
}
