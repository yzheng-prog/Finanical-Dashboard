// ============================================================
// Yahoo Finance Adapter — Unofficial fallback for .TO (Canadian) tickers
// No API key required. No official SLA — must never be the only source.
// Doc 06 §11: retry with exponential backoff, aggressive caching, graceful degradation.
// ============================================================

const BASE_URL = 'https://query2.finance.yahoo.com/v8/finance/chart';

export interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume?: number;
  currency: string;
  timestamp: number;  // Unix seconds
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; InvestmentPlatform/0.1)',
          'Accept': 'application/json',
        },
      });

      if (res.status === 429 || res.status >= 500) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        lastError = new Error(`Yahoo Finance HTTP ${res.status}`);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError ?? new Error('Yahoo Finance: all retries exhausted');
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
  try {
    const url = `${BASE_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetchWithRetry(url);

    if (!res.ok) return null;

    const data = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice: number;
            regularMarketChange: number;
            regularMarketChangePercent: number;
            regularMarketVolume?: number;
            currency: string;
          };
          timestamp?: number[];
        }>;
        error?: unknown;
      };
    };

    const result = data?.chart?.result?.[0];
    const meta = result?.meta;

    if (!meta) return null;

    return {
      symbol,
      regularMarketPrice: meta.regularMarketPrice,
      regularMarketChange: meta.regularMarketChange ?? 0,
      regularMarketChangePercent: meta.regularMarketChangePercent ?? 0,
      regularMarketVolume: meta.regularMarketVolume,
      currency: meta.currency ?? 'CAD',
      timestamp: result?.timestamp?.[result.timestamp.length - 1] ?? Math.floor(Date.now() / 1000),
    };
  } catch {
    // Graceful degradation — return null so caller falls through to next source
    return null;
  }
}
