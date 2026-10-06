// Server only: import from Server Actions, never from client components.

// Hit timestamps per key. Lives in module memory: lost on restart and not shared across instances.
const hits = new Map<string, number[]>();

// Sliding window: allows `limit` hits per `windowMs` per key. Returns true when this hit is allowed.
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}
