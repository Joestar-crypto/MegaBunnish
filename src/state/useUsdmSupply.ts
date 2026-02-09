import { useEffect, useState } from 'react';

const BLOCKSCOUT_V2_API_URL = 'https://megaeth.blockscout.com/api/v2';
const USDM_CONTRACT = '0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DAY_MS = 86_400_000;
const LOOKBACK_DAYS = 30;
const MAX_TRANSFER_PAGES = 12;
const EMA_WINDOW = 30;
const REFRESH_WINDOW_MS = 2 * 60 * 60 * 1000;
const CACHE_KEY = 'usdmSupplyCache_v2';
export const USDM_SUPPLY_GOAL = 500_000_000;
export const USDM_SUPPLY_CHART_DOMAIN = { min: 0, max: 600_000_000 };

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2
});

const ZERO_ADDRESS_NORMALIZED = ZERO_ADDRESS.toLowerCase();

type TokenApiResponse = {
  total_supply?: string;
  decimals?: string;
  symbol?: string;
  name?: string;
  icon_url?: string;
};

type TransferAddress = {
  hash?: string | null;
};

type TransferTotal = {
  value?: string | null;
};

type TransferItem = {
  timestamp?: string;
  from?: TransferAddress | null;
  to?: TransferAddress | null;
  total?: TransferTotal | null;
};

type TransferPageResponse = {
  items?: TransferItem[];
  next_page_params?: Record<string, string | number | null>;
};

type SupplyEvent = {
  timestamp: number;
  delta: bigint;
};

type SupplyPoint = {
  date: string;
  supply: number;
  ema: number;
};

type CachedPayload = {
  timestamp: number;
  data: UsdmSupplyData;
};

export type UsdmSupplyData = {
  tokenName: string;
  symbol: string;
  iconUrl?: string;
  decimals: number;
  currentSupply: number;
  currentSupplyLabel: string;
  ema30: number;
  ema30Label: string;
  deltaPct: number;
  points: SupplyPoint[];
  lastUpdated: number;
};

export type UsdmSupplyState =
  | { status: 'idle' | 'loading' } 
  | { status: 'ready'; data: UsdmSupplyData } 
  | { status: 'error'; error: string };

export const useUsdmSupply = (): UsdmSupplyState => {
  const [state, setState] = useState<UsdmSupplyState>({ status: 'idle' });

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    const initialCache = ensureValidCache(readCache());
    const now = Date.now();
    const cacheIsFresh = Boolean(initialCache && now - initialCache.timestamp < REFRESH_WINDOW_MS);

    if (initialCache) {
      setState({ status: 'ready', data: initialCache.data });
    } else {
      setState({ status: 'loading' });
    }

    const load = async (isBackground = false) => {
      if (!isBackground) {
        setState((prev) => {
          if (prev.status === 'ready') {
            return prev;
          }
          return { status: 'loading' };
        });
      }

      try {
        const [token, events] = await Promise.all([
          fetchTokenInfo(controller.signal),
          fetchSupplyEvents(controller.signal)
        ]);

        if (!mounted) {
          return;
        }

        const decimals = parseDecimals(token.decimals);
        const rawSupply = parseTokenValue(token.total_supply);
        const points = withEma(buildDailySeries(rawSupply, events, decimals));
        const latestPoint = points.at(-1);
        const currentSupply = toDisplayUnits(rawSupply, decimals);
        const emaValue = latestPoint?.ema ?? currentSupply;
        const deltaPct = computeDeltaPct(latestPoint);
        const timestamp = Date.now();

        const data: UsdmSupplyData = {
          tokenName: token.name ?? 'MegaUSD',
          symbol: token.symbol ?? 'USDM',
          iconUrl: token.icon_url ?? undefined,
          decimals,
          currentSupply,
          currentSupplyLabel: compactFormatter.format(currentSupply),
          ema30: emaValue,
          ema30Label: compactFormatter.format(emaValue),
          deltaPct,
          points,
          lastUpdated: timestamp
        };

        writeCache({ timestamp, data });
        setState({ status: 'ready', data });
      } catch (error) {
        if (!mounted || controller.signal.aborted) {
          return;
        }
        const resolved = resolveError(error);
        if (isBackground) {
          setState((prev) => (prev.status === 'ready' ? prev : { status: 'error', error: resolved }));
        } else {
          setState({ status: 'error', error: resolved });
        }
      }
    };

    load(cacheIsFresh);

    let refreshTimer: number | undefined;
    if (typeof window !== 'undefined') {
      refreshTimer = window.setInterval(() => {
        load(true);
      }, REFRESH_WINDOW_MS);
    }

    return () => {
      mounted = false;
      controller.abort();
      if (typeof window !== 'undefined' && typeof refreshTimer !== 'undefined') {
        window.clearInterval(refreshTimer);
      }
    };
  }, []);

  return state;
};

const fetchTokenInfo = async (signal?: AbortSignal) => {
  const url = new URL(`${BLOCKSCOUT_V2_API_URL}/tokens/${USDM_CONTRACT}`);
  // Blockscout GET /tokens/{address_hash}
  return fetchJson<TokenApiResponse>(url, signal);
};

