// ============================================================
// GET /api/history?symbol=AAPL&range=1y&userId=<uuid>
// Returns Bar[] (OHLCV). TTL varies by data age per doc 02 §8.7.
// Flow: KV cache → Finnhub candles → unified Bar[]
// ============================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvGet, kvSet, makeCacheKey } from './_lib/kv-cache';
import { checkIpLimit, getClientIp } from './_lib/rate-limit';
import { fetchCandles } from './_lib/adapters/finnhub';
import type { Bar } from '../src/types';

type Range = '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '2y' | '5y';

const RANGE_CONFIG: Record<Range, { resolution: string; daysBack: number; ttlSeconds: number }> = {
  '1d':  { resolution: '5',  daysBack: 1,    ttlSeconds: 60 },
  '5d':  { resolution: '30', daysBack: 5,    ttlSeconds: 300 },
  '1m':  { resolution: 'D',  daysBack: 30,   ttlSeconds: 3600 },
  '3m':  { resolution: 'D',  daysBack: 91,   ttlSeconds: 3600 },
  '6m':  { resolution: 'D',  daysBack: 182,  ttlSeconds: 3600 },
  '1y':  { resolution: 'D',  daysBack: 365,  ttlSeconds: 3600 },
  '2y':  { resolution: 'W',  daysBack: 730,  ttlSeconds: 86400 },  // 24h for >30d data
  '5y':  { resolution: 'M',  daysBack: 1825, ttlSeconds: 86400 },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const symbol = (req.query.symbol as string)?.toUpperCase().trim();
  const range = (req.query.range as Range) ?? '1y';

  if (!symbol) {
    return res.status(400).json({ error: 'symbol is required' });
  }

  const config = RANGE_CONFIG[range] ?? RANGE_CONFIG['1y'];

  // Rate limiting
  const ip = getClientIp({ headers: req.headers as Record<string, string | string[] | undefined> });
  const ipLimit = await checkIpLimit(ip);
  if (!ipLimit.allowed) {
    res.setHeader('Retry-After', String(ipLimit.retryAfter ?? 60));
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Cache check
  const cacheKey = makeCacheKey('history', symbol, range);
  const cached = await kvGet<Bar[]>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  const now = Math.floor(Date.now() / 1000);
  const from = now - config.daysBack * 86400;

  try {
    const candles = await fetchCandles(symbol, config.resolution, from, now);

    if (candles.s === 'no_data' || !candles.t?.length) {
      return res.status(200).json([]);
    }

    const bars: Bar[] = candles.t.map((ts, i) => ({
      symbol,
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open:   candles.o[i],
      high:   candles.h[i],
      low:    candles.l[i],
      close:  candles.c[i],
      volume: candles.v[i],
    }));

    await kvSet(cacheKey, bars, config.ttlSeconds);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(bars);
  } catch (err) {
    console.error('history endpoint error:', err);
    return res.status(502).json({ error: 'Unable to fetch historical data' });
  }
}
