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
 * Must be called once before any /wallets/privy/ endpoint.
 *
 * Per the official EEW Partner Guide:
 *   POST /auth/exchange  with  Authorization: Bearer <privyToken>
 *   → sets Ethos access/refresh JWTs as HttpOnly cookies
 *
 * All subsequent wallet calls use those cookies via credentials: 'include'.
 */
export async function exchangePrivyToken(privyAccessToken: string): Promise<boolean> {
  console.log('[Ethos] Exchanging token for Ethos session cookies…');
  console.log('[Ethos] API base:', ETHOS_API_BASE);
  console.log('[Ethos] Token preview:', privyAccessToken.substring(0, 40) + '…');
  const res = await fetch(`${ETHOS_API_BASE}/auth/exchange`, {
    method: 'POST',
    headers: {
      ...baseHeaders(),
      Authorization: `Bearer ${privyAccessToken}`,
    },
    credentials: 'include', // Required: accept HttpOnly cookies from Ethos
  });
  console.log('[Ethos] exchange response status:', res.status);
  // Log visible headers for diagnostics (Set-Cookie is hidden by browser)
  console.log('[Ethos] exchange response headers:', Object.fromEntries(res.headers.entries()));

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[Ethos] exchange error body:', text);
    let detail = `Auth exchange failed (HTTP ${res.status})`;
    try {
      const errData = JSON.parse(text);
      detail = errData.message || errData.error || errData.code || detail;
      if (errData.code) detail += ` [${errData.code}]`;
    } catch { if (text) detail += ': ' + text.slice(0, 200); }
    throw new Error(detail);
  }

  const data = await res.json();
  console.log('[Ethos] exchange result:', data);
  return data.ok === true;
}

/**
 * Check if the user has an active Ethos session (cookie-based).
 * Per the EEW guide: GET /wallets/privy/auth-check with credentials: 'include'.
 */
export async function checkEthosAuth(): Promise<{ ok: boolean; profileId?: number }> {
  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/auth-check`, {
    method: 'GET',
    headers: { 'X-Ethos-Client': ETHOS_CLIENT },
    credentials: 'include', // Send Ethos session cookies
  });
  console.log('[Ethos] auth-check status:', res.status);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('[Ethos] auth-check error:', res.status, text);
    return { ok: false };
  }
  const data = await res.json();
  console.log('[Ethos] auth-check result:', data);
  return data;
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

/* ── Reviews: write (via Ethos session cookies) ──────────────────── */

export type ReviewScore = 'positive' | 'neutral' | 'negative';

/**
 * Per the EEW guide, this uses ONLY cookies (credentials: 'include').
 * The exchange must have been called first to set the session cookies.
 */
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
    credentials: 'include', // Send Ethos session cookies
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