const fetchSupplyEvents = async (signal?: AbortSignal) => {
  const cutoff = startOfDay(Date.now()) - (LOOKBACK_DAYS - 1) * DAY_MS;
  const events: SupplyEvent[] = [];
  let nextParams: Record<string, string> | undefined;

  for (let page = 0; page < MAX_TRANSFER_PAGES; page += 1) {
    const url = new URL(`${BLOCKSCOUT_V2_API_URL}/tokens/${USDM_CONTRACT}/transfers`);
    Object.entries(nextParams ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));

    const payload = await fetchJson<TransferPageResponse>(url, signal);
    const items = payload.items ?? [];

    if (!items.length) {
      break;
    }

    for (const transfer of items) {
      const minted = isZeroAddress(transfer.from?.hash);
      const burned = isZeroAddress(transfer.to?.hash);
      if (minted === burned) {
        continue;
      }

      const value = parseTokenValue(transfer.total?.value);
      if (value === 0n) {
        continue;
      }

      const timestamp = safeTimestamp(transfer.timestamp);
      if (timestamp === null) {
        continue;
      }

      events.push({ timestamp, delta: minted ? value : -value });
    }

    const oldestTimestamp = items.reduce((oldest, transfer) => {
      const ts = safeTimestamp(transfer.timestamp);
      if (ts === null) {
        return oldest;
      }
      return Math.min(oldest, ts);
    }, Number.POSITIVE_INFINITY);

    const reachedCutoff = Number.isFinite(oldestTimestamp) && oldestTimestamp <= cutoff;
    if (reachedCutoff) {
      break;
    }

    const sanitizedParams = sanitizeNextParams(payload.next_page_params);
    if (!sanitizedParams) {
      break;
    }
    nextParams = sanitizedParams;
  }

  return events;
};

const fetchJson = async <T>(url: URL, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error('Unable to reach Blockscout.');
  }
  return (await response.json()) as T;
};

const parseDecimals = (value?: string) => {
  const parsed = Number(value ?? '18');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 18;
};

const parseTokenValue = (value?: string | null) => {
  try {
    return BigInt(value ?? '0');
  } catch {
    return 0n;
  }
};

const isZeroAddress = (value?: string | null) => {
  if (!value) {
    return false;
  }
  return value.trim().toLowerCase() === ZERO_ADDRESS_NORMALIZED;
};

const safeTimestamp = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const sanitizeNextParams = (params?: Record<string, string | number | null>) => {
  if (!params) {
    return undefined;
  }
  const sanitized: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || typeof value === 'undefined') {
      return;
    }
    sanitized[key] = String(value);
  });
  return Object.keys(sanitized).length ? sanitized : undefined;
};

const buildDailySeries = (currentSupply: bigint, events: SupplyEvent[], decimals: number) => {
  const now = Date.now();
  const oldestDayStart = startOfDay(now) - (LOOKBACK_DAYS - 1) * DAY_MS;
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
  const points: Array<{ date: string; supply: number }> = new Array(LOOKBACK_DAYS);
  let runningSupply = currentSupply;
  let eventIndex = 0;

  for (let dayOffset = LOOKBACK_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const dayStart = oldestDayStart + dayOffset * DAY_MS;
    const dayEnd = dayStart + DAY_MS;

    while (eventIndex < sorted.length && sorted[eventIndex].timestamp >= dayEnd) {
      runningSupply -= sorted[eventIndex].delta;
      eventIndex += 1;
    }

    points[dayOffset] = {
      date: new Date(dayStart).toISOString(),
      supply: toDisplayUnits(runningSupply, decimals)
    };
  }

  return points;
};

const withEma = (points: Array<{ date: string; supply: number }>): SupplyPoint[] => {
  if (!points.length) {
    return [];
  }
  const alpha = 2 / (EMA_WINDOW + 1);
  let ema = points[0].supply;

  return points.map((point, index) => {
    if (index === 0) {
      ema = point.supply;
    } else {
      ema = point.supply * alpha + ema * (1 - alpha);
    }
    return { ...point, ema };
  });
};

export const buildLinePathFromSeries = (values: number[], domainMin?: number, domainMax?: number) => {
  if (!values.length) {
    return '';
  }
  const hasDomain =
    typeof domainMin === 'number' &&
    typeof domainMax === 'number' &&
    Number.isFinite(domainMin) &&
    Number.isFinite(domainMax) &&
    domainMax > domainMin;
  const min = hasDomain ? (domainMin as number) : Math.min(...values);
  const max = hasDomain ? (domainMax as number) : Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return '';
  }
  const range = max - min;
  const step = values.length > 1 ? 100 / (values.length - 1) : 100;

  if (range === 0) {
    const y = 50;
    return `M 0 ${y.toFixed(2)} L 100 ${y.toFixed(2)}`;
  }

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : index * step;
      const clamped = Math.max(min, Math.min(max, value));
      const normalized = (clamped - min) / range;
      const y = 100 - normalized * 100;
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const toDisplayUnits = (value: bigint, decimals: number) => {
  const base = 10n ** BigInt(decimals);
  const integerPart = value / base;
  const remainder = value % base;
  const fractional = Number(remainder) / Number(base);
  return Number(integerPart) + fractional;
};

const computeDeltaPct = (point?: SupplyPoint) => {
  if (!point || point.ema === 0) {
    return 0;
  }
  return ((point.supply - point.ema) / point.ema) * 100;
};

const resolveError = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Request aborted.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unable to load USDm supply data.';
};

const startOfDay = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
};

const ensureValidCache = (payload: CachedPayload | null): CachedPayload | null => {
  if (!payload) {
    return null;
  }
  if (!payload.data || !Array.isArray(payload.data.points) || !payload.data.points.length) {
    return null;
  }
  return payload;
};

const readCache = (): CachedPayload | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as CachedPayload;
  } catch {
    return null;
  }
};

const writeCache = (payload: CachedPayload) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignored: storage might be unavailable.
  }
};
