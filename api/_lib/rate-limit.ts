// ============================================================
// Rate Limiter — Sliding window per IP and per user UUID
// Limits per doc 06: 60 req/min per IP, 120 req/min per user UUID
// LLM endpoints: 20 req/hour (handled separately in llm.ts)
// ============================================================

import { kvGet, kvSet, makeCacheKey } from './kv-cache';

interface RateLimitEntry {
  count: number;
  windowStart: number; // Unix ms
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // seconds until reset
}

const WINDOW_MS = 60 * 1000; // 1 minute

async function checkLimit(
  key: string,
  maxRequests: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = await kvGet<RateLimitEntry>(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // New window
    await kvSet<RateLimitEntry>(key, { count: 1, windowStart: now }, 70);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  await kvSet<RateLimitEntry>(
    key,
    { count: entry.count + 1, windowStart: entry.windowStart },
    70
  );
  return { allowed: true, remaining: maxRequests - entry.count - 1 };
}

export async function checkIpLimit(ip: string): Promise<RateLimitResult> {
  return checkLimit(makeCacheKey('rl', 'ip', ip), 60);
}

export async function checkUserLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(makeCacheKey('rl', 'user', userId), 120);
}

export function getClientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return 'unknown';
}
