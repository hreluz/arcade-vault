import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_SKIN,
  SKIN_IDS,
  type ColorMode,
  type GameSkins,
  type SkinId,
  type SkinPalette,
} from "@/lib/skins/types";

// The player's SKIN and MODE choices, shared by every skinned game and remembered
// in localStorage. Same pattern as lib/sound-setting.ts.
export type ColorModeSetting = "system" | ColorMode;

const COLOR_MODE_SETTINGS: readonly ColorModeSetting[] = ["system", "light", "dark"];
const DARK_QUERY = "(prefers-color-scheme: dark)";

type Store<T extends string> = {
  read: () => T;
  write: (value: T) => void;
  subscribe: (onChange: () => void) => () => void;
};

function createStore<T extends string>(key: string, values: readonly T[], fallback: T): Store<T> {
  const changeEvent = `${key}-change`;
  // Fallback when localStorage throws (site data disabled): the setting still
  // applies for the session.
  let memory = fallback;

  return {
    // A missing value means the session's choice; an unknown one means the default.
    read() {
      try {
        const stored = window.localStorage.getItem(key);
        if (stored === null) return memory;
        return values.find((v) => v === stored) ?? fallback;
      } catch {
        return memory;
      }
    },
    write(value) {
      memory = value;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Storage unavailable: keep the in-memory value.
      }
      window.dispatchEvent(new Event(changeEvent));
    },
    // Other tabs fire `storage`; this tab fires the change event.
    subscribe(onChange) {
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) onChange();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(changeEvent, onChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(changeEvent, onChange);
      };
    },
  };
}

const skinStore = createStore<SkinId>("arcade-vault:skin", SKIN_IDS, DEFAULT_SKIN);
const modeStore = createStore<ColorModeSetting>(
  "arcade-vault:color-mode",
  COLOR_MODE_SETTINGS,
  "system",
);

function subscribeSystemMode(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const readSystemMode = (): ColorMode => (window.matchMedia(DARK_QUERY).matches ? "dark" : "light");

// The server always renders classic + dark, so hydration never mismatches.
const getServerSkin = (): SkinId => DEFAULT_SKIN;
const getServerModeSetting = (): ColorModeSetting => "system";
const getServerSystemMode = (): ColorMode => "dark";

export function useSkinSetting(): [skin: SkinId, setSkin: (skin: SkinId) => void] {
  const skin = useSyncExternalStore(skinStore.subscribe, skinStore.read, getServerSkin);
  const setSkin = useCallback((value: SkinId) => skinStore.write(value), []);
  return [skin, setSkin];
}

// `mode` is the resolved light / dark, following the OS live while the setting is "system".
export function useColorMode(): [
  setting: ColorModeSetting,
  setSetting: (setting: ColorModeSetting) => void,
  mode: ColorMode,
] {
  const setting = useSyncExternalStore(modeStore.subscribe, modeStore.read, getServerModeSetting);
  const systemMode = useSyncExternalStore(subscribeSystemMode, readSystemMode, getServerSystemMode);
  const setSetting = useCallback((value: ColorModeSetting) => modeStore.write(value), []);
  return [setting, setSetting, setting === "system" ? systemMode : setting];
}

export function resolvePalette<R extends string>(
  skins: GameSkins<R>,
  skin: SkinId,
  mode: ColorMode,
): SkinPalette<R> {
  return skins[skin][mode];
}
