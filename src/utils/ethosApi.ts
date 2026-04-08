const ETHOS_API_BASE = import.meta.env.DEV
  ? '/ethos-api'
  : 'https://api.ethos.network/api/v2';

// Wallet/cookie endpoints MUST hit the real domain so the browser sends .ethos.network cookies.
// The Vite proxy rewrites the domain, so cookies set by logging in on app.ethos.network aren't sent.
const ETHOS_WALLET_BASE = 'https://api.ethos.network/api/v2';

const ETHOS_CLIENT = 'megabunnish@1.0.0';

const baseHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-Ethos-Client': ETHOS_CLIENT,
});

/**
 * Request Storage Access so the browser sends .ethos.network cookies cross-site.
 * Required for browsers that block third-party cookies (Brave, Chrome 3PCD, Safari).
 * Must be called from a user gesture (click handler).
 */
export async function requestEthosStorageAccess(): Promise<boolean> {
  try {
    // requestStorageAccessFor: top-level page requests cookie access for another origin
    if ('requestStorageAccessFor' in document) {
      console.log('[Ethos] Requesting storage access for api.ethos.network…');
      await (document as unknown as { requestStorageAccessFor: (origin: string) => Promise<void> })
        .requestStorageAccessFor('https://api.ethos.network');
      console.log('[Ethos] ✓ Storage access granted');
      return true;
    }
    // Fallback: requestStorageAccess (mainly for iframes, but worth trying)
    if ('requestStorageAccess' in document) {
      console.log('[Ethos] Trying requestStorageAccess fallback…');
      await document.requestStorageAccess();
      console.log('[Ethos] ✓ Storage access granted (fallback)');
      return true;
    }
    console.warn('[Ethos] Storage Access API not available in this browser');
    return false;
  } catch (err) {
    console.warn('[Ethos] Storage access denied:', err);
    return false;
  }
}

/**
 * Check if the user has an active Ethos session (cookie-based).
 * Per the EEW guide: GET /wallets/privy/auth-check with credentials: 'include'.
 * If 401 → user must log in at app.ethos.network first.
 */
export async function checkEthosAuth(): Promise<{ ok: boolean; profileId?: number }> {
  const res = await fetch(`${ETHOS_WALLET_BASE}/wallets/privy/auth-check`, {
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

  const res = await fetch(`${ETHOS_WALLET_BASE}/wallets/privy/post/review/by-x`, {
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
