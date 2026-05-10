// ============================================================
// GET /api/quote?symbol=VFV.TO&userId=<uuid>
// Returns unified Quote object. TTL: 60s per doc 02 §8.7.
// Flow: KV cache → Finnhub → Yahoo Finance fallback → unified Quote
// ============================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvGet, kvSet, makeCacheKey } from './_lib/kv-cache';
import { checkIpLimit, checkUserLimit, getClientIp } from './_lib/rate-limit';
import { fetchQuote as finnhubFetchQuote } from './_lib/adapters/finnhub';
import { fetchYahooQuote } from './_lib/adapters/yahoo';
import type { Quote } from '../src/types';

const QUOTE_TTL_SECONDS = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const symbol = (req.query.symbol as string)?.toUpperCase().trim();
  if (!symbol) {
    return res.status(400).json({ error: 'symbol is required' });
  }

  // Rate limiting
  const ip = getClientIp({ headers: req.headers as Record<string, string | string[] | undefined> });
  const userId = req.query.userId as string | undefined;

  const ipLimit = await checkIpLimit(ip);
  if (!ipLimit.allowed) {
    res.setHeader('Retry-After', String(ipLimit.retryAfter ?? 60));
    return res.status(429).json({ error: 'Too many requests' });
  }

  if (userId) {
    const userLimit = await checkUserLimit(userId);
    if (!userLimit.allowed) {
      res.setHeader('Retry-After', String(userLimit.retryAfter ?? 60));
      return res.status(429).json({ error: 'User quota exceeded' });
    }
  }

  // Cache check
  const cacheKey = makeCacheKey('quote', symbol);
  const cached = await kvGet<Quote>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  // Finnhub primary
  let quote: Quote | null = null;

  try {
    const raw = await finnhubFetchQuote(symbol);
    // Finnhub returns 0/null for unknown symbols
    if (raw.c > 0) {
      quote = {
        symbol,
        price: raw.c,
        change: raw.d,
        changePercent: raw.dp,
        volume: raw.v,
        timestamp: new Date(raw.t * 1000).toISOString(),
        currency: symbol.endsWith('.TO') ? 'CAD' : 'USD',
      };
    }
  } catch {
    // Fall through to Yahoo
  }

  // Yahoo Finance fallback (especially for .TO tickers)
  if (!quote) {
    try {
      const yahoo = await fetchYahooQuote(symbol);
      if (yahoo) {
        quote = {
          symbol,
          price: yahoo.regularMarketPrice,
          change: yahoo.regularMarketChange,
          changePercent: yahoo.regularMarketChangePercent,
          volume: yahoo.regularMarketVolume,
          timestamp: new Date(yahoo.timestamp * 1000).toISOString(),
          currency: yahoo.currency,
        };
      }
    } catch {
      // Both sources failed
    }
  }

  if (!quote) {
    return res.status(502).json({ error: `Unable to fetch quote for ${symbol}` });
  }

  // Cache the result
  await kvSet(cacheKey, quote, QUOTE_TTL_SECONDS);

  res.setHeader('X-Cache', 'MISS');
  return res.status(200).json(quote);
}
