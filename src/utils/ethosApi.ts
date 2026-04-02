const ETHOS_API_BASE = import.meta.env.DEV
  ? '/ethos-api'
  : 'https://api.ethos.network/api/v2';
const ETHOS_CLIENT = 'megabunnish@1.0.0';

const baseHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-Ethos-Client': ETHOS_CLIENT,
});

/* ── Privy → Ethos session exchange ──────────────────────────────── */

/**
 * Exchange a Privy access token for Ethos HttpOnly session cookies.
 * Must be called before any /wallets/privy/ endpoint.
 */
export async function exchangePrivyToken(privyAccessToken: string): Promise<boolean> {
  const res = await fetch(`${ETHOS_API_BASE}/auth/exchange`, {
    method: 'POST',
    headers: {
      ...baseHeaders(),
      Authorization: `Bearer ${privyAccessToken}`,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `Auth exchange failed (${res.status})` }));
    throw new Error(err.message || `Auth exchange failed (${res.status})`);
  }
  const data = await res.json();
  return data.ok === true;
}

/** Check if the user has an active Ethos session (cookies set). */
export async function checkEthosAuth(): Promise<{ ok: boolean; profileId?: number }> {
  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/auth-check`, {
    method: 'GET',
    headers: { 'X-Ethos-Client': ETHOS_CLIENT },
    credentials: 'include',
  });
  if (!res.ok) return { ok: false };
  return res.json();
}

/* ── Reviews: read ───────────────────────────────────────────────── */

export type EthosReview = {
  id: number;
  author: { displayName: string; username: string | null; avatarUrl: string; score: number };
  score: 'positive' | 'neutral' | 'negative';
  comment: string;
  createdAt: number;
  subject: { displayName: string };
};

export type ReviewsResponse = {
  values: EthosReview[];
  total: number;
  limit: number;
  offset: number;
};

export async function fetchReceivedReviews(
  userkey: string,
  limit = 20,
  offset = 0,
): Promise<ReviewsResponse> {
  const res = await fetch(`${ETHOS_API_BASE}/activities/profile/received`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({
      userkey,
      filter: ['review'],
      limit,
      offset,
      orderBy: { field: 'timestamp', direction: 'desc' },
    }),
  });
  if (!res.ok) throw new Error('Failed to fetch reviews');
  return res.json();
}

/* ── Reviews: write (via Privy session cookies) ──────────────────── */

export type ReviewScore = 'positive' | 'neutral' | 'negative';

export async function postReviewByX(
  username: string,
  score: ReviewScore,
  title: string,
  content?: string,
) {
  const body: Record<string, unknown> = {
    x: { username },
    score,
    title,
    waitForTxTimeoutSeconds: 5,
  };
  if (content && content.trim()) {
    body.content = content;
  }

  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/post/review/by-x`, {
    method: 'POST',
    headers: baseHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let errMsg = `Ethos API error (${res.status})`;
    try {
      const errData = JSON.parse(text);
      errMsg = errData.message || errData.error || errData.detail || JSON.stringify(errData);
    } catch { errMsg += ': ' + text.slice(0, 200); }
    throw new Error(errMsg);
  }
  return JSON.parse(text) as {
    hash: string;
    review?: { id: number };
    reviewSlug?: string;
  };
}
