// ============================================================
// Finnhub Adapter — Primary quote and data source
// Free tier: 60 calls/min; sufficient for 5 users
// Doc 06 §1: all endpoints documented here
// ============================================================

const BASE_URL = 'https://finnhub.io/api/v1';

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY environment variable is not set');
  return key;
}

export interface FinnhubQuote {
  c:  number;  // current price
  d:  number;  // change
  dp: number;  // change percent
  h:  number;  // high
  l:  number;  // low
  o:  number;  // open
  pc: number;  // previous close
  t:  number;  // timestamp (Unix seconds)
  v?: number;  // volume
}

export interface FinnhubCandle {
  c: number[];   // close prices
  h: number[];
  l: number[];
  o: number[];
  v: number[];
  t: number[];   // timestamps (Unix seconds)
  s: 'ok' | 'no_data';
}

async function finnhubFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}&token=${getApiKey()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'InvestmentPlatform/0.1.0' },
  });

  if (!res.ok) {
    throw new Error(`Finnhub ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchQuote(symbol: string): Promise<FinnhubQuote> {
  return finnhubFetch<FinnhubQuote>(`/quote?symbol=${encodeURIComponent(symbol)}`);
}

export async function fetchCandles(
  symbol: string,
  resolution: string,
  from: number,  // Unix seconds
  to: number
): Promise<FinnhubCandle> {
  return finnhubFetch<FinnhubCandle>(
    `/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}`
  );
}

export async function fetchNews(symbol: string, from: string, to: string): Promise<unknown[]> {
  return finnhubFetch<unknown[]>(
    `/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`
  );
}
