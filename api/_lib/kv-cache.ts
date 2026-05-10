// ============================================================
// Vercel KV Cache Helper
// Wraps @vercel/kv with typed get/set and falls back to in-memory
// Map when KV env vars are not present (local dev without Vercel CLI).
// ============================================================

// In-memory fallback for local dev (not shared across requests)
const memCache = new Map<string, { value: string; expiresAt: number }>();

function isKvAvailable(): boolean {
  return !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (isKvAvailable()) {
    try {
      const { kv } = await import('@vercel/kv');
      return await kv.get<T>(key);
    } catch {
      return null;
    }
  }

  // In-memory fallback
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function kvSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (isKvAvailable()) {
    try {
      const { kv } = await import('@vercel/kv');
      await kv.set(key, value, { ex: ttlSeconds });
    } catch {
      // Silently ignore KV write failures — data will just not be cached
    }
    return;
  }

  // In-memory fallback
  memCache.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function makeCacheKey(...parts: string[]): string {
  return `inv:${parts.join(':')}`;
}
