import { createAsteroids } from "@/lib/engines/asteroids";
import type { EngineFactory } from "@/lib/engines/types";

export const ENGINES: Partial<Record<string, EngineFactory>> = { asteroids: createAsteroids };
